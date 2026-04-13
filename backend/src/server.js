import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRootDir = path.resolve(__dirname, '..');
const repoRootDir = path.resolve(__dirname, '..', '..');
const bundledFrontendDir = path.join(backendRootDir, 'public');
const sourceFrontendDir = path.join(repoRootDir, 'FrontEnd', 'html');
const frontendDir = [bundledFrontendDir, sourceFrontendDir].find(candidate => existsSync(path.join(candidate, 'index.html'))) || '';
const frontendIndexFile = frontendDir ? path.join(frontendDir, 'index.html') : '';
const shouldServeFrontend = process.env.SERVE_FRONTEND !== 'false';
const dataDir = path.resolve(__dirname, '..', 'data');
const dbFile = path.join(dataDir, 'studenthelper.db');
const legacyCacheFile = path.join(dataDir, 'recommendation-cache.json');
const legacyLogsFile = path.join(dataDir, 'query-logs.json');
const legacyUserMemoryFile = path.join(dataDir, 'user-memory.json');
function getDatabaseUrl() {
  return (process.env.DATABASE_URL || '').trim();
}

function getDbProvider() {
  return (process.env.DB_PROVIDER || (getDatabaseUrl() ? 'postgres' : 'sqlite')).toLowerCase();
}

function getDbSslMode() {
  return (process.env.DB_SSL_MODE || 'require').toLowerCase();
}

function getDatabaseHost() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return 'missing';
  }

  try {
    return new URL(databaseUrl).host || 'unknown';
  } catch {
    return 'invalid';
  }
}
const adminReviewPassword = process.env.ADMIN_REVIEW_PASSWORD || '404 team name not found';

const app = express();
const port = Number(process.env.PORT || 8080);
const corsOrigin = process.env.CORS_ORIGIN || '*';
let promptedApiKey = '';
let promptedCurlConfig = '';
let apiKeyPromptPromise = null;
let db;
let pgClient;
const startupState = {
  initStarted: false,
  ready: false,
  initError: '',
};

app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin.split(',').map(item => item.trim()) }));
app.use(express.json({ limit: '1mb' }));

function isInteractivePromptAllowed() {
  return process.env.NODE_ENV !== 'production'
    && process.env.CI !== 'true'
    && input.isTTY
    && output.isTTY;
}

function normalizeCurlSource(value) {
  return String(value || '').replace(/\r?\n/g, ' ').trim();
}

