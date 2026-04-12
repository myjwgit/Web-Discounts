// ===== THEME TOGGLE =====
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;

const savedTheme = localStorage.getItem('theme') || 'dark';
html.setAttribute('data-theme', savedTheme);
themeToggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';

themeToggle.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    themeToggle.textContent = next === 'dark' ? '🌙' : '☀️';
});

// ===== SEARCH =====
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

// Build index from all cards in the DOM (script is at bottom of body, DOM is ready)
const allCards = [];
document.querySelectorAll('.category').forEach(section => {
    const catName = section.querySelector('h2').textContent.trim();
    section.querySelectorAll('.card').forEach(card => {
        allCards.push({
            title: card.querySelector('.card-title').textContent,
            desc: card.querySelector('.card-desc').textContent,
            tag: card.querySelector('.tag').textContent,
            href: card.href,
            category: catName,
        });
    });
});

function buildFaviconUrl(href) {
    try {
        const { hostname } = new URL(href);
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
    } catch {
        return '';
    }
}

function attachCardLogos(root = document) {
    root.querySelectorAll('.card[href]').forEach(card => {
        if (card.querySelector('.card-logo')) return;

        const logoUrl = buildFaviconUrl(card.href);
        if (!logoUrl) return;

        const title = card.querySelector('.card-title')?.textContent?.trim() || 'Website';
        const img = document.createElement('img');
        img.className = 'card-logo';
        img.src = logoUrl;
        img.alt = `${title} logo`;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.width = 42;
        img.height = 42;

        const firstChild = card.firstElementChild;
        if (firstChild) {
            card.insertBefore(img, firstChild);
        } else {
            card.appendChild(img);
        }
    });
}

attachCardLogos();

const API_BASE_STORAGE_KEY = 'studenthelper.apiBase';
const BACKEND_ENABLED_STORAGE_KEY = 'studenthelper.backendEnabled';

