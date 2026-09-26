const SPINE_COLORS = ['#3b4a6b', '#4a6741', '#a67c52', '#55534c', '#8c3a4b', '#2f3b52', '#6b5b3e'];

function spineColorFor(title) {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  }
  return SPINE_COLORS[hash % SPINE_COLORS.length];
}

async function fetchBooks() {
  const res = await fetch('/api/books');
  return res.json();
}

function renderShelf(books) {
  const shelf = document.getElementById('shelf');
  const emptyHint = document.getElementById('emptyHint');
  shelf.innerHTML = '';

  if (!books.length) {
    emptyHint.hidden = false;
    return;
  }
  emptyHint.hidden = true;

  books.forEach((book, i) => {
    const isPdf = book.format === 'pdf';
    const readUnit = isPdf ? (book.position || 0) + 1 : (book.chapter_idx || 0) + 1;
    const progressPct = book.chapter_count
      ? Math.min(100, Math.round((readUnit / book.chapter_count) * 100))
      : 0;
    const unitLabel = isPdf ? '页' : '章';

    const spine = document.createElement('div');
    spine.className = 'book-spine';
    spine.style.setProperty('--spine-color', spineColorFor(book.title));
    spine.style.animationDelay = `${i * 0.05}s`;
    spine.innerHTML = `
      <button class="spine-delete" data-id="${book.id}" title="删除">×</button>
      <span class="spine-title">${book.title}</span>
      <div class="spine-progress"><i style="width:${progressPct}%"></i></div>
      <div class="spine-tooltip">
        <strong>${book.title}</strong>
        ${book.author || '未知作者'} · ${book.format.toUpperCase()}<br />
        共 ${book.chapter_count} ${unitLabel} · 已读第 ${readUnit} ${unitLabel}（${progressPct}%）
      </div>
    `;
    spine.addEventListener('click', (e) => {
      if (e.target.closest('.spine-delete')) return;
      window.location.href = `reader.html?id=${book.id}`;
    });
    shelf.appendChild(spine);
  });

  shelf.querySelectorAll('.spine-delete').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('确认删除这本书吗？')) return;
      await fetch(`/api/books/${btn.dataset.id}`, { method: 'DELETE' });
      loadShelf();
    });
  });
}

async function loadShelf() {
  const books = await fetchBooks();
  renderShelf(books);
}

document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/books', { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json();
    alert(`导入失败: ${err.error}`);
    return;
  }
  e.target.value = '';
  loadShelf();
});

loadShelf();
