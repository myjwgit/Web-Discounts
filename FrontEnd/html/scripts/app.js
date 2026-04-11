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
