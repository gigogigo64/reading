const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { parseBook } = require('../parsers');

const router = express.Router();
const BOOKS_DIR = path.join(__dirname, '..', 'storage', 'books');

const upload = multer({ dest: BOOKS_DIR });

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到文件' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  const storedName = `${req.file.filename}${ext}`;
  const storedPath = path.join(BOOKS_DIR, storedName);
  fs.renameSync(req.file.path, storedPath);

  try {
    const parsed = await parseBook(storedPath, req.file.originalname);

    const insertBook = db.prepare(
      `INSERT INTO books (title, author, format, file_path) VALUES (?, ?, ?, ?)`
    );
    const info = insertBook.run(
      parsed.title,
      parsed.author,
      parsed.format,
      path.relative(path.join(__dirname, '..'), storedPath)
    );
    const bookId = info.lastInsertRowid;

    const insertChapter = db.prepare(
      `INSERT INTO chapters (book_id, idx, title, content) VALUES (?, ?, ?, ?)`
    );
    const insertMany = db.transaction((chapters) => {
      chapters.forEach((c, i) => insertChapter.run(bookId, i, c.title, c.content));
    });
    insertMany(parsed.chapters);

    db.prepare(
      `INSERT INTO progress (book_id, chapter_idx, position) VALUES (?, 0, 0)`
    ).run(bookId);

    res.status(201).json({ id: bookId, title: parsed.title, chapterCount: parsed.chapters.length });
  } catch (err) {
    fs.unlinkSync(storedPath);
    res.status(400).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  const books = db
    .prepare(
      `SELECT b.id, b.title, b.author, b.format, b.cover_path, b.imported_at,
              (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) AS chapter_count,
              p.chapter_idx, p.position
       FROM books b LEFT JOIN progress p ON p.book_id = b.id
       ORDER BY b.imported_at DESC`
    )
    .all();
  res.json(books);
});

router.get('/:id/toc', (req, res) => {
  const toc = db
    .prepare(`SELECT idx, title FROM chapters WHERE book_id = ? ORDER BY idx`)
    .all(req.params.id);
  res.json(toc);
});

router.get('/:id/chapters/:idx', (req, res) => {
  const chapter = db
    .prepare(`SELECT idx, title, content FROM chapters WHERE book_id = ? AND idx = ?`)
    .get(req.params.id, req.params.idx);
  if (!chapter) return res.status(404).json({ error: '章节不存在' });
  res.json(chapter);
});

router.delete('/:id', (req, res) => {
  const book = db.prepare(`SELECT file_path FROM books WHERE id = ?`).get(req.params.id);
  if (!book) return res.status(404).json({ error: '书籍不存在' });

  db.prepare(`DELETE FROM books WHERE id = ?`).run(req.params.id);
  const absPath = path.join(__dirname, '..', book.file_path);
  if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
  res.status(204).end();
});

module.exports = router;
