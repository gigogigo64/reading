const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'storage', 'library.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT,
  format TEXT NOT NULL,
  file_path TEXT NOT NULL,
  cover_path TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  UNIQUE(book_id, idx)
);

-- trigram 分词以支持中文子串检索（unicode61 默认分词无法命中不含空格的中文短语）
CREATE VIRTUAL TABLE IF NOT EXISTS chapters_fts USING fts5(
  content,
  content='chapters',
  content_rowid='id',
  tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS chapters_ai AFTER INSERT ON chapters BEGIN
  INSERT INTO chapters_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS chapters_ad AFTER DELETE ON chapters BEGIN
  INSERT INTO chapters_fts(chapters_fts, rowid, content) VALUES ('delete', old.id, old.content);
END;

CREATE TRIGGER IF NOT EXISTS chapters_au AFTER UPDATE ON chapters BEGIN
  INSERT INTO chapters_fts(chapters_fts, rowid, content) VALUES ('delete', old.id, old.content);
  INSERT INTO chapters_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE TABLE IF NOT EXISTS progress (
  book_id INTEGER PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  chapter_idx INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_idx INTEGER NOT NULL,
  anchor_start INTEGER NOT NULL,
  anchor_end INTEGER NOT NULL,
  quote_text TEXT NOT NULL,
  note TEXT,
  color TEXT DEFAULT 'yellow',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const bookCols = db.prepare(`PRAGMA table_info(books)`).all().map((c) => c.name);
if (!bookCols.includes('page_count')) {
  db.exec(`ALTER TABLE books ADD COLUMN page_count INTEGER`);
}

module.exports = db;
