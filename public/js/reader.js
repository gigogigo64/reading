const params = new URLSearchParams(window.location.search);
const bookId = params.get('id');

const state = {
  mode: 'text',
  toc: [],
  chapterIdx: 0,
  pageIndex: 0,
  pageCount: 1,
  savedPosition: 0,
  pdfDoc: null,
  pdfZoom: 1
};

const pageContainer = document.getElementById('pageContainer');
const pageScroller = document.getElementById('pageScroller');
const pageViewport = document.querySelector('.page-viewport');
const pdfViewerEl = document.getElementById('pdfViewer');
const pdfCanvas = document.getElementById('pdfCanvas');
const chapterTitleEl = document.getElementById('chapterTitle');
const chapterUnitWrap = document.getElementById('chapterUnitWrap');
const chapterInput = document.getElementById('chapterInput');
const pageInput = document.getElementById('pageInput');
const pageTotalLabel = document.getElementById('pageTotalLabel');

/* ================= 阅读设置（字号/字体/行距/栏数/页边距） ================= */

const DEFAULT_SETTINGS = { fontSize: 18, font: 'song', lineHeight: 2, columns: 2, margin: 72 };
const FONT_VARS = { song: 'var(--font-body)', kai: 'var(--font-display)' };

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('readerSettings') || '{}') };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

let settings = loadSettings();

function applySettings() {
  pageContainer.style.setProperty('--reader-font-size', `${settings.fontSize}px`);
  pageContainer.style.setProperty('--reader-line-height', settings.lineHeight);
  pageContainer.style.setProperty('--reader-font', FONT_VARS[settings.font] || FONT_VARS.song);
  pageContainer.style.setProperty('--reader-columns', settings.columns);
  pageContainer.classList.toggle('single-column', settings.columns === 1);
  pageViewport.style.setProperty('--reader-margin', `${settings.margin}px`);

  document.getElementById('fontSizeValue').textContent = settings.fontSize;
  document.getElementById('lineHeightValue').textContent = settings.lineHeight.toFixed(1);
  document.getElementById('marginValue').textContent = settings.margin;
  document.getElementById('fontSong').classList.toggle('active', settings.font === 'song');
  document.getElementById('fontKai').classList.toggle('active', settings.font === 'kai');
  document.getElementById('columns1').classList.toggle('active', settings.columns === 1);
  document.getElementById('columns2').classList.toggle('active', settings.columns === 2);
}

function saveSettings() {
  localStorage.setItem('readerSettings', JSON.stringify(settings));
}

function updateSetting(key, value) {
  settings[key] = value;
  saveSettings();
  applySettings();
  if (state.mode === 'text') {
    requestAnimationFrame(() => {
      computePageCount();
      goToPage(state.pageIndex);
    });
  }
}

document.getElementById('fontSizeDown').addEventListener('click', () => updateSetting('fontSize', Math.max(14, settings.fontSize - 2)));
document.getElementById('fontSizeUp').addEventListener('click', () => updateSetting('fontSize', Math.min(28, settings.fontSize + 2)));
document.getElementById('lineHeightDown').addEventListener('click', () => updateSetting('lineHeight', Math.max(1.4, +(settings.lineHeight - 0.2).toFixed(1))));
document.getElementById('lineHeightUp').addEventListener('click', () => updateSetting('lineHeight', Math.min(2.6, +(settings.lineHeight + 0.2).toFixed(1))));
document.getElementById('marginDown').addEventListener('click', () => updateSetting('margin', Math.max(32, settings.margin - 12)));
document.getElementById('marginUp').addEventListener('click', () => updateSetting('margin', Math.min(140, settings.margin + 12)));
document.getElementById('fontSong').addEventListener('click', () => updateSetting('font', 'song'));
document.getElementById('fontKai').addEventListener('click', () => updateSetting('font', 'kai'));
document.getElementById('columns1').addEventListener('click', () => updateSetting('columns', 1));
document.getElementById('columns2').addEventListener('click', () => updateSetting('columns', 2));
document.getElementById('settingsReset').addEventListener('click', () => {
  settings = { ...DEFAULT_SETTINGS };
  saveSettings();
  applySettings();
  if (state.mode === 'text') {
    requestAnimationFrame(() => {
      computePageCount();
      goToPage(state.pageIndex);
    });
  }
});

