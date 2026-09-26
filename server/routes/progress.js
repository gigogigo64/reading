const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/:bookId', (req, res) => {
  const progress = db
    .prepare(`SELECT chapter_idx, position, updated_at FROM progress WHERE book_id = ?`)
    .get(req.params.bookId);
  res.json(progress || { chapter_idx: 0, position: 0 });
});

router.put('/:bookId', (req, res) => {
  const { chapter_idx, position } = req.body;
  if (chapter_idx === undefined || position === undefined) {
    return res.status(400).json({ error: '缺少 chapter_idx 或 position' });
  }
  db.prepare(
    `INSERT INTO progress (book_id, chapter_idx, position, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(book_id) DO UPDATE SET
       chapter_idx = excluded.chapter_idx,
       position = excluded.position,
       updated_at = excluded.updated_at`
  ).run(req.params.bookId, chapter_idx, position);
  res.status(204).end();
});

module.exports = router;
