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

// Build index from all cards in the DOM
let allCards = [];

// Wait for DOM to be ready before building search index
document.addEventListener('DOMContentLoaded', () => {
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
});

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
      <a class="search-result-item" href="${c.href}" target="_blank" rel="noopener">
        <div class="r-title">${c.title}</div>
        <div class="r-desc">${c.desc}</div>
        <div class="r-cat">${c.category} · ${c.tag}</div>
      </a>
    `).join('');
    }

    searchResults.classList.remove('hidden');
}

searchInput.addEventListener('input', e => renderResults(e.target.value));

// Close search results when clicking outside
document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) {
        searchResults.classList.add('hidden');
    }
});

searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) renderResults(searchInput.value);
});

// ===== SUBMISSION SYSTEM =====
const ADMIN_PASSWORD = 'studenthelper2024'; // change this
const STORAGE_KEY = 'sh_submissions';

function getSubmissions() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
}
function saveSubmissions(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
document.getElementById('submitForm').addEventListener('submit', e => {
    e.preventDefault();
    const title = document.getElementById('f-title').value.trim();
    const url = document.getElementById('f-url').value.trim();
    const desc = document.getElementById('f-desc').value.trim();
    const category = document.getElementById('f-category').value;
    const tag = document.getElementById('f-tag').value.trim();
    const email = document.getElementById('f-email').value.trim();
    const errEl = document.getElementById('formError');

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
        id: Date.now().toString(),
        title, url, desc, category, tag, email,
        status: 'pending',
        submittedAt: new Date().toISOString(),
    };

    const all = getSubmissions();
    all.push(submission);
    saveSubmissions(all);

    document.getElementById('submitForm').remove();
    document.getElementById('formSuccess').classList.remove('hidden');
});

document.getElementById('submitAnother').addEventListener('click', resetForm);

// ---- Admin login ----
const adminLoginBtn = document.getElementById('adminLoginBtn');
adminLoginBtn.addEventListener('click', () => {
    const pw = document.getElementById('adminPassword').value;
    if (pw === ADMIN_PASSWORD) {
        document.getElementById('adminLogin').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        renderAdminPanel('pending');
    } else {
        document.getElementById('adminLoginError').classList.remove('hidden');
    }
});
document.getElementById('adminPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') adminLoginBtn.click();
});

// ---- Admin panel render ----
function renderAdminPanel(filter = 'pending') {
    const all = getSubmissions();
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

window.reviewSubmission = function (id, status) {
    const all = getSubmissions();
    const idx = all.findIndex(s => s.id === id);
    if (idx === -1) return;
    all[idx].status = status;
    saveSubmissions(all);
    renderAdminPanel(status === 'approved' ? 'pending' : 'pending');
    renderApprovedCommunityCards();
};

function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---- Render approved community cards into their sections ----
function renderApprovedCommunityCards() {
    // Remove previously injected community cards
    document.querySelectorAll('.community-card').forEach(el => el.remove());

    const approved = getSubmissions().filter(s => s.status === 'approved');
    if (!approved.length) return;

    // Map category name to section id
    const catMap = {
        'Study Tools': 'study-tools',
        'AI Tools': 'ai-tools',
        'Productivity Tools': 'productivity',
        'Note-Taking Apps': 'note-taking',
        'Coding Resources': 'coding',
        'Design Resources': 'design',
        'Scholarship / Internship Resources': 'scholarships',
        'Free Learning Websites': 'learning',
        'Student Discounts': 'discounts',
        'Useful Websites': 'useful',
    };

    approved.forEach(s => {
        const sectionId = catMap[s.category];
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
renderApprovedCommunityCards();

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
