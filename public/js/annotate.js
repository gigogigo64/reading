let currentAnnotations = [];

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
});

document.addEventListener('mousedown', (e) => {
  if (!popup.contains(e.target)) popup.hidden = true;
});

async function applyAnnotationsToChapter(chapterIdx) {
  await fetchAnnotations();
  const marks = currentAnnotations.filter((a) => a.chapter_idx === chapterIdx);
  if (!marks.length) return;

  // 简化实现：按纯文本长度重新定位并包裹 <mark>，用于骨架演示
  const walker = document.createTreeWalker(pageContainerEl, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);
  const fullText = textNodes.map((n) => n.textContent).join('');

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
    li.textContent = `[第${a.chapter_idx + 1}章] ${a.quote_text.slice(0, 20)}${a.note ? ' — ' + a.note : ''}`;
    li.addEventListener('click', () => window.loadChapter(a.chapter_idx, 0));
    list.appendChild(li);
  });
}

window.applyAnnotationsToChapter = applyAnnotationsToChapter;
window.renderNotesList = renderNotesList;
