const path = require('path');
const { parseTxt } = require('./txt');
const { parseEpub } = require('./epub');
const { parsePdf } = require('./pdf');

async function parseBook(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const titleGuess = path.basename(originalName, ext);

  if (ext === '.txt') {
    return { format: 'txt', ...parseTxt(filePath, titleGuess) };
  }
  if (ext === '.epub') {
    return { format: 'epub', ...(await parseEpub(filePath, titleGuess)) };
  }
  if (ext === '.pdf') {
    return { format: 'pdf', ...(await parsePdf(filePath, titleGuess)) };
  }
  throw new Error(`不支持的文件格式: ${ext}`);
}

module.exports = { parseBook };