applySettings();

/* ================= 目录 / 进度 ================= */

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

/* ================= 分页 / 翻页 ================= */

function getPagePitch() {
  // clientWidth 是"可视宽度"（N 栏 + N-1 个栏内间距）；从这一页翻到下一页，
  // 还要再跨过一个栏间距才能到下一页第一栏的起点，否则每翻一页都会少算
  // 一个栏间距，翻得越多、位置偏差越大。
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

function updateIndicatorDisplay() {
  pageInput.value = state.pageIndex + 1;
  pageTotalLabel.textContent = state.pageCount;
  if (state.mode === 'pdf') {
    chapterUnitWrap.hidden = true;
  } else {
    chapterUnitWrap.hidden = false;
    chapterInput.value = state.chapterIdx + 1;
  }
}

function goToPage(idx) {
  state.pageIndex = Math.max(0, Math.min(idx, state.pageCount - 1));
  if (state.mode === 'pdf') {
    renderPdfPage(state.pageIndex + 1);
    updateIndicatorDisplay();
    saveProgress();
    return;
  }
  pageScroller.scrollLeft = state.pageIndex * getPagePitch();
  updateIndicatorDisplay();
  saveProgress();
}

function commitPageJump() {
  const idx = parseInt(pageInput.value, 10) - 1;
  if (!Number.isNaN(idx)) goToPage(idx);
  else updateIndicatorDisplay();
}
pageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); commitPageJump(); pageInput.blur(); }
});
pageInput.addEventListener('blur', commitPageJump);

function commitChapterJump() {
  const idx = parseInt(chapterInput.value, 10) - 1;
  if (!Number.isNaN(idx) && idx >= 0 && idx < state.toc.length && idx !== state.chapterIdx) {
    loadChapter(idx, 0);
  } else {
    updateIndicatorDisplay();
  }
}
chapterInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); commitChapterJump(); chapterInput.blur(); }
});
chapterInput.addEventListener('blur', commitChapterJump);

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

/* ================= PDF 模式 ================= */

let currentRenderTask = null;

async function renderPdfPage(pageNum) {
  const page = await state.pdfDoc.getPage(pageNum);
  const unscaled = page.getViewport({ scale: 1 });
  const availWidth = pdfViewerEl.clientWidth - 32;
  const availHeight = pdfViewerEl.clientHeight - 32;
  const fitScale = Math.max(0.1, Math.min(availWidth / unscaled.width, availHeight / unscaled.height));
  const scale = fitScale * state.pdfZoom;
  const viewport = page.getViewport({ scale });

  // 按设备像素比渲染，否则高分屏下 canvas 位图分辨率低于实际显示尺寸，画面会发虚。
  const outputScale = window.devicePixelRatio || 1;
  pdfCanvas.width = Math.floor(viewport.width * outputScale);
  pdfCanvas.height = Math.floor(viewport.height * outputScale);
  pdfCanvas.style.width = `${Math.floor(viewport.width)}px`;
  pdfCanvas.style.height = `${Math.floor(viewport.height)}px`;

  const ctx = pdfCanvas.getContext('2d');
  const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

  if (currentRenderTask) currentRenderTask.cancel();
  currentRenderTask = page.render({ canvasContext: ctx, viewport, transform });
  try {
    await currentRenderTask.promise;
  } catch (err) {
    if (err?.name !== 'RenderingCancelledException') throw err;
  }
}

