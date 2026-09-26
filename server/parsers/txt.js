const fs = require('fs');
const iconv = require('iconv-lite');
const jschardet = require('jschardet');

// 常见中文章节标题模式，命中即视为新章节的起点
const CHAPTER_PATTERNS = [
  /^第[0-9一二三四五六七八九十百千零〇]+[章回节卷集]\s*.*$/,
  /^(Chapter|CHAPTER)\s+[0-9IVXLC]+.*$/,
  /^\s*[0-9]{1,4}[、.．]\s*.+$/
];

function isChapterTitle(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 40) return false;
  return CHAPTER_PATTERNS.some((re) => re.test(trimmed));
}

function detectAndDecode(filePath) {
  const buffer = fs.readFileSync(filePath);
  const detected = jschardet.detect(buffer);
  const encoding = (detected && detected.encoding) || 'utf-8';
  try {
    return iconv.decode(buffer, encoding);
  } catch (err) {
    return iconv.decode(buffer, 'utf-8');
  }
}

function splitChapters(text, fallbackTitle) {
  const lines = text.split(/\r\n|\r|\n/);
  const chapters = [];
  let current = { title: fallbackTitle, lines: [] };

  for (const line of lines) {
    if (isChapterTitle(line)) {
      if (current.lines.some((l) => l.trim().length > 0)) {
        chapters.push(current);
      }
      current = { title: line.trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.some((l) => l.trim().length > 0)) {
    chapters.push(current);
  }

  // 没有识别出任何章节标题时，整本书按固定行数切块兜底
  if (chapters.length <= 1) {
    return chunkByLines(lines, fallbackTitle);
  }

  return chapters.map((c, i) => ({
    title: c.title || `第 ${i + 1} 节`,
    content: c.lines.join('\n').trim()
  }));
}

function chunkByLines(lines, fallbackTitle, linesPerChunk = 200) {
  const chunks = [];
  for (let i = 0; i < lines.length; i += linesPerChunk) {
    const slice = lines.slice(i, i + linesPerChunk).join('\n').trim();
    if (slice) {
      chunks.push({ title: `${fallbackTitle} (${chunks.length + 1})`, content: slice });
    }
  }
  return chunks.length ? chunks : [{ title: fallbackTitle, content: lines.join('\n').trim() }];
}

function parseTxt(filePath, titleGuess) {
  const text = detectAndDecode(filePath);
  const chapters = splitChapters(text, titleGuess);
  return { title: titleGuess, author: null, chapters };
}

module.exports = { parseTxt };
