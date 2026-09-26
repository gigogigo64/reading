const params = new URLSearchParams(window.location.search);
const bookId = params.get('id');

const state = {
  mode: 'text',
  toc: [],
  chapterIdx: 0,
  pageIndex: 0,
  pageCount: 1,
  savedPosition: 0,
  pdfDoc: null
};

const pageContainer = document.getElementById('pageContainer');
const pageScroller = document.getElementById('pageScroller');
const pdfViewerEl = document.getElementById('pdfViewer');
const pdfCanvas = document.getElementById('pdfCanvas');
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
  pageScroller.scrollLeft = 0;
  state.pageIndex = 0;

  await window.applyAnnotationsToChapter?.(idx);
  requestAnimationFrame(() => {
    computePageCount();
    goToPage(startPage || 0);
  });
}

function getPagePitch() {
  // clientWidth spans 2 columns + 1 inner column-gap; the gap between the
  // 2nd column of one page and the 1st column of the next page must also
  // be added, otherwise scrollLeft under-shoots by one gap per page.
  const gap = parseFloat(getComputedStyle(pageContainer).columnGap) || 0;
  return pageScroller.clientWidth + gap;
}

function computePageCount() {
  if (state.mode === 'pdf') {
    state.pageCount = state.pdfDoc.numPages;
    return;
  }
  const scrollWidth = pageContainer.scrollWidth;
  state.pageCount = Math.max(1, Math.round(scrollWidth / getPagePitch()));
}

function goToPage(idx) {
  state.pageIndex = Math.max(0, Math.min(idx, state.pageCount - 1));
  if (state.mode === 'pdf') {
    renderPdfPage(state.pageIndex + 1);
    pageIndicator.textContent = `第 ${state.pageIndex + 1}/${state.pageCount} 页`;
    saveProgress();
    return;
  }
  pageScroller.scrollLeft = state.pageIndex * getPagePitch();
  pageIndicator.textContent = `第 ${state.chapterIdx + 1} 章 · ${state.pageIndex + 1}/${state.pageCount} 页`;
  saveProgress();
}

async function renderPdfPage(pageNum) {
  const page = await state.pdfDoc.getPage(pageNum);
  const unscaled = page.getViewport({ scale: 1 });
  const availWidth = pdfViewerEl.clientWidth - 32;
  const availHeight = pdfViewerEl.clientHeight - 32;
  const scale = Math.max(0.1, Math.min(availWidth / unscaled.width, availHeight / unscaled.height));
  const viewport = page.getViewport({ scale });

  // 按设备像素比渲染，否则高分屏下 canvas 位图分辨率低于实际显示尺寸，画面会发虚。
  const outputScale = window.devicePixelRatio || 1;
  pdfCanvas.width = Math.floor(viewport.width * outputScale);
  pdfCanvas.height = Math.floor(viewport.height * outputScale);
  pdfCanvas.style.width = `${Math.floor(viewport.width)}px`;
  pdfCanvas.style.height = `${Math.floor(viewport.height)}px`;

  const ctx = pdfCanvas.getContext('2d');
  const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
  await page.render({ canvasContext: ctx, viewport, transform }).promise;
}

async function initPdfMode(progress) {
  state.mode = 'pdf';
  state.chapterIdx = 0;
  pageScroller.hidden = true;
  chapterTitleEl.hidden = true;
  pdfViewerEl.hidden = false;
  ['toggleToc', 'toggleNotes', 'toggleSearch'].forEach((id) => {
    document.getElementById(id).hidden = true;
  });

  const pdfjsLib = await import('/vendor/pdfjs/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
  state.pdfDoc = await pdfjsLib.getDocument({ url: `/api/books/${bookId}/file` }).promise;
  state.pageCount = state.pdfDoc.numPages;
  goToPage(progress.position || 0);
}

document.getElementById('prevPage').addEventListener('click', async () => {
  if (state.pageIndex > 0) {
    goToPage(state.pageIndex - 1);
  } else if (state.mode !== 'pdf' && state.chapterIdx > 0) {
    await loadChapter(state.chapterIdx - 1, 9999);
    computePageCount();
    goToPage(state.pageCount - 1);
  }
});

document.getElementById('nextPage').addEventListener('click', async () => {
  if (state.pageIndex < state.pageCount - 1) {
    goToPage(state.pageIndex + 1);
  } else if (state.mode !== 'pdf' && state.chapterIdx < state.toc.length - 1) {
    await loadChapter(state.chapterIdx + 1, 0);
  }
});

const PANEL_TABS = {
  tocPanel: 'toggleToc',
  notesPanel: 'toggleNotes',
  searchPanel: 'toggleSearch'
};

function togglePanel(id) {
  Object.entries(PANEL_TABS).forEach(([panelId, tabId]) => {
    const panel = document.getElementById(panelId);
    const tab = document.getElementById(tabId);
    if (panelId === id) {
      panel.hidden = !panel.hidden;
      tab.classList.toggle('active', !panel.hidden);
    } else {
      panel.hidden = true;
      tab.classList.remove('active');
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

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowLeft') document.getElementById('prevPage').click();
  if (e.key === 'ArrowRight') document.getElementById('nextPage').click();
});

window.addEventListener('resize', () => {
  if (state.mode === 'pdf') {
    renderPdfPage(state.pageIndex + 1);
    return;
  }
  computePageCount();
  goToPage(state.pageIndex);
});

async function init() {
  if (!bookId) {
    window.location.href = 'index.html';
    return;
  }
  const bookRes = await fetch(`/api/books/${bookId}`);
  if (!bookRes.ok) {
    window.location.href = 'index.html';
    return;
  }
  const book = await bookRes.json();
  const progress = await loadProgress();

  if (book.format === 'pdf') {
    await initPdfMode(progress);
    return;
  }

  await loadToc();
  await loadChapter(progress.chapter_idx || 0, progress.position || 0);
}

window.readerState = state;
window.readerBookId = bookId;
window.loadChapter = loadChapter;

init();