let pdfWheelPending = false;
pdfViewerEl.addEventListener('wheel', (e) => {
  if (state.mode !== 'pdf') return;
  e.preventDefault();
  const factor = Math.exp(-e.deltaY * 0.0015);
  const nextZoom = Math.min(4, Math.max(0.5, state.pdfZoom * factor));
  if (nextZoom === state.pdfZoom) return;

  // 记录鼠标当前对准的是画布上的哪一点（比例坐标），缩放完成后让这一点
  // 仍然停在鼠标下方，而不是整页跳来跳去。
  const rect = pdfViewerEl.getBoundingClientRect();
  const anchorX = (pdfViewerEl.scrollLeft + (e.clientX - rect.left)) / pdfCanvas.offsetWidth;
  const anchorY = (pdfViewerEl.scrollTop + (e.clientY - rect.top)) / pdfCanvas.offsetHeight;

  state.pdfZoom = nextZoom;
  if (!pdfWheelPending) {
    pdfWheelPending = true;
    requestAnimationFrame(async () => {
      pdfWheelPending = false;
      await renderPdfPage(state.pageIndex + 1);
      pdfViewerEl.scrollLeft = anchorX * pdfCanvas.offsetWidth - (e.clientX - rect.left);
      pdfViewerEl.scrollTop = anchorY * pdfCanvas.offsetHeight - (e.clientY - rect.top);
    });
  }
}, { passive: false });

let panState = null;
pdfViewerEl.addEventListener('mousedown', (e) => {
  if (state.mode !== 'pdf') return;
  panState = { x: e.clientX, y: e.clientY, scrollLeft: pdfViewerEl.scrollLeft, scrollTop: pdfViewerEl.scrollTop };
  pdfViewerEl.classList.add('panning');
  e.preventDefault();
});
window.addEventListener('mousemove', (e) => {
  if (!panState) return;
  pdfViewerEl.scrollLeft = panState.scrollLeft - (e.clientX - panState.x);
  pdfViewerEl.scrollTop = panState.scrollTop - (e.clientY - panState.y);
});
window.addEventListener('mouseup', () => {
  if (!panState) return;
  panState = null;
  pdfViewerEl.classList.remove('panning');
});

async function initPdfMode(progress) {
  state.mode = 'pdf';
  state.chapterIdx = 0;
  pageScroller.hidden = true;
  chapterTitleEl.hidden = true;
  pdfViewerEl.hidden = false;
  ['toggleToc', 'toggleNotes', 'toggleSearch', 'toggleSettings'].forEach((id) => {
    document.getElementById(id).hidden = true;
  });

  const pdfjsLib = await import('/vendor/pdfjs/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
  state.pdfDoc = await pdfjsLib.getDocument({ url: `/api/books/${bookId}/file` }).promise;
  state.pageCount = state.pdfDoc.numPages;
  goToPage(progress.position || 0);
}

/* ================= 全文检索跳转高亮 ================= */

function clearSearchHitMarks() {
  pageContainer.querySelectorAll('mark.search-hit').forEach((m) => {
    const parent = m.parentNode;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();
  });
}

function highlightSearchHit(query) {
  clearSearchHitMarks();
  if (!query) return;
  const walker = document.createTreeWalker(pageContainer, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const idx = node.textContent.indexOf(query);
    if (idx === -1) continue;
    const range = document.createRange();
    range.setStart(node, idx);
    range.setEnd(node, idx + query.length);
    const markEl = document.createElement('mark');
    markEl.className = 'search-hit';
    try {
      range.surroundContents(markEl);
    } catch (e) {
      break;
    }
    computePageCount();
    const targetPage = Math.max(0, Math.floor(markEl.offsetLeft / getPagePitch()));
    goToPage(targetPage);
    break;
  }
}

async function jumpToSearchHit(chapterIdx, query) {
  await loadChapter(chapterIdx, 0);
  requestAnimationFrame(() => highlightSearchHit(query));
}
window.jumpToSearchHit = jumpToSearchHit;

/* ================= 面板 / 主题 ================= */

const PANEL_TABS = {
  tocPanel: 'toggleToc',
  notesPanel: 'toggleNotes',
  searchPanel: 'toggleSearch',
  settingsPanel: 'toggleSettings'
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
document.getElementById('toggleSettings').addEventListener('click', () => togglePanel('settingsPanel'));

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