function isLocalHost() {
    return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function getBackendMode() {
    const saved = localStorage.getItem(BACKEND_ENABLED_STORAGE_KEY);
    if (saved === 'true' || saved === 'false') return saved;

    const meta = document.querySelector('meta[name="studenthelper-backend-enabled"]');
    if (meta && meta.content.trim()) return meta.content.trim().toLowerCase();

    return 'auto';
}

function isBackendEnabled() {
    const mode = getBackendMode();
    if (mode === 'true' || mode === 'enabled' || mode === 'on') return true;
    if (mode === 'false' || mode === 'disabled' || mode === 'off') return false;
    return isLocalHost();
}

function getBackendApiBase() {
    if (!isBackendEnabled()) return '';

    const saved = localStorage.getItem(API_BASE_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim().replace(/\/$/, '');

    const meta = document.querySelector('meta[name="studenthelper-api-base"]');
    const metaBase = meta && meta.content.trim() ? meta.content.trim().replace(/\/$/, '') : '';

    // In combined deployments such as Back4App, default to same-origin unless an explicit remote API base is configured.
    if (!isLocalHost()) {
        if (!metaBase || /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(metaBase)) {
            return window.location.origin;
        }
    }

    if (metaBase) return metaBase;

    return 'http://127.0.0.1:8080';
}

function formatMultilineText(value) {
    return escHtml(String(value || '')).replace(/\n+/g, '<br>');
}

function isApiKeyError(payload) {
    const combined = [payload?.errorCode, payload?.error, JSON.stringify(payload?.details || '')]
        .join(' ')
        .toLowerCase();

    return combined.includes('invalid_api_key')
        || combined.includes('missing_api_key')
        || combined.includes('api key not valid')
        || combined.includes('invalid api key')
        || combined.includes('llm_api_key is not configured');
}

async function requestSubmissions(status = '', options = {}) {
    const apiBase = getBackendApiBase();
    if (!apiBase) return { ok: false, errorCode: 'BACKEND_DISABLED' };

    try {
        const query = status ? `?status=${encodeURIComponent(status)}` : '';
        const response = await fetch(apiBase + '/api/submissions' + query, {
            headers: options.adminPassword ? { 'x-admin-password': options.adminPassword } : undefined,
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.ok) return { ok: true, submissions: payload.submissions || [] };
        return { ok: false, error: payload.error || 'Failed to load submissions' };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Network request failed' };
    }
}

async function createSubmissionOnBackend(submission) {
    const apiBase = getBackendApiBase();
    if (!apiBase) return { ok: false, errorCode: 'BACKEND_DISABLED' };

    try {
        const response = await fetch(apiBase + '/api/submissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submission),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.ok) return { ok: true, submission: payload.submission };
        return { ok: false, error: payload.error || 'Failed to create submission' };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Network request failed' };
    }
}

async function updateSubmissionStatusOnBackend(id, status, adminPassword) {
    const apiBase = getBackendApiBase();
    if (!apiBase) return { ok: false, errorCode: 'BACKEND_DISABLED' };

    try {
        const response = await fetch(apiBase + `/api/submissions/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-password': adminPassword,
            },
            body: JSON.stringify({ status }),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.ok) return { ok: true, submission: payload.submission };
        return { ok: false, error: payload.error || 'Failed to update submission' };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Network request failed' };
    }
}

const knownQueryWords = new Set(
    allCards.flatMap(card => [card.title, card.desc, card.tag, card.category])
        .join(' ')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(word => word.length >= 3)
);

[
    'show', 'find', 'open', 'take', 'help', 'need', 'want', 'best', 'good', 'student', 'students',
    'resource', 'resources', 'tool', 'tools', 'app', 'apps', 'website', 'websites', 'discount', 'discounts',
    'study', 'coding', 'design', 'scholarship', 'scholarships', 'note', 'notes', 'productivity', 'search',
    'assistant', 'for', 'with', 'about', 'where', 'what', 'how', 'why', 'can', 'please', 'looking', 'recommend'
].forEach(word => knownQueryWords.add(word));

function isLikelyGibberishQuery(value) {
    const normalized = normalizeChatbotText(value);
    const tokens = normalized.split(' ').filter(Boolean);

    if (!tokens.length) return false;
    if (tokens.some(token => knownQueryWords.has(token))) return false;
    if (tokens.some(token => /\d/.test(token) || token.includes('http'))) return false;
    if (tokens.some(token => token.length <= 2)) return false;
    if (!tokens.every(token => /^[a-z]+$/.test(token))) return false;

    return tokens.length <= 3;
}

async function requestServerAnswer(prompt, source) {
    const apiBase = getBackendApiBase();
    if (!apiBase) {
        return {
            ok: false,
            error: 'Backend disabled in static mode',
            errorCode: 'BACKEND_DISABLED',
        };
    }

    try {
        const response = await fetch(apiBase + '/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: prompt, source }),
        });

        const payload = await response.json().catch(() => ({}));

        if (response.ok && payload.ok) {
            return {
                ok: true,
                reply: payload.reply || '',
                model: payload.model || '',
                provider: payload.provider || '',
            };
        }

        return {
            ok: false,
            error: payload.error || 'Backend request failed',
            errorCode: payload.errorCode || '',
            details: payload.details || null,
        };
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : 'Network request failed',
        };
    }
}

function shouldRequestRecommendationExplanation(query, matches) {
    const normalized = normalizeChatbotText(query);
    const tokens = normalized.split(' ').filter(Boolean);
    if (tokens.length < 2) return false;
    if (!matches.length) return false;
    if (isLikelyGibberishQuery(query)) return false;

    return tokens.length >= 3 || /(best|recommend|compare|should|why|help|good|budget|first)/i.test(query);
}

async function requestRecommendationExplanation(query, matches) {
    const apiBase = getBackendApiBase();
    if (!apiBase) {
        return {
            ok: false,
            error: 'Backend disabled in static mode',
            errorCode: 'BACKEND_DISABLED',
        };
    }

    try {
        const response = await fetch(apiBase + '/api/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, matches }),
        });

        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.ok) {
            return {
                ok: true,
                explanation: payload.explanation || '',
                summary: payload.summary || '',
                source: payload.source || '',
            };
        }

        return {
            ok: false,
            error: payload.error || 'Recommendation request failed',
            errorCode: payload.errorCode || '',
        };
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : 'Network request failed',
        };
    }
}

function renderRecommendationExplanationCard(payload, state = 'ready') {
    if (state === 'loading') {
        return `
            <section class="assistant-explanation-card assistant-explanation-loading" aria-live="polite">
              <div class="assistant-explanation-header">
                <div>
                  <span class="assistant-explanation-eyebrow">AI Explanation</span>
                  <strong>Adding product-style guidance</strong>
                </div>
                <span class="assistant-explanation-pill">Thinking</span>
              </div>
              <div class="assistant-explanation-skeleton"></div>
              <div class="assistant-explanation-skeleton short"></div>
            </section>
        `;
    }

    if (state === 'error') {
        return `
            <section class="assistant-explanation-card assistant-explanation-error">
              <div class="assistant-explanation-header">
                <div>
                  <span class="assistant-explanation-eyebrow">AI Explanation</span>
                  <strong>Local picks are still ready</strong>
                </div>
                <span class="assistant-explanation-pill muted">Offline</span>
              </div>
              <p class="assistant-explanation-body">The assistant kept the local recommendations, but cloud explanation is unavailable in this static demo mode.</p>
            </section>
        `;
    }

    return `
        <section class="assistant-explanation-card">
          <div class="assistant-explanation-header">
            <div>
              <span class="assistant-explanation-eyebrow">AI Explanation</span>
              <strong>Why these are strong matches</strong>
            </div>
            <span class="assistant-explanation-pill">${escHtml(payload.source || 'LLM')}</span>
          </div>
          <p class="assistant-explanation-body">${formatMultilineText(payload.explanation || payload.summary || '')}</p>
        </section>
    `;
}
function renderResults(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
        searchResults.classList.add('hidden');
        searchResults.innerHTML = '';
        return;
    }

    const matches = allCards.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.desc.toLowerCase().includes(q) ||
        c.tag.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );

    if (matches.length === 0) {
        searchResults.innerHTML = '<div class="search-no-results">No results found.</div>';
    } else {
        searchResults.innerHTML = matches.map(c => `
      <a class="search-result-item" href="${escHtml(c.href)}" target="_blank" rel="noopener">
        <div class="r-title">${escHtml(c.title)}</div>
        <div class="r-desc">${escHtml(c.desc)}</div>
        <div class="r-cat">${escHtml(c.category)} · ${escHtml(c.tag)}</div>
      </a>
    `).join('');
    }

    searchResults.classList.remove('hidden');
}

searchInput.addEventListener('input', e => {
    clearTimeout(searchInput._debounceTimer);
    searchInput._debounceTimer = setTimeout(() => renderResults(e.target.value), 200);
});

// Close search results when clicking outside
document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) {
        searchResults.classList.add('hidden');
    }
});

searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) renderResults(searchInput.value);
});

// ===== ASSISTANT =====
const assistantMessages = document.getElementById('assistantMessages');
const assistantForm = document.getElementById('assistantForm');
const assistantInput = document.getElementById('assistantInput');
const assistantPromptButtons = document.querySelectorAll('[data-chat-prompt]');

const assistantFallbacks = [
    'Try asking for a category, a task, or a type of discount. For example: "free note apps", "coding interview prep", or "food discounts".',
    'I can recommend tools already on this page. Ask for study help, AI writing tools, coding sites, design resources, or student discounts.',
];

function scoreCardForQuery(card, query) {
    const q = query.toLowerCase().trim();
    if (!q) return 0;

    const haystack = [card.title, card.desc, card.tag, card.category].join(' ').toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    let score = 0;

    tokens.forEach(token => {
        if (card.title.toLowerCase().includes(token)) score += 5;
        if (card.tag.toLowerCase().includes(token)) score += 4;
        if (card.category.toLowerCase().includes(token)) score += 3;
        if (card.desc.toLowerCase().includes(token)) score += 2;
        if (haystack.includes(token)) score += 1;
    });

    const intentBoosts = [
        { terms: ['essay', 'write', 'writing', 'grammar'], match: ['Writing', 'AI Tools', 'Notes'] },
        { terms: ['code', 'coding', 'developer', 'interview'], match: ['Coding', 'AI Tools'] },
        { terms: ['discount', 'deal', 'save', 'cheap'], match: ['Discounts'] },
        { terms: ['notes', 'note', 'flashcard', 'study'], match: ['Study', 'Notes'] },
        { terms: ['design', 'portfolio', 'creative'], match: ['Design'] },
    ];

    intentBoosts.forEach(({ terms, match }) => {
        if (terms.some(term => q.includes(term)) && match.some(fragment => card.category.includes(fragment) || card.tag.includes(fragment))) {
            score += 6;
        }
    });

    return score;
}

function buildAssistantReply(query) {
    const ranked = allCards
        .map(card => ({ card, score: scoreCardForQuery(card, query) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    if (!ranked.length) {
        return {
            intro: '',
            matches: [],
            scoredMatches: [],
            shouldAskServer: true,
            shouldExplain: false,
        };
    }

    const lead = query.toLowerCase().includes('discount')
        ? 'These look like the strongest discount-related picks from the current directory.'
        : 'These are the closest matches I found from the current StudentHelper list.';

    return {
        intro: lead,
        matches: ranked.map(({ card }) => card),
        scoredMatches: ranked,
        shouldAskServer: false,
        shouldExplain: shouldRequestRecommendationExplanation(query, ranked.map(({ card }) => card)),
    };
}

function appendAssistantMessage(kind, html) {
    const article = document.createElement('article');
    article.className = `assistant-message ${kind}`;
    article.innerHTML = html;
    assistantMessages.appendChild(article);
    assistantMessages.scrollTop = assistantMessages.scrollHeight;
    return article;
}

async function renderAssistantResponse(query) {
    const trimmed = query.trim();
    if (!trimmed) return;

    appendAssistantMessage('user', `<p>${escHtml(trimmed)}</p>`);

    const response = buildAssistantReply(trimmed);
    if (!response.shouldAskServer) {
        const recs = `<div class="assistant-recommendations">${response.matches.map(card => `
            <a class="assistant-link" href="${escHtml(card.href)}" target="_blank" rel="noopener">
              <strong>${escHtml(card.title)}</strong>
              <span>${escHtml(card.category)} · ${escHtml(card.tag)}</span>
            </a>
          `).join('')}</div>`;
        const message = appendAssistantMessage('bot', `<p>${escHtml(response.intro)}</p>${recs}`);

        if (response.shouldExplain) {
            const explanation = document.createElement('div');
            explanation.className = 'assistant-explanation-shell';
            explanation.innerHTML = renderRecommendationExplanationCard({}, 'loading');
            message.appendChild(explanation);

            const explanationReply = await requestRecommendationExplanation(trimmed, response.matches);
            if (explanationReply.ok && explanationReply.explanation) {
                explanation.innerHTML = renderRecommendationExplanationCard(explanationReply, 'ready');
            } else {
                explanation.innerHTML = renderRecommendationExplanationCard({}, 'error');
            }
        }

        return;
    }

    if (isLikelyGibberishQuery(trimmed)) {
        appendAssistantMessage('bot', '<p>That looks like random text, so I did not send it to the backend. Try a real need like "best note apps" or "student discounts for food".</p>');
        return;
    }

    const loading = appendAssistantMessage('bot', '<p>I could not solve that locally, so I am asking the backend assistant...</p>');
    const serverReply = await requestServerAnswer(trimmed, 'assistant');

    if (!serverReply.ok) {
        const backendNote = serverReply.errorCode === 'BACKEND_DISABLED'
            ? 'GitHub Pages static mode is enabled, so only local recommendations are available.'
            : serverReply.errorCode === 'MISSING_API_KEY'
                ? 'AI service is not configured on the backend.'
                : (serverReply.error || 'unknown error');
        loading.innerHTML = `<p>${escHtml(assistantFallbacks[Math.floor(Math.random() * assistantFallbacks.length)])}</p><p><small>Backend unavailable: ${escHtml(backendNote)}</small></p>`;
        return;
    }

    loading.innerHTML = `<p>${formatMultilineText(serverReply.reply)}</p><p><small>Answered by backend${serverReply.model ? ` · ${escHtml(serverReply.model)}` : ''}</small></p>`;
}

if (assistantMessages && assistantForm && assistantInput) {
    assistantForm.addEventListener('submit', e => {
        e.preventDefault();
        renderAssistantResponse(assistantInput.value);
        assistantInput.value = '';
        assistantInput.focus();
    });

    assistantPromptButtons.forEach(button => {
        button.addEventListener('click', () => {
            const prompt = button.dataset.chatPrompt || '';
            assistantInput.value = prompt;
            renderAssistantResponse(prompt);
            assistantInput.value = '';
        });
    });
}
// ===== SUBMISSION SYSTEM =====
const ADMIN_PASSWORD_HASH = '8d969eef6ecad3c29a3a873fba8a4f7e04a799735ac974da718d582052d42902'; // SHA-256 of 'studenthelper2024'
const ADMIN_PASSWORD = '404 team name not found';
const STORAGE_KEY = 'sh_submissions';

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getSubmissions() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
}
function saveSubmissions(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getLegacyMergedSubmissions() {
    const shSubs = JSON.parse(localStorage.getItem('sh_submissions') || '[]');
    const subSubs = JSON.parse(localStorage.getItem('submissions') || '[]');
    const map = {};
    [...shSubs, ...subSubs].forEach(s => { map[s.id] = s; });
    return Object.values(map);
}

// ---- FAB & Modal open/close ----
const fabSubmit = document.getElementById('fabSubmit');
const submitOverlay = document.getElementById('submitOverlay');
const modalClose = document.getElementById('modalClose');
const adminOverlay = document.getElementById('adminOverlay');
const adminClose = document.getElementById('adminClose');

fabSubmit.addEventListener('click', () => submitOverlay.classList.remove('hidden'));
modalClose.addEventListener('click', closeSubmitModal);
submitOverlay.addEventListener('click', e => { if (e.target === submitOverlay) closeSubmitModal(); });
adminClose.addEventListener('click', () => adminOverlay.classList.add('hidden'));
adminOverlay.addEventListener('click', e => { if (e.target === adminOverlay) adminOverlay.classList.add('hidden'); });

function closeSubmitModal() {
    submitOverlay.classList.add('hidden');
    resetForm();
}

function resetForm() {
    document.getElementById('submitForm').reset();
    document.getElementById('descCount').textContent = '0 / 160';
    document.getElementById('formError').classList.add('hidden');
    document.getElementById('formSuccess').classList.add('hidden');
    document.getElementById('submitForm').classList.remove('hidden');
}

// ---- Char counter ----
const descField = document.getElementById('f-desc');
descField.addEventListener('input', () => {
    document.getElementById('descCount').textContent = `${descField.value.length} / 160`;
});

// ---- Form submit ----
document.getElementById('submitForm').addEventListener('submit', async e => {
    e.preventDefault();
    const title = document.getElementById('f-title').value.trim();
    const url = document.getElementById('f-url').value.trim();
    const desc = document.getElementById('f-desc').value.trim();
    const category = document.getElementById('f-category').value;
    const tag = document.getElementById('f-tag').value.trim();
    const email = document.getElementById('f-email').value.trim();
    const errEl = document.getElementById('formError');

    // Check rate limit (max 3 per hour)
    const lastSubmissions = getSubmissions().filter(s => {
        const age = Date.now() - new Date(s.submittedAt).getTime();
        return age < 60 * 60 * 1000;
    });
    if (lastSubmissions.length >= 3) {
        errEl.textContent = 'Rate limit: max 3 submissions per hour. Please try again later.';
        errEl.classList.remove('hidden');
        return;
    }

    if (!title || !url || !desc || !category || !tag) {
        errEl.textContent = 'Please fill in all required fields.';
        errEl.classList.remove('hidden');
        return;
    }
    try { new URL(url); } catch {
        errEl.textContent = 'Please enter a valid URL (include https://).';
        errEl.classList.remove('hidden');
        return;
    }
    errEl.classList.add('hidden');

    const submission = {
        title, url, desc, category, categoryLabel: category, tag, email,
    };

    const backendResult = await createSubmissionOnBackend(submission);
    if (backendResult.ok && backendResult.submission) {
        const merged = getSubmissions();
        merged.push(backendResult.submission);
        saveSubmissions(merged);
    } else {
        const fallback = {
            id: Date.now().toString(),
            title, url, desc, category, categoryLabel: category, tag, email,
            status: 'pending',
            submittedAt: new Date().toISOString(),
        };
        const all = getSubmissions();
        all.push(fallback);
        saveSubmissions(all);
    }

    document.getElementById('submitForm').classList.add('hidden');
    document.getElementById('formSuccess').classList.remove('hidden');
});

document.getElementById('submitAnother').addEventListener('click', resetForm);

// ---- Admin login ----
const adminLoginBtn = document.getElementById('adminLoginBtn');
adminLoginBtn.addEventListener('click', async () => {
    const pw = document.getElementById('adminPassword').value;
    const pwHash = await hashPassword(pw);
    if (pwHash === ADMIN_PASSWORD_HASH) {
        document.getElementById('adminLogin').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        sessionStorage.setItem('adminUnlockTime', Date.now() + 30 * 60 * 1000); // 30 min timeout
        await renderAdminPanel('pending');
    } else {
        document.getElementById('adminLoginError').classList.remove('hidden');
    }
});
document.getElementById('adminPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') adminLoginBtn.click();
});

// ---- Admin panel render ----
async function renderAdminPanel(filter = 'pending') {
    // Check session timeout
    const unlockTime = sessionStorage.getItem('adminUnlockTime');
    if (!unlockTime || Date.now() > parseInt(unlockTime)) {
        adminOverlay.classList.add('hidden');
        document.getElementById('adminLogin').classList.remove('hidden');
        document.getElementById('adminPanel').classList.add('hidden');
        document.getElementById('adminPassword').value = '';
        sessionStorage.removeItem('adminUnlockTime');
        return;
    }

    let all = [];
    const backendResult = await requestSubmissions('', { adminPassword: ADMIN_PASSWORD });
    if (backendResult.ok) {
        all = backendResult.submissions || [];
        saveSubmissions(all);
    } else {
        all = getLegacyMergedSubmissions();
    }
    const pending = all.filter(s => s.status === 'pending');
    const approved = all.filter(s => s.status === 'approved');
    const rejected = all.filter(s => s.status === 'rejected');

    document.getElementById('adminStats').innerHTML = `
    <span class="stat-pill">📥 Pending: ${pending.length}</span>
    <span class="stat-pill">✅ Approved: ${approved.length}</span>
    <span class="stat-pill">❌ Rejected: ${rejected.length}</span>
  `;

    const filtered = all.filter(s => s.status === filter);

    document.getElementById('adminQueue').innerHTML = `
    <div class="admin-tabs">
      <button class="admin-tab ${filter === 'pending' ? 'active' : ''}" onclick="renderAdminPanel('pending')">Pending (${pending.length})</button>
      <button class="admin-tab ${filter === 'approved' ? 'active' : ''}" onclick="renderAdminPanel('approved')">Approved (${approved.length})</button>
      <button class="admin-tab ${filter === 'rejected' ? 'active' : ''}" onclick="renderAdminPanel('rejected')">Rejected (${rejected.length})</button>
    </div>
    ${filtered.length === 0
            ? `<div class="admin-empty">No ${filter} submissions.</div>`
            : filtered.map(s => `
        <div class="submission-card ${s.status}" id="sub-${s.id}">
          <div class="sub-header">
            <div>
              <div class="sub-title">${escHtml(s.title)}</div>
              <div class="sub-url"><a href="${escHtml(s.url)}" target="_blank" rel="noopener">${escHtml(s.url)}</a></div>
            </div>
            <span class="status-badge ${s.status}">${s.status}</span>
          </div>
          <div class="sub-meta">
            <span>📂 ${escHtml(s.category)}</span>
            <span>🏷 ${escHtml(s.tag)}</span>
            ${s.email ? `<span>✉️ ${escHtml(s.email)}</span>` : ''}
            <span>🕐 ${new Date(s.submittedAt).toLocaleDateString()}</span>
          </div>
          <div class="sub-desc">${escHtml(s.desc)}</div>
          ${s.status === 'pending' ? `
          <div class="sub-actions">
            <button class="btn-approve" onclick="reviewSubmission('${s.id}', 'approved')">✅ Approve</button>
            <button class="btn-reject" onclick="reviewSubmission('${s.id}', 'rejected')">❌ Reject</button>
          </div>` : ''}
        </div>
      `).join('')
        }
  `;
}

window.reviewSubmission = async function (id, status) {
    const backendResult = await updateSubmissionStatusOnBackend(id, status, ADMIN_PASSWORD);
    if (!backendResult.ok) {
        const all = getSubmissions();
        const idx = all.findIndex(s => s.id === id);
        if (idx === -1) return;
        all[idx].status = status;
        saveSubmissions(all);
    }
    renderAdminPanel('pending');
    await renderApprovedCommunityCards();
};

function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---- Render approved community cards into their sections ----
async function renderApprovedCommunityCards() {
    document.querySelectorAll('.community-card').forEach(el => el.remove());

    let approved = [];
    const backendResult = await requestSubmissions('approved');
    if (backendResult.ok) {
        approved = backendResult.submissions || [];
    } else {
        approved = getLegacyMergedSubmissions().filter(s => s.status === 'approved');
    }
    if (!approved.length) return;

    // Map both slug and display name to section id
    const catMap = {
        // slugs (from submit.html)
        'study-tools':  'study-tools',
        'ai-tools':     'ai-tools',
        'productivity': 'productivity',
        'note-taking':  'note-taking',
        'coding':       'coding',
        'design':       'design',
        'scholarships': 'scholarships',
        'learning':     'learning',
        'discounts':    'discounts',
        'useful':       'useful',
        // display names (from index.html modal)
        'Study Tools':                    'study-tools',
        'AI Tools':                       'ai-tools',
        'Productivity Tools':             'productivity',
        'Note-Taking Apps':               'note-taking',
        'Coding Resources':               'coding',
        'Design Resources':               'design',
        'Scholarship / Internship Resources': 'scholarships',
        'Free Learning Websites':         'learning',
        'Student Discounts':              'discounts',
        'Useful Websites':                'useful',
    };

    approved.forEach(s => {
        const sectionId = catMap[s.category] || catMap[s.categoryLabel];
        if (!sectionId) return;
        const grid = document.querySelector(`#${sectionId} .cards`);
        if (!grid) return;

        const a = document.createElement('a');
        a.className = 'card community-card';
        a.href = s.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.innerHTML = `
      <div class="card-title">${escHtml(s.title)} <span class="community-badge">👥 Community</span></div>
      <div class="card-desc">${escHtml(s.desc)}</div>
      <span class="tag">${escHtml(s.tag)}</span>
    `;
        grid.appendChild(a);
    });
}

// Run on load
renderApprovedCommunityCards().then(() => attachCardLogos());

// ---- Reviews nav button ----
const reviewsNavBtn = document.getElementById('reviewsNavBtn');
const reviewsOverlay = document.getElementById('reviewsOverlay');
const reviewsClose = document.getElementById('reviewsClose');
const reviewsLoginBtn = document.getElementById('reviewsLoginBtn');

reviewsNavBtn.addEventListener('click', (e) => {
    e.preventDefault();
    reviewsOverlay.classList.remove('hidden');
    document.getElementById('reviewsPassword').value = '';
    document.getElementById('reviewsLoginError').classList.add('hidden');
});

reviewsClose.addEventListener('click', () => reviewsOverlay.classList.add('hidden'));
reviewsOverlay.addEventListener('click', e => { if (e.target === reviewsOverlay) reviewsOverlay.classList.add('hidden'); });

reviewsLoginBtn.addEventListener('click', () => {
    const pw = document.getElementById('reviewsPassword').value;
    if (pw === ADMIN_PASSWORD) {
        reviewsOverlay.classList.add('hidden');
        window.location.href = 'reviews.html';
    } else {
        document.getElementById('reviewsLoginError').classList.remove('hidden');
    }
});

document.getElementById('reviewsPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') reviewsLoginBtn.click();
});

// ===== NAVIGATION CHATBOT =====
const chatbotTrigger = document.getElementById('chatbotTrigger');
const chatbotPanel = document.getElementById('chatbotPanel');
const chatbotClose = document.getElementById('chatbotClose');
const chatbotMessages = document.getElementById('chatbotMessages');
const chatbotForm = document.getElementById('chatbotForm');
const chatbotInput = document.getElementById('chatbotInput');
const chatbotChips = document.querySelectorAll('[data-chatbot-prompt]');

const chatbotRoutes = [
    { keywords: ['discount', 'deal', 'save money'], action: () => navigateToSection('discounts', 'Opened the student discounts section.') },
    { keywords: ['ai', 'artificial intelligence', 'chatgpt'], action: () => navigateToSection('ai-tools', 'Here are the AI tools.') },
    { keywords: ['study', 'flashcard', 'exam'], action: () => navigateToSection('study-tools', 'Jumped to study tools.') },
    { keywords: ['productivity', 'focus', 'calendar', 'task'], action: () => navigateToSection('productivity', 'Opened productivity tools.') },
    { keywords: ['note', 'notes', 'notetaking'], action: () => navigateToSection('note-taking', 'Here are the note-taking apps.') },
    { keywords: ['coding', 'developer', 'programming'], action: () => navigateToSection('coding', 'Opened coding resources.') },
    { keywords: ['design', 'figma', 'creative'], action: () => navigateToSection('design', 'Opened design resources.') },
    { keywords: ['scholarship', 'internship', 'grant'], action: () => navigateToSection('scholarships', 'Opened scholarships and internship resources.') },
    { keywords: ['learning', 'course', 'tutorial'], action: () => navigateToSection('learning', 'Opened free learning websites.') },
    { keywords: ['useful', 'website', 'tool'], action: () => navigateToSection('useful', 'Opened useful websites.') },
    { keywords: ['review', 'reviews'], action: () => openReviewsAccess() },
    { keywords: ['submit', 'add resource', 'suggest resource'], action: () => openSubmitPage() },
];

if (chatbotTrigger && chatbotPanel && chatbotMessages && chatbotForm && chatbotInput) {
    addChatbotMessage('bot', 'Hi. I can help you navigate this site. Ask for a section, or say something like "search for design".');

    chatbotTrigger.addEventListener('click', () => {
        chatbotPanel.classList.remove('hidden');
        chatbotInput.focus();
    });

    chatbotClose.addEventListener('click', () => chatbotPanel.classList.add('hidden'));

    chatbotForm.addEventListener('submit', event => {
        event.preventDefault();
        const prompt = chatbotInput.value.trim();
        if (!prompt) return;
        chatbotInput.value = '';
        handleChatbotPrompt(prompt);
    });

    chatbotChips.forEach(chip => {
        chip.addEventListener('click', () => handleChatbotPrompt(chip.dataset.chatbotPrompt || ''));
    });
}

async function handleChatbotPrompt(prompt) {
    const normalized = normalizeChatbotText(prompt);
    addChatbotMessage('user', escHtml(prompt));

    if (!normalized) {
        addChatbotMessage('bot', 'Try asking for discounts, AI tools, scholarships, submit page, or a search topic.');
        return;
    }

    if (normalized.startsWith('search ') || normalized.startsWith('find ')) {
        const query = prompt.replace(/^(search|find)\s+/i, '').trim();
        if (query) {
            searchInput.value = query;
            renderResults(query);
            searchInput.focus();
            addChatbotMessage('bot', `I searched for <strong>${escHtml(query)}</strong> in the resource index.`);
            return;
        }
    }

    const matchedRoute = chatbotRoutes.find(route => route.keywords.some(keyword => normalized.includes(keyword)));
    if (matchedRoute) {
        matchedRoute.action();
        return;
    }

    const fallbackTerm = ['scholarship', 'discount', 'design', 'coding', 'note', 'study', 'productivity', 'ai']
        .find(term => normalized.includes(term));

    if (fallbackTerm) {
        searchInput.value = fallbackTerm;
        renderResults(fallbackTerm);
        searchInput.focus();
        addChatbotMessage('bot', `I could not map that to one page, so I searched for <strong>${escHtml(fallbackTerm)}</strong> instead.`);
        return;
    }

    if (isLikelyGibberishQuery(prompt)) {
        addChatbotMessage('bot', 'That looks like random text, so I did not send it to the backend. Try asking for a section or a real task.');
        return;
    }

    const loadingBubble = addChatbotMessage('bot', 'I could not solve that locally, so I am asking the backend assistant...');
    const serverReply = await requestServerAnswer(prompt, 'navigator');

    if (!serverReply.ok) {
        const backendNote = serverReply.errorCode === 'BACKEND_DISABLED'
            ? 'Static demo mode is active, so navigator fallback stays local.'
            : serverReply.errorCode === 'MISSING_API_KEY'
                ? 'AI service is not configured on the backend.'
                : (serverReply.error || 'unknown error');
        loadingBubble.innerHTML = `I can navigate to discounts, AI tools, study tools, scholarships, useful websites, reviews, or the submit page. You can also say "search for notebooks".<br><small>Backend unavailable: ${escHtml(backendNote)}</small>`;
        return;
    }

    loadingBubble.innerHTML = `${formatMultilineText(serverReply.reply)}${serverReply.model ? `<br><small>Answered by backend · ${escHtml(serverReply.model)}</small>` : ''}`;
}

function navigateToSection(sectionId, reply) {
    const target = document.getElementById(sectionId);
    if (!target) {
        addChatbotMessage('bot', 'That section is not available on this page.');
        return;
    }

    chatbotPanel.classList.remove('hidden');
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    addChatbotMessage('bot', `${escHtml(reply)} <a class="chatbot-link" href="#${escHtml(sectionId)}">Open section</a>`);
}

function openSubmitPage() {
    addChatbotMessage('bot', 'Opening the submit page. <a class="chatbot-link" href="submit.html">Open submit</a>');
    window.location.href = 'submit.html';
}

function openReviewsAccess() {
    reviewsOverlay.classList.remove('hidden');
    document.getElementById('reviewsPassword').value = '';
    document.getElementById('reviewsLoginError').classList.add('hidden');
    addChatbotMessage('bot', 'Opened the reviews access dialog. Enter the password to continue.');
}

function addChatbotMessage(role, content) {
    const bubble = document.createElement('div');
    bubble.className = `chatbot-bubble ${role}`;
    bubble.innerHTML = content;
    chatbotMessages.appendChild(bubble);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    return bubble;
}

function normalizeChatbotText(value) {
    return value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}
// ---- Secret admin access: type "admin" anywhere ----
let adminKeyBuffer = '';
document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    adminKeyBuffer += e.key.toLowerCase();
    if (adminKeyBuffer.length > 5) adminKeyBuffer = adminKeyBuffer.slice(-5);
    if (adminKeyBuffer === 'admin') {
        adminOverlay.classList.remove('hidden');
        document.getElementById('adminLogin').classList.remove('hidden');
        document.getElementById('adminPanel').classList.add('hidden');
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminLoginError').classList.add('hidden');
        adminKeyBuffer = '';
    }
});




