const params = new URLSearchParams(window.location.search);
const bookId = params.get('id');

const state = {
  toc: [],
  chapterIdx: 0,
  pageIndex: 0,
  pageCount: 1,
  savedPosition: 0
};

const pageContainer = document.getElementById('pageContainer');
const chapterTitleEl = document.getElementById('chapterTitle');
const pageIndicator = document.getElementById('pageIndicator');

async function loadToc() {
  const res = await fetch(`/api/books/${bookId}/toc`);
  state.toc = await res.json();
  const tocList = document.getElementById('tocList');
  tocList.innerHTML = '';
  state.toc.forEach((ch) => {
    const li = document.createElement('li');
    li.textContent = ch.title || `第 ${ch.idx + 1} 节`;
    li.addEventListener('click', () => loadChapter(ch.idx, 0));
    tocList.appendChild(li);
  });
}

async function loadProgress() {
  const res = await fetch(`/api/progress/${bookId}`);
  return res.json();
}

async function saveProgress() {
  await fetch(`/api/progress/${bookId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chapter_idx: state.chapterIdx, position: state.pageIndex })
  });
}

function paragraphsToHtml(content) {
  return content
    .split(/\n+/)
    .filter((p) => p.trim())
    .map((p, i) => `<p data-p="${i}">${escapeHtml(p)}</p>`)
    .join('');
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function loadChapter(idx, startPage) {
  const res = await fetch(`/api/books/${bookId}/chapters/${idx}`);
  if (!res.ok) return;
  const chapter = await res.json();
  state.chapterIdx = idx;
  chapterTitleEl.textContent = chapter.title;
  pageContainer.innerHTML = paragraphsToHtml(chapter.content);
  pageContainer.style.transform = 'translateX(0)';
  state.pageIndex = 0;

  await window.applyAnnotationsToChapter?.(idx);
  requestAnimationFrame(() => {
    computePageCount();
    goToPage(startPage || 0);
  });
}

function computePageCount() {
  const viewportWidth = pageContainer.clientWidth;
  const scrollWidth = pageContainer.scrollWidth;
  state.pageCount = Math.max(1, Math.round(scrollWidth / viewportWidth));
}

function goToPage(idx) {
  state.pageIndex = Math.max(0, Math.min(idx, state.pageCount - 1));
  const viewportWidth = pageContainer.clientWidth;
  pageContainer.style.transform = `translateX(-${state.pageIndex * viewportWidth}px)`;
  pageIndicator.textContent = `第 ${state.chapterIdx + 1} 章 · ${state.pageIndex + 1}/${state.pageCount} 页`;
  saveProgress();
}

document.getElementById('prevPage').addEventListener('click', async () => {
  if (state.pageIndex > 0) {
    goToPage(state.pageIndex - 1);
  } else if (state.chapterIdx > 0) {
    await loadChapter(state.chapterIdx - 1, 9999);
    computePageCount();
    goToPage(state.pageCount - 1);
  }
});

document.getElementById('nextPage').addEventListener('click', async () => {
  if (state.pageIndex < state.pageCount - 1) {
    goToPage(state.pageIndex + 1);
  } else if (state.chapterIdx < state.toc.length - 1) {
    await loadChapter(state.chapterIdx + 1, 0);
  }
});

function togglePanel(id) {
  const panels = ['tocPanel', 'notesPanel', 'searchPanel'];
  panels.forEach((p) => {
    const el = document.getElementById(p);
    if (p === id) {
      el.hidden = !el.hidden;
    } else {
      el.hidden = true;
    }
  });
}

document.getElementById('toggleToc').addEventListener('click', () => togglePanel('tocPanel'));
document.getElementById('toggleNotes').addEventListener('click', () => {
  togglePanel('notesPanel');
  window.renderNotesList?.();
});
document.getElementById('toggleSearch').addEventListener('click', () => togglePanel('searchPanel'));

document.getElementById('toggleTheme').addEventListener('click', () => {
  document.body.classList.toggle('theme-night');
});

window.addEventListener('resize', () => {
  computePageCount();
  goToPage(state.pageIndex);
});

async function init() {
  if (!bookId) {
    window.location.href = 'index.html';
    return;
  }
  await loadToc();
  const progress = await loadProgress();
  await loadChapter(progress.chapter_idx || 0, progress.position || 0);
}

window.readerState = state;
window.readerBookId = bookId;
window.loadChapter = loadChapter;

init();
