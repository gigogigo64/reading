const express = require('express');
const path = require('path');

const booksRouter = require('./routes/books');
const progressRouter = require('./routes/progress');
const annotationsRouter = require('./routes/annotations');
const searchRouter = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/books', booksRouter);
app.use('/api/progress', progressRouter);
app.use('/api/annotations', annotationsRouter);
app.use('/api/search', searchRouter);

app.listen(PORT, () => {
  console.log(`本地阅读工具已启动: http://localhost:${PORT}`);
});
