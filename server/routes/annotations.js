const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/:bookId', (req, res) => {
  const annotations = db
    .prepare(
      `SELECT id, chapter_idx, anchor_start, anchor_end, quote_text, note, color, created_at
       FROM annotations WHERE book_id = ? ORDER BY chapter_idx, anchor_start`
    )
    .all(req.params.bookId);
  res.json(annotations);
});

router.post('/:bookId', (req, res) => {
  const { chapter_idx, anchor_start, anchor_end, quote_text, note, color } = req.body;
  if (chapter_idx === undefined || anchor_start === undefined || anchor_end === undefined || !quote_text) {
    return res.status(400).json({ error: '缺少必要字段' });
  }
  const info = db
    .prepare(
      `INSERT INTO annotations (book_id, chapter_idx, anchor_start, anchor_end, quote_text, note, color)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.params.bookId, chapter_idx, anchor_start, anchor_end, quote_text, note || null, color || 'yellow');
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete('/:bookId/:annotationId', (req, res) => {
  db.prepare(`DELETE FROM annotations WHERE id = ? AND book_id = ?`).run(
    req.params.annotationId,
    req.params.bookId
  );
  res.status(204).end();
});

module.exports = router;
