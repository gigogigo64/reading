let currentAnnotations = [];

const HIGHLIGHT_COLORS = {
  yellow: '#f5e08a',
  green: '#b7e0b0',
  pink: '#f3b8c4',
  blue: '#a9d1ea'
};

async function fetchAnnotations() {
  const res = await fetch(`/api/annotations/${window.readerBookId}`);
  currentAnnotations = await res.json();
}

function getTextOffset(container, node, offset) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let total = 0;
  let current;
  while ((current = walker.nextNode())) {
    if (current === node) return total + offset;
    total += current.textContent.length;
  }
  return total;
}

const pageContainerEl = document.getElementById('pageContainer');
const popup = document.getElementById('selectionPopup');
let pendingSelection = null;

pageContainerEl.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) {
    popup.hidden = true;
    return;
  }
  const range = selection.getRangeAt(0);
  const start = getTextOffset(pageContainerEl, range.startContainer, range.startOffset);
  const end = getTextOffset(pageContainerEl, range.endContainer, range.endOffset);
  pendingSelection = { start, end, text: selection.toString() };

  const rect = range.getBoundingClientRect();
  popup.style.left = `${rect.left + rect.width / 2}px`;
  popup.style.top = `${rect.top - 36}px`;
  popup.hidden = false;
});

document.getElementById('highlightBtn').addEventListener('click', async () => {
  if (!pendingSelection) return;
  const note = prompt('添加批注内容（留空则仅高亮）:') || '';
  await fetch(`/api/annotations/${window.readerBookId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chapter_idx: window.readerState.chapterIdx,
      anchor_start: pendingSelection.start,
      anchor_end: pendingSelection.end,
      quote_text: pendingSelection.text,
      note
    })
  });
  popup.hidden = true;
  window.getSelection().removeAllRanges();
  await applyAnnotationsToChapter(window.readerState.chapterIdx);
  renderNotesList();
});

document.addEventListener('mousedown', (e) => {
  if (!popup.contains(e.target)) popup.hidden = true;
});

async function deleteAnnotation(id) {
  if (!confirm('删除这条批注？')) return;
  await fetch(`/api/annotations/${window.readerBookId}/${id}`, { method: 'DELETE' });
  await applyAnnotationsToChapter(window.readerState.chapterIdx);
  renderNotesList();
}

pageContainerEl.addEventListener('click', (e) => {
  const mark = e.target.closest('mark.annotated');
  if (!mark) return;
  deleteAnnotation(mark.dataset.annotationId);
});

function clearAnnotationMarks() {
  // 每次重新应用批注前先把旧的 <mark> 拆掉，否则重复调用会把同一段文字
  // 嵌套包裹多层 <mark>，半透明背景层层叠加导致颜色越叠越深。
  pageContainerEl.querySelectorAll('mark.annotated').forEach((m) => {
    const parent = m.parentNode;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();
  });
}

async function applyAnnotationsToChapter(chapterIdx) {
  await fetchAnnotations();
  clearAnnotationMarks();
  const marks = currentAnnotations.filter((a) => a.chapter_idx === chapterIdx);
  if (!marks.length) return;

  // 简化实现：按纯文本长度重新定位并包裹 <mark>，用于骨架演示
  const walker = document.createTreeWalker(pageContainerEl, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);

  marks
    .sort((a, b) => b.anchor_start - a.anchor_start)
    .forEach((mark) => {
      wrapRange(textNodes, mark.anchor_start, mark.anchor_end, mark);
    });
}

function wrapRange(textNodes, start, end, mark) {
  let offset = 0;
  for (const node of textNodes) {
    const nodeLen = node.textContent.length;
    if (offset + nodeLen <= start) { offset += nodeLen; continue; }
    const localStart = Math.max(0, start - offset);
    const localEnd = Math.min(nodeLen, end - offset);
    if (localStart < localEnd) {
      const range = document.createRange();
      range.setStart(node, localStart);
      range.setEnd(node, localEnd);
      const markEl = document.createElement('mark');
      markEl.className = 'annotated';
      markEl.title = mark.note || '';
      markEl.dataset.annotationId = mark.id;
      markEl.style.backgroundColor = HIGHLIGHT_COLORS[mark.color] || HIGHLIGHT_COLORS.yellow;
      try { range.surroundContents(markEl); } catch (e) { /* 跨节点选区跳过，骨架阶段可接受 */ }
    }
    if (offset + nodeLen >= end) break;
    offset += nodeLen;
  }
}

function renderNotesList() {
  const list = document.getElementById('notesList');
  list.innerHTML = '';
  currentAnnotations.forEach((a) => {
    const li = document.createElement('li');
    li.className = 'note-item';

    const span = document.createElement('span');
    span.className = 'note-text';
    span.textContent = `[第${a.chapter_idx + 1}章] ${a.quote_text.slice(0, 20)}${a.note ? ' — ' + a.note : ''}`;
    span.addEventListener('click', () => window.loadChapter(a.chapter_idx, 0));

    const delBtn = document.createElement('button');
    delBtn.className = 'note-delete';
    delBtn.textContent = '×';
    delBtn.title = '删除';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteAnnotation(a.id);
    });

    li.appendChild(span);
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

window.applyAnnotationsToChapter = applyAnnotationsToChapter;
window.renderNotesList = renderNotesList;
