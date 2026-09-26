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

  for (const book of books) {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = `
      <button class="delete-btn" data-id="${book.id}">删除</button>
      <h3>${book.title}</h3>
      <p>${book.author || '未知作者'} · ${book.format.toUpperCase()}</p>
      <p>共 ${book.chapter_count} 章 · 已读第 ${(book.chapter_idx || 0) + 1} 章</p>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.delete-btn')) return;
      window.location.href = `reader.html?id=${book.id}`;
    });
    shelf.appendChild(card);
  }

  shelf.querySelectorAll('.delete-btn').forEach((btn) => {
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
