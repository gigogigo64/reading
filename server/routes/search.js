const express = require('express');
const db = require('../db');

const router = express.Router();

function highlightSnippet(content, q, radius = 20) {
  const idx = content.indexOf(q);
  if (idx === -1) return content.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(content.length, idx + q.length + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';
  return (
    prefix +
    content.slice(start, idx) +
    `<mark>${content.slice(idx, idx + q.length)}</mark>` +
    content.slice(idx + q.length, end) +
    suffix
  );
}

router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  const bookId = req.query.bookId;
  if (!q) return res.json([]);

  // trigram 分词要求查询长度 >= 3 才能命中，短查询退化为逐行 LIKE 扫描
  if (q.length >= 3) {
    const match = q.replace(/"/g, '""');
    let sql = `
      SELECT c.book_id, c.idx AS chapter_idx, c.title AS chapter_title, b.title AS book_title,
             snippet(chapters_fts, 0, '<mark>', '</mark>', '…', 20) AS snippet
      FROM chapters_fts
      JOIN chapters c ON c.id = chapters_fts.rowid
      JOIN books b ON b.id = c.book_id
      WHERE chapters_fts MATCH ?
    `;
    const params = [`"${match}"`];
    if (bookId) {
      sql += ` AND c.book_id = ?`;
      params.push(bookId);
    }
    sql += ` LIMIT 50`;
    return res.json(db.prepare(sql).all(...params));
  }

  let sql = `
    SELECT c.book_id, c.idx AS chapter_idx, c.title AS chapter_title, b.title AS book_title, c.content
    FROM chapters c
    JOIN books b ON b.id = c.book_id
    WHERE c.content LIKE ?
  `;
  const params = [`%${q}%`];
  if (bookId) {
    sql += ` AND c.book_id = ?`;
    params.push(bookId);
  }
  sql += ` LIMIT 50`;

  const rows = db.prepare(sql).all(...params);
  res.json(
    rows.map((r) => ({
      book_id: r.book_id,
      chapter_idx: r.chapter_idx,
      chapter_title: r.chapter_title,
      book_title: r.book_title,
      snippet: highlightSnippet(r.content, q)
    }))
  );
});

module.exports = router;
