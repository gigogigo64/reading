# 项目规范

## Git 提交规范

每次完成一轮功能修改后，必须用**中文**编写 commit message。

格式：
```
<类型>: <简短描述>

[可选] 详细说明
```

类型：
- `功能`：新增功能
- `修复`：修复 bug
- `重构`：代码重构（不改变功能）
- `样式`：UI/样式调整
- `文档`：文档更新
- `配置`：配置或依赖变更

示例：
```
功能: 添加阅读进度自动保存

- 每翻页时保存当前章节和位置到 localStorage
- 下次打开同一书籍时自动恢复进度
```

## 项目目标

构建本地阅读工具，核心功能：
- 翻页阅读（支持纯文本/TXT/EPUB）
- 阅读进度自动保存与恢复
- 书架管理
- 段落批注
- 全文检索

## 远程仓库

https://github.com/gigogigo64/reading

## 技术架构

本地 Web 服务（Node.js + Express）+ 浏览器前端（原生 HTML/CSS/JS，无框架）。数据存储用 SQLite（better-sqlite3），全文检索用 FTS5 trigram 分词（应对中文子串检索），查询长度 < 3 字符时退化为 LIKE 扫描。

```
server/
  index.js              # Express 入口
  db.js                  # 建表 + FTS5 虚拟表 + 触发器
  routes/                # books / progress / annotations / search
  parsers/               # txt.js（编码检测+分章）、epub.js（epub2解析）
  storage/               # books/ 原始文件、covers/ 封面、library.db（均 .gitignore）
public/
  index.html / reader.html
  css/style.css
  js/                    # bookshelf.js / reader.js / annotate.js / search.js
```

启动：`npm install && npm start`，浏览器打开 http://localhost:3000

## 待完善事项

- 批注跨 DOM 文本节点的选区高亮（annotate.js 的 wrapRange）在选区跨越多个段落时会静默跳过，尚未做鲁棒处理
- 封面（cover_path）目前未生成，书架卡片暂无封面图
- multer 1.x 有已知安全公告，个人本地工具可接受，后续可评估升级 2.x
