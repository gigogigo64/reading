const fs = require('fs');
const { PDFParse } = require('pdf-parse');

// 扫描版 PDF 通常没有可提取的文字层，这里只取页数和元信息，
// 正文改由前端 pdf.js 逐页渲染成图片展示。
async function parsePdf(filePath, titleGuess) {
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  const info = await parser.getInfo();
  await parser.destroy();
  const meta = info.info || {};

  return {
    title: meta.Title || titleGuess,
    author: meta.Author || null,
    pageCount: info.total,
    chapters: []
  };
}

module.exports = { parsePdf };
