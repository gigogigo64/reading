const { EPub } = require('epub2');

function stripHtml(html) {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function parseEpub(filePath, titleGuess) {
  const epub = await EPub.createAsync(filePath);
  const meta = epub.metadata || {};
  const chapters = [];

  for (let i = 0; i < epub.flow.length; i += 1) {
    const item = epub.flow[i];
    const rawHtml = await epub.getChapterRawAsync(item.id);
    const content = stripHtml(rawHtml || '');
    if (content) {
      chapters.push({ title: item.title || `第 ${chapters.length + 1} 节`, content });
    }
  }

  return {
    title: meta.title || titleGuess,
    author: meta.creator || null,
    chapters: chapters.length ? chapters : [{ title: titleGuess, content: '(未能解析出章节内容)' }]
  };
}

module.exports = { parseEpub };
