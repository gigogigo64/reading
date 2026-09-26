const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

searchInput.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const q = searchInput.value.trim();
  if (!q) return;

  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&bookId=${window.readerBookId}`);
  const rows = await res.json();
  searchResults.innerHTML = '';

  if (!rows.length) {
    searchResults.innerHTML = '<li>未找到匹配结果</li>';
    return;
  }

  rows.forEach((row) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${row.chapter_title || ''}</strong><br />${row.snippet}`;
    li.addEventListener('click', () => window.jumpToSearchHit(row.chapter_idx, q));
    searchResults.appendChild(li);
  });
});