function parseGeminiCurlConfig(rawValue) {
  const source = normalizeCurlSource(rawValue);
  if (!source || !source.toLowerCase().includes('generativelanguage.googleapis.com')) {
    return null;
  }

  const urlMatch = source.match(/curl\s+["']([^"']+)["']/i);
  const keyMatch = source.match(/X-goog-api-key:\s*([^"'\s]+)/i);
  const modelMatch = source.match(/\/models\/([^:'"\s]+)(?::generateContent)?/i);
  const baseUrlMatch = source.match(/https:\/\/generativelanguage\.googleapis\.com\/[^/"'\s]+/i);

  return {
    provider: 'gemini',
    apiKey: keyMatch ? keyMatch[1].trim() : '',
    baseUrl: (baseUrlMatch ? baseUrlMatch[0] : 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, ''),
    model: modelMatch ? modelMatch[1].trim() : 'gemini-2.0-flash',
    rawUrl: urlMatch ? urlMatch[1].trim() : '',
  };
}

function resolveRuntimeLlmInput(rawValue) {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) {
    return { apiKey: '', provider: '', baseUrl: '', model: '', sourceType: 'missing' };
  }

  const curlConfig = parseGeminiCurlConfig(trimmed);
  if (curlConfig) {
    return {
      apiKey: curlConfig.apiKey,
      provider: curlConfig.provider,
      baseUrl: curlConfig.baseUrl,
      model: curlConfig.model,
      sourceType: 'curl',
    };
  }

  return {
    apiKey: trimmed,
    provider: '',
    baseUrl: '',
    model: '',
    sourceType: 'api-key',
  };
}

async function askLine(rl, promptText) {
  return new Promise(resolve => {
    rl.question(promptText, resolve);
  });
}

async function readRuntimeConfigInput(rl) {
  const firstLine = await askLine(rl, 'LLM config is missing. Paste either the API key only, or the full Gemini curl command for this local session: ');

  if (!firstLine.trim().toLowerCase().startsWith('curl ')) {
    return firstLine;
  }

  console.log('Detected curl input. Paste the remaining lines, then submit one empty line to finish.');

  const lines = [firstLine];
  while (true) {
    const nextLine = await askLine(rl, '');
    if (!nextLine.trim()) {
      break;
    }
    lines.push(nextLine);
  }

  return lines.join('\n');
}

async function promptForApiKeyIfNeeded() {
  if (process.env.LLM_API_KEY || process.env.LLM_GEMINI_CURL || promptedApiKey || promptedCurlConfig) {
    return resolveRuntimeLlmInput(process.env.LLM_GEMINI_CURL || process.env.LLM_API_KEY || promptedCurlConfig || promptedApiKey);
  }

  if (!isInteractivePromptAllowed()) {
    return resolveRuntimeLlmInput('');
  }

  if (!apiKeyPromptPromise) {
    apiKeyPromptPromise = (async () => {
      const rl = readline.createInterface({ input, output });
      try {
        const entered = await readRuntimeConfigInput(rl);
        const parsed = parseGeminiCurlConfig(entered);
        if (parsed && parsed.apiKey) {
          promptedCurlConfig = entered.trim();
          promptedApiKey = parsed.apiKey;
          console.log('Loaded Gemini curl-style config into in-memory runtime config for this local session.');
          return resolveRuntimeLlmInput(promptedCurlConfig);
        }

        promptedApiKey = entered.trim();
        if (promptedApiKey) {
          console.log('Loaded API key into in-memory runtime config for this local session.');
        }
        return resolveRuntimeLlmInput(promptedApiKey);
      } finally {
        rl.close();
        apiKeyPromptPromise = null;
      }
    })();
  }

  return apiKeyPromptPromise;
}

async function getLlmConfig() {
  const runtimeInput = process.env.LLM_GEMINI_CURL || process.env.LLM_API_KEY || promptedCurlConfig || promptedApiKey;
  const resolvedInput = runtimeInput ? resolveRuntimeLlmInput(runtimeInput) : await promptForApiKeyIfNeeded();

  return {
    provider: resolvedInput.provider || process.env.LLM_PROVIDER || 'openai-compatible',
    apiKey: resolvedInput.apiKey || '',
    baseUrl: (resolvedInput.baseUrl || process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: resolvedInput.model || process.env.LLM_MODEL || 'gpt-4o-mini',
    temperature: Number(process.env.LLM_TEMPERATURE || 0.2),
    systemPrompt: process.env.LLM_SYSTEM_PROMPT || 'You are StudentHelper backend assistant.',
    sourceType: resolvedInput.sourceType,
  };
}

async function publicConfig() {
  const config = await getLlmConfig();
  return {
    provider: config.provider,
    databaseProvider: getDbProvider(),
    baseUrl: config.baseUrl,
    model: config.model,
    temperature: config.temperature,
    hasApiKey: Boolean(config.apiKey),
    apiKeySource: process.env.LLM_GEMINI_CURL ? 'env-curl' : process.env.LLM_API_KEY ? 'env' : promptedCurlConfig ? 'runtime-prompt-curl' : promptedApiKey ? 'runtime-prompt' : 'missing',
  };
}

function printStartupDiagnostics() {
  const hasDatabaseUrl = Boolean(getDatabaseUrl());
  const hasLlmKey = Boolean(process.env.LLM_API_KEY || process.env.LLM_GEMINI_CURL || promptedApiKey || promptedCurlConfig);

  console.log('[startup] StudentHelper backend booting');
  console.log(`[startup] PORT=${port}`);
  console.log(`[startup] SERVE_FRONTEND=${shouldServeFrontend}`);
  console.log(`[startup] DB_PROVIDER=${getDbProvider()}`);
  console.log(`[startup] DATABASE_URL=${hasDatabaseUrl ? 'set' : 'missing'}`);
  console.log(`[startup] DATABASE_HOST=${getDatabaseHost()}`);
  console.log(`[startup] DB_SSL_MODE=${getDbSslMode()}`);
  console.log(`[startup] LLM_PROVIDER=${process.env.LLM_PROVIDER || 'openai-compatible'}`);
  console.log(`[startup] LLM_API_KEY=${hasLlmKey ? 'set' : 'missing'}`);
  console.log(`[startup] CORS_ORIGIN=${corsOrigin}`);

  if (getDbProvider() === 'postgres' && !hasDatabaseUrl) {
    console.error('[startup] DATABASE_URL is missing while DB_PROVIDER=postgres. The server cannot start.');
    console.error('[startup] Set DATABASE_URL to your remote SSL Postgres connection string.');
  }

  if (getDbProvider() === 'sqlite') {
    console.warn('[startup] DB_PROVIDER=sqlite. For Back4App deployment, remote Postgres is recommended.');
  }

  if (!hasLlmKey) {
    console.warn('[startup] No LLM key is configured at process start. /api/recommend and /api/chat will fail until configured.');
  }
}

function printStartupFailureHints(error) {
  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();

  console.error('[startup] Backend failed before listening on the port.');

  if (lowered.includes('database_url') || lowered.includes('connection string')) {
    console.error('[startup] Hint: check DATABASE_URL formatting and ensure no placeholder like [YOUR-PASSWORD] remains.');
  }
  if (lowered.includes('password authentication failed') || lowered.includes('sasl')) {
    console.error('[startup] Hint: database credentials were rejected. Recheck the Postgres password and username.');
  }
  if (lowered.includes('getaddrinfo') || lowered.includes('enotfound')) {
    console.error('[startup] Hint: database host could not be resolved. Recheck the database hostname.');
  }
  if (lowered.includes('node:sqlite') || lowered.includes('experimental-sqlite')) {
    console.error('[startup] Hint: SQLite runtime support failed. Use remote Postgres for deployment, or recheck the Node image/runtime flags.');
  }
  if (lowered.includes('econnrefused') || lowered.includes('connect timeout')) {
    console.error('[startup] Hint: the database server refused the connection or timed out. Check firewall, SSL mode, and host reachability.');
  }
}

function normalizeMessages(messages) {
  return Array.isArray(messages)
    ? messages
      .filter(item => item && typeof item.role === 'string' && typeof item.content === 'string')
      .map(item => ({ role: item.role, content: item.content }))
    : [];
}

function mapRoleToGemini(role) {
  return role === 'assistant' ? 'model' : 'user';
}

function buildGeminiTextPayload(prompt, messages, config) {
  const history = normalizeMessages(messages).map(item => ({
    role: mapRoleToGemini(item.role),
    parts: [{ text: item.content }],
  }));

  return {
    systemInstruction: {
      parts: [{ text: config.systemPrompt }],
    },
    contents: [
      ...history,
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: config.temperature,
    },
  };
}

async function callOpenAiCompatible(prompt, messages, config) {
  const upstream = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      messages: [
        { role: 'system', content: config.systemPrompt },
        ...normalizeMessages(messages),
        { role: 'user', content: prompt },
      ],
    }),
  });

  const data = await upstream.json();
  if (!upstream.ok) {
    return { ok: false, status: upstream.status, error: 'Upstream LLM request failed', details: data };
  }

  return { ok: true, reply: data?.choices?.[0]?.message?.content || '', raw: data };
}

async function callGemini(prompt, messages, config) {
  const modelPath = `${config.baseUrl}/models/${config.model}:generateContent`;
  const upstream = await fetch(modelPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': config.apiKey,
    },
    body: JSON.stringify(buildGeminiTextPayload(prompt, messages, config)),
  });

  const data = await upstream.json();
  if (!upstream.ok) {
    return { ok: false, status: upstream.status, error: 'Gemini request failed', details: data };
  }

  const reply = data?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join('').trim() || '';
  return { ok: true, reply, raw: data };
}

async function callProvider(prompt, messages, config) {
  if (config.provider === 'gemini') {
    return callGemini(prompt, messages, config);
  }
  return callOpenAiCompatible(prompt, messages, config);
}

function normalizeQuery(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildQueryTokens(value) {
  return normalizeQuery(value).split(' ').filter(token => token.length >= 3);
}

function overlapScore(left, right) {
  const leftTokens = new Set(buildQueryTokens(left));
  const rightTokens = new Set(buildQueryTokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

async function readLegacyJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function buildPgSslConfig() {
  if (!getDatabaseUrl() || getDbSslMode() === 'disable') return false;
  return { rejectUnauthorized: false };
}

async function initDatabase() {
  if (getDbProvider() === 'postgres') {
    const { Client } = pg;
    pgClient = new Client({
      connectionString: getDatabaseUrl(),
      ssl: buildPgSslConfig(),
    });
    await pgClient.connect();
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS recommendation_cache (
        id BIGSERIAL PRIMARY KEY,
        normalized_query TEXT NOT NULL,
        intent_type TEXT NOT NULL,
        answer_summary TEXT NOT NULL,
        explanation_text TEXT NOT NULL,
        resource_ids TEXT NOT NULL,
        usage_count INTEGER NOT NULL DEFAULT 0,
        last_used_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_recommendation_cache_query_intent
        ON recommendation_cache(normalized_query, intent_type);

      CREATE TABLE IF NOT EXISTS query_logs (
        id BIGSERIAL PRIMARY KEY,
        user_key TEXT,
        original_query TEXT NOT NULL,
        normalized_query TEXT NOT NULL,
        intent_type TEXT NOT NULL,
        handled_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_memory (
        id BIGSERIAL PRIMARY KEY,
        user_key TEXT NOT NULL UNIQUE,
        major TEXT,
        budget_preference TEXT,
        favorite_categories TEXT,
        last_active_at TEXT
      );

      CREATE TABLE IF NOT EXISTS resource_interactions (
        id BIGSERIAL PRIMARY KEY,
        user_key TEXT,
        resource_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        desc TEXT NOT NULL,
        category TEXT NOT NULL,
        category_label TEXT NOT NULL,
        tag TEXT NOT NULL,
        email TEXT,
        status TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        reviewed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    return;
  }

  db = new DatabaseSync(dbFile);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS recommendation_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      normalized_query TEXT NOT NULL,
      intent_type TEXT NOT NULL,
      answer_summary TEXT NOT NULL,
      explanation_text TEXT NOT NULL,
      resource_ids TEXT NOT NULL,
      usage_count INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_recommendation_cache_query_intent
      ON recommendation_cache(normalized_query, intent_type);

    CREATE TABLE IF NOT EXISTS query_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_key TEXT,
      original_query TEXT NOT NULL,
      normalized_query TEXT NOT NULL,
      intent_type TEXT NOT NULL,
      handled_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_key TEXT NOT NULL UNIQUE,
      major TEXT,
      budget_preference TEXT,
      favorite_categories TEXT,
      last_active_at TEXT
    );

    CREATE TABLE IF NOT EXISTS resource_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_key TEXT,
      resource_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );


    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      desc TEXT NOT NULL,
      category TEXT NOT NULL,
      category_label TEXT NOT NULL,
      tag TEXT NOT NULL,
      email TEXT,
      status TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

async function getDatabaseCounts() {
  if (getDbProvider() === 'postgres') {
    const cacheCount = await pgClient.query('SELECT COUNT(*)::int AS count FROM recommendation_cache');
    const logCount = await pgClient.query('SELECT COUNT(*)::int AS count FROM query_logs');
    return {
      provider: 'postgres',
      cachedRecommendations: cacheCount.rows[0]?.count || 0,
      queryLogs: logCount.rows[0]?.count || 0,
    };
  }

  return {
    provider: 'sqlite',
    cachedRecommendations: db.prepare('SELECT COUNT(*) AS count FROM recommendation_cache').get().count,
    queryLogs: db.prepare('SELECT COUNT(*) AS count FROM query_logs').get().count,
  };
}

async function migrateLegacyData() {
  const legacyCache = await readLegacyJson(legacyCacheFile, []);
  const legacyLogs = await readLegacyJson(legacyLogsFile, []);
  const legacyUsers = await readLegacyJson(legacyUserMemoryFile, []);

  if (getDbProvider() === 'postgres') {
    const cacheCount = (await pgClient.query('SELECT COUNT(*)::int AS count FROM recommendation_cache')).rows[0]?.count || 0;
    if (cacheCount === 0) {
      for (const item of legacyCache) {
        await pgClient.query(
          `INSERT INTO recommendation_cache (normalized_query, intent_type, answer_summary, explanation_text, resource_ids, usage_count, last_used_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (normalized_query, intent_type) DO NOTHING`,
          [
            item.normalized_query || '',
            item.intent_type || 'recommendation',
            item.answer_summary || '',
            item.explanation_text || '',
            JSON.stringify(item.resource_ids || []),
            Number(item.usage_count || 0),
            item.last_used_at || new Date().toISOString(),
            item.created_at || new Date().toISOString(),
          ],
        );
      }
    }

    const logCount = (await pgClient.query('SELECT COUNT(*)::int AS count FROM query_logs')).rows[0]?.count || 0;
    if (logCount === 0) {
      for (const item of legacyLogs) {
        await pgClient.query(
          `INSERT INTO query_logs (user_key, original_query, normalized_query, intent_type, handled_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            item.user_key || null,
            item.original_query || '',
            item.normalized_query || normalizeQuery(item.original_query || ''),
            item.intent_type || 'unknown',
            item.handled_by || 'unknown',
            item.created_at || new Date().toISOString(),
          ],
        );
      }
    }

    const userCount = (await pgClient.query('SELECT COUNT(*)::int AS count FROM user_memory')).rows[0]?.count || 0;
    if (userCount === 0) {
      for (const item of legacyUsers) {
        await pgClient.query(
          `INSERT INTO user_memory (user_key, major, budget_preference, favorite_categories, last_active_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_key) DO NOTHING`,
          [
            item.user_key || '',
            item.major || null,
            item.budget_preference || null,
            JSON.stringify(item.favorite_categories || []),
            item.last_active_at || new Date().toISOString(),
          ],
        );
      }
    }

    return;
  }

  const cacheCount = db.prepare('SELECT COUNT(*) AS count FROM recommendation_cache').get().count;
  if (cacheCount === 0) {
    const insertCache = db.prepare(`
      INSERT INTO recommendation_cache (
        normalized_query, intent_type, answer_summary, explanation_text, resource_ids, usage_count, last_used_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of legacyCache) {
      insertCache.run(
        item.normalized_query || '',
        item.intent_type || 'recommendation',
        item.answer_summary || '',
        item.explanation_text || '',
        JSON.stringify(item.resource_ids || []),
        Number(item.usage_count || 0),
        item.last_used_at || new Date().toISOString(),
        item.created_at || new Date().toISOString(),
      );
    }
  }

  const logCount = db.prepare('SELECT COUNT(*) AS count FROM query_logs').get().count;
  if (logCount === 0) {
    const insertLog = db.prepare(`
      INSERT INTO query_logs (user_key, original_query, normalized_query, intent_type, handled_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const item of legacyLogs) {
      insertLog.run(
        item.user_key || null,
        item.original_query || '',
        item.normalized_query || normalizeQuery(item.original_query || ''),
        item.intent_type || 'unknown',
        item.handled_by || 'unknown',
        item.created_at || new Date().toISOString(),
      );
    }
  }

  const userCount = db.prepare('SELECT COUNT(*) AS count FROM user_memory').get().count;
  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO user_memory (user_key, major, budget_preference, favorite_categories, last_active_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const item of legacyUsers) {
      insertUser.run(
        item.user_key || '',
        item.major || null,
        item.budget_preference || null,
        JSON.stringify(item.favorite_categories || []),
        item.last_active_at || new Date().toISOString(),
      );
    }
  }
}

async function logQuery(entry) {
  const payload = [
    entry.user_key || null,
    entry.original_query || '',
    entry.normalized_query || normalizeQuery(entry.original_query || ''),
    entry.intent_type || 'unknown',
    entry.handled_by || 'unknown',
    new Date().toISOString(),
  ];

  if (getDbProvider() === 'postgres') {
    await pgClient.query(
      'INSERT INTO query_logs (user_key, original_query, normalized_query, intent_type, handled_by, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      payload,
    );
    return;
  }

  db.prepare(`
    INSERT INTO query_logs (user_key, original_query, normalized_query, intent_type, handled_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(...payload);
}

async function getUserMemory(userKey) {
  if (!userKey) return null;

  if (getDbProvider() === 'postgres') {
    const result = await pgClient.query(
      'SELECT user_key, major, budget_preference, favorite_categories, last_active_at FROM user_memory WHERE user_key = $1 LIMIT 1',
      [userKey],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      user_key: row.user_key,
      major: row.major,
      budget_preference: row.budget_preference,
      favorite_categories: parseJsonArray(row.favorite_categories),
      last_active_at: row.last_active_at,
    };
  }

  const row = db.prepare(`
    SELECT user_key, major, budget_preference, favorite_categories, last_active_at
    FROM user_memory
    WHERE user_key = ?
  `).get(userKey);
  if (!row) return null;
  return {
    user_key: row.user_key,
    major: row.major,
    budget_preference: row.budget_preference,
    favorite_categories: parseJsonArray(row.favorite_categories),
    last_active_at: row.last_active_at,
  };
}

async function findCachedRecommendation(query, intentType = 'recommendation') {
  const normalizedQuery = normalizeQuery(query);

  if (getDbProvider() === 'postgres') {
    const exactResult = await pgClient.query(
      'SELECT * FROM recommendation_cache WHERE normalized_query = $1 AND intent_type = $2 LIMIT 1',
      [normalizedQuery, intentType],
    );
    const exact = exactResult.rows[0];

    if (exact) {
      await pgClient.query(
        'UPDATE recommendation_cache SET usage_count = usage_count + 1, last_used_at = $1 WHERE id = $2',
        [new Date().toISOString(), exact.id],
      );
      return {
        hit: true,
        exact: true,
        item: { ...exact, resource_ids: parseJsonArray(exact.resource_ids) },
      };
    }

    const candidatesResult = await pgClient.query('SELECT * FROM recommendation_cache WHERE intent_type = $1', [intentType]);
    const scored = candidatesResult.rows
      .map(item => ({ item, score: overlapScore(normalizedQuery, item.normalized_query) }))
      .filter(candidate => candidate.score >= 0.6)
      .sort((a, b) => b.score - a.score)[0];

    if (!scored) return { hit: false };

    await pgClient.query(
      'UPDATE recommendation_cache SET usage_count = usage_count + 1, last_used_at = $1 WHERE id = $2',
      [new Date().toISOString(), scored.item.id],
    );

    return {
      hit: true,
      exact: false,
      score: scored.score,
      item: { ...scored.item, resource_ids: parseJsonArray(scored.item.resource_ids) },
    };
  }

  const exact = db.prepare(`
    SELECT * FROM recommendation_cache
    WHERE normalized_query = ? AND intent_type = ?
  `).get(normalizedQuery, intentType);

  if (exact) {
    db.prepare('UPDATE recommendation_cache SET usage_count = usage_count + 1, last_used_at = ? WHERE id = ?').run(new Date().toISOString(), exact.id);
    return {
      hit: true,
      exact: true,
      item: {
        ...exact,
        resource_ids: parseJsonArray(exact.resource_ids),
      },
    };
  }

  const candidates = db.prepare('SELECT * FROM recommendation_cache WHERE intent_type = ?').all(intentType);
  const scored = candidates
    .map(item => ({ item, score: overlapScore(normalizedQuery, item.normalized_query) }))
    .filter(candidate => candidate.score >= 0.6)
    .sort((a, b) => b.score - a.score)[0];

  if (!scored) {
    return { hit: false };
  }

  db.prepare('UPDATE recommendation_cache SET usage_count = usage_count + 1, last_used_at = ? WHERE id = ?').run(new Date().toISOString(), scored.item.id);
  return {
    hit: true,
    exact: false,
    score: scored.score,
    item: {
      ...scored.item,
      resource_ids: parseJsonArray(scored.item.resource_ids),
    },
  };
}

async function storeCachedRecommendation({ query, intentType = 'recommendation', answerSummary, explanationText, resourceIds = [] }) {
  const normalizedQuery = normalizeQuery(query);
  const now = new Date().toISOString();

  if (getDbProvider() === 'postgres') {
    const existingResult = await pgClient.query(
      'SELECT id FROM recommendation_cache WHERE normalized_query = $1 AND intent_type = $2 LIMIT 1',
      [normalizedQuery, intentType],
    );
    const existing = existingResult.rows[0];

    if (existing) {
      await pgClient.query(
        'UPDATE recommendation_cache SET answer_summary = $1, explanation_text = $2, resource_ids = $3, last_used_at = $4 WHERE id = $5',
        [answerSummary, explanationText, JSON.stringify(resourceIds), now, existing.id],
      );
      return { id: existing.id, resource_ids: resourceIds };
    }

    const insertResult = await pgClient.query(
      `INSERT INTO recommendation_cache (normalized_query, intent_type, answer_summary, explanation_text, resource_ids, usage_count, last_used_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [normalizedQuery, intentType, answerSummary, explanationText, JSON.stringify(resourceIds), 0, now, now],
    );

    return { id: insertResult.rows[0]?.id, resource_ids: resourceIds };
  }

  const existing = db.prepare(`
    SELECT id, created_at, usage_count
    FROM recommendation_cache
    WHERE normalized_query = ? AND intent_type = ?
  `).get(normalizedQuery, intentType);

  if (existing) {
    db.prepare(`
      UPDATE recommendation_cache
      SET answer_summary = ?, explanation_text = ?, resource_ids = ?, last_used_at = ?
      WHERE id = ?
    `).run(answerSummary, explanationText, JSON.stringify(resourceIds), now, existing.id);
    return { id: existing.id, resource_ids: resourceIds };
  }

  const result = db.prepare(`
    INSERT INTO recommendation_cache (
      normalized_query, intent_type, answer_summary, explanation_text, resource_ids, usage_count, last_used_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(normalizedQuery, intentType, answerSummary, explanationText, JSON.stringify(resourceIds), 0, now, now);

  return { id: result.lastInsertRowid, resource_ids: resourceIds };
}


function normalizeSubmissionRecord(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    title: row.title,
    url: row.url,
    desc: row.desc,
    category: row.category,
    categoryLabel: row.category_label || row.categoryLabel || row.category,
    tag: row.tag,
    email: row.email || '',
    status: row.status,
    submittedAt: row.submitted_at || row.submittedAt,
    reviewedAt: row.reviewed_at || row.reviewedAt || null,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

function requireAdminReviewAccess(req) {
  const headerPassword = req.get('x-admin-password') || '';
  return headerPassword && headerPassword === adminReviewPassword;
}

async function listSubmissions(status = '') {
  const normalizedStatus = String(status || '').trim().toLowerCase();

  if (getDbProvider() === 'postgres') {
    const result = normalizedStatus
      ? await pgClient.query('SELECT * FROM submissions WHERE status = $1 ORDER BY created_at DESC', [normalizedStatus])
      : await pgClient.query('SELECT * FROM submissions ORDER BY created_at DESC');
    return result.rows.map(normalizeSubmissionRecord);
  }

  const rows = normalizedStatus
    ? db.prepare('SELECT * FROM submissions WHERE status = ? ORDER BY created_at DESC').all(normalizedStatus)
    : db.prepare('SELECT * FROM submissions ORDER BY created_at DESC').all();
  return rows.map(normalizeSubmissionRecord);
}

async function createSubmission(payload) {
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title: payload.title,
    url: payload.url,
    desc: payload.desc,
    category: payload.category,
    category_label: payload.categoryLabel || payload.category,
    tag: payload.tag,
    email: payload.email || '',
    status: 'pending',
    submitted_at: now,
    reviewed_at: null,
    created_at: now,
    updated_at: now,
  };

  if (getDbProvider() === 'postgres') {
    await pgClient.query(
      `INSERT INTO submissions (
        id, title, url, desc, category, category_label, tag, email, status, submitted_at, reviewed_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        record.id,
        record.title,
        record.url,
        record.desc,
        record.category,
        record.category_label,
        record.tag,
        record.email,
        record.status,
        record.submitted_at,
        record.reviewed_at,
        record.created_at,
        record.updated_at,
      ],
    );
    return normalizeSubmissionRecord(record);
  }

  db.prepare(`
    INSERT INTO submissions (
      id, title, url, desc, category, category_label, tag, email, status, submitted_at, reviewed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.title,
    record.url,
    record.desc,
    record.category,
    record.category_label,
    record.tag,
    record.email,
    record.status,
    record.submitted_at,
    record.reviewed_at,
    record.created_at,
    record.updated_at,
  );

  return normalizeSubmissionRecord(record);
}

async function updateSubmissionStatus(id, status) {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  const reviewedAt = new Date().toISOString();

  if (getDbProvider() === 'postgres') {
    const result = await pgClient.query(
      `UPDATE submissions
       SET status = $1, reviewed_at = $2, updated_at = $2
       WHERE id = $3
       RETURNING *`,
      [normalizedStatus, reviewedAt, id],
    );
    return normalizeSubmissionRecord(result.rows[0]);
  }

  db.prepare(
    `UPDATE submissions
     SET status = ?, reviewed_at = ?, updated_at = ?
     WHERE id = ?`
  ).run(normalizedStatus, reviewedAt, reviewedAt, id);
  const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);
  return normalizeSubmissionRecord(row);
}

function buildRecommendationPrompt(query, matches, userMemory) {
  const resourceLines = matches.map((match, index) => {
    const title = match.title || 'Unknown resource';
    const category = match.category || 'Unknown category';
    const tag = match.tag || 'General';
    const desc = match.desc || '';
    return `${index + 1}. ${title} | ${category} | ${tag} | ${desc}`;
  }).join('\n');

  const memoryContext = userMemory
    ? `Student context: major=${userMemory.major || 'unknown'}, budget_preference=${userMemory.budget_preference || 'unknown'}, favorite_categories=${Array.isArray(userMemory.favorite_categories) ? userMemory.favorite_categories.join(', ') : 'unknown'}`
    : 'Student context: none provided.';

  return [
    'You explain why locally selected student resources fit the user request.',
    'Keep the answer short, practical, and specific to the listed matches.',
    'Use 2 to 4 sentences max.',
    memoryContext,
    `User request: ${query}`,
    'Local matches:',
    resourceLines,
  ].join('\n');
}

async function ensureLlmConfigReadyAtStartup() {
  if (process.env.LLM_API_KEY || process.env.LLM_GEMINI_CURL || promptedApiKey || promptedCurlConfig) return;
  if (!isInteractivePromptAllowed()) return;

  console.log('No backend LLM config was found in environment or .env.');
  const resolved = await promptForApiKeyIfNeeded();
  if (!resolved.apiKey) {
    console.log('No LLM config was entered. The backend will return MISSING_API_KEY until configured.');
  }
}

app.get('/api/health', async (_req, res) => {
  if (!startupState.ready) {
    return res.json({
      ok: false,
      service: 'studenthelper-backend',
      startup: { ...startupState },
      llm: await publicConfig(),
      data: null,
    });
  }

  const counts = await getDatabaseCounts();
  res.json({ ok: true, service: 'studenthelper-backend', startup: { ...startupState }, llm: await publicConfig(), data: counts });
});

app.get('/api/runtime-config', async (_req, res) => {
  res.json({ ok: true, config: await publicConfig() });
});

app.post('/api/chat', async (req, res) => {
  const { message, messages = [] } = req.body || {};
  const prompt = typeof message === 'string' ? message.trim() : '';
  const config = await getLlmConfig();

  if (!prompt) {
    return res.status(400).json({ ok: false, error: 'message is required' });
  }

  if (!config.apiKey) {
    return res.status(500).json({ ok: false, error: 'LLM_API_KEY is not configured on the backend', errorCode: 'MISSING_API_KEY', config: await publicConfig() });
  }

  try {
    const result = await callProvider(prompt, messages, config);
    if (!result.ok) {
      const upstreamMessage = JSON.stringify(result.details || '').toLowerCase();
      const errorCode = upstreamMessage.includes('api key not valid') || upstreamMessage.includes('invalid api key') ? 'INVALID_API_KEY' : undefined;
      return res.status(result.status || 500).json({ ok: false, error: result.error, errorCode, details: result.details });
    }

    await logQuery({ intent_type: 'chat', handled_by: 'llm', original_query: prompt, normalized_query: normalizeQuery(prompt) });
    return res.json({ ok: true, provider: config.provider, model: config.model, reply: result.reply, raw: result.raw });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Failed to call LLM provider', details: error instanceof Error ? error.message : String(error) });
  }
});


app.get('/api/submissions', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const normalizedStatus = status.trim().toLowerCase();

  if (normalizedStatus && normalizedStatus !== 'approved' && !requireAdminReviewAccess(req)) {
    return res.status(401).json({ ok: false, error: 'Admin access required' });
  }

  if (!normalizedStatus && !requireAdminReviewAccess(req)) {
    return res.status(401).json({ ok: false, error: 'Admin access required' });
  }

  try {
    const submissions = await listSubmissions(normalizedStatus);
    return res.json({ ok: true, submissions });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Failed to load submissions', details: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/submissions', async (req, res) => {
  const { title, url, desc, category, categoryLabel = '', tag, email = '' } = req.body || {};
  const clean = {
    title: typeof title === 'string' ? title.trim() : '',
    url: typeof url === 'string' ? url.trim() : '',
    desc: typeof desc === 'string' ? desc.trim() : '',
    category: typeof category === 'string' ? category.trim() : '',
    categoryLabel: typeof categoryLabel === 'string' ? categoryLabel.trim() : '',
    tag: typeof tag === 'string' ? tag.trim() : '',
    email: typeof email === 'string' ? email.trim() : '',
  };

  if (!clean.title || !clean.url || !clean.desc || !clean.category || !clean.tag) {
    return res.status(400).json({ ok: false, error: 'title, url, desc, category, and tag are required' });
  }

  try {
    const submission = await createSubmission(clean);
    return res.status(201).json({ ok: true, submission });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Failed to create submission', details: error instanceof Error ? error.message : String(error) });
  }
});

app.patch('/api/submissions/:id', async (req, res) => {
  if (!requireAdminReviewAccess(req)) {
    return res.status(401).json({ ok: false, error: 'Admin access required' });
  }

  const id = String(req.params.id || '').trim();
  const status = typeof req.body?.status === 'string' ? req.body.status : '';
  if (!id || !['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'Valid submission id and status are required' });
  }

  try {
    const submission = await updateSubmissionStatus(id, status);
    if (!submission) {
      return res.status(404).json({ ok: false, error: 'Submission not found' });
    }
    return res.json({ ok: true, submission });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Failed to update submission', details: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/recommend', async (req, res) => {
  const { query, matches = [], userKey = '' } = req.body || {};
  const trimmedQuery = typeof query === 'string' ? query.trim() : '';
  const safeMatches = Array.isArray(matches)
    ? matches
      .filter(item => item && typeof item.title === 'string')
      .slice(0, 5)
      .map(item => ({ title: item.title, desc: item.desc || '', tag: item.tag || '', href: item.href || '', category: item.category || '' }))
    : [];

  if (!trimmedQuery || !safeMatches.length) {
    return res.status(400).json({ ok: false, error: 'query and matches are required' });
  }

  const cacheResult = await findCachedRecommendation(trimmedQuery);
  if (cacheResult.hit) {
    await logQuery({ user_key: userKey, intent_type: 'recommendation', handled_by: cacheResult.exact ? 'cache-exact' : 'cache-similar', original_query: trimmedQuery, normalized_query: normalizeQuery(trimmedQuery) });
    return res.json({ ok: true, source: cacheResult.exact ? 'cache-exact' : 'cache-similar', explanation: cacheResult.item.explanation_text, summary: cacheResult.item.answer_summary, resourceIds: cacheResult.item.resource_ids || [] });
  }

  const config = await getLlmConfig();
  if (!config.apiKey) {
    await logQuery({ user_key: userKey, intent_type: 'recommendation', handled_by: 'local-only', original_query: trimmedQuery, normalized_query: normalizeQuery(trimmedQuery) });
    return res.status(500).json({ ok: false, error: 'LLM_API_KEY is not configured on the backend', errorCode: 'MISSING_API_KEY', config: await publicConfig() });
  }

  try {
    const userMemory = await getUserMemory(userKey);
    const prompt = buildRecommendationPrompt(trimmedQuery, safeMatches, userMemory);
    const result = await callProvider(prompt, [], config);
    if (!result.ok) {
      const upstreamMessage = JSON.stringify(result.details || '').toLowerCase();
      const errorCode = upstreamMessage.includes('api key not valid') || upstreamMessage.includes('invalid api key') ? 'INVALID_API_KEY' : undefined;
      return res.status(result.status || 500).json({ ok: false, error: result.error, errorCode, details: result.details });
    }

    const explanation = result.reply.trim();
    const summary = explanation.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').trim() || explanation;
    const cached = await storeCachedRecommendation({ query: trimmedQuery, answerSummary: summary, explanationText: explanation, resourceIds: safeMatches.map(match => match.href || match.title) });

    await logQuery({ user_key: userKey, intent_type: 'recommendation', handled_by: 'llm-explanation', original_query: trimmedQuery, normalized_query: normalizeQuery(trimmedQuery) });
    return res.json({ ok: true, source: 'llm-fallback', explanation, summary, cacheId: cached.id, resourceIds: cached.resource_ids });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Failed to generate recommendation explanation', details: error instanceof Error ? error.message : String(error) });
  }
});

async function registerFrontendRoutes() {
  if (!shouldServeFrontend || !frontendDir || !frontendIndexFile) {
    return;
  }

  app.use(express.static(frontendDir));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(frontendIndexFile);
  });
}

async function initializeServices() {
  startupState.initStarted = true;
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await initDatabase();
    await migrateLegacyData();
    await ensureLlmConfigReadyAtStartup();
    startupState.ready = true;
    startupState.initError = '';
    console.log('[startup] Initialization completed successfully.');
  } catch (error) {
    startupState.ready = false;
    startupState.initError = error instanceof Error ? error.message : String(error);
    printStartupFailureHints(error);
    console.error('Failed to initialize StudentHelper backend services:', error);
  }
}

async function startServer() {
  printStartupDiagnostics();
  await registerFrontendRoutes();

  app.listen(port, () => {
    console.log(`StudentHelper backend listening on http://localhost:${port}`);
    if (shouldServeFrontend && frontendDir) {
      console.log(`Serving StudentHelper frontend from ${frontendDir}`);
    }
    if (!process.env.LLM_API_KEY && !process.env.LLM_GEMINI_CURL && !promptedApiKey && !promptedCurlConfig && isInteractivePromptAllowed()) {
      console.log('No backend LLM config is active. You can restart and enter an API key or Gemini curl command.');
    }
  });

  void initializeServices();
}

startServer().catch(error => {
  printStartupFailureHints(error);
  console.error('Failed to start StudentHelper backend:', error);
  process.exit(1);
});
