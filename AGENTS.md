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
- 翻页阅读（支持纯文本/TXT/EPUB，以及扫描版 PDF 的整页图片阅读）
- 阅读进度自动保存与恢复
- 书架管理
- 段落批注
- 全文检索

## 远程仓库

https://github.com/gigogigo64/reading

## 网络代理

访问 GitHub 等境外服务时，本机需通过本地代理端口 **7890** 才能连通。不修改 `git config`（全局/仓库级代理配置一律不动），改为在执行 `git push` / `git fetch` / `git pull` 等命令时临时设置环境变量：

```bash
HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890 git push origin main
```

PowerShell 下等效写法：
```powershell
$env:HTTP_PROXY="http://127.0.0.1:7890"; $env:HTTPS_PROXY="http://127.0.0.1:7890"; git push origin main
```

## 技术架构

本地 Web 服务（Node.js + Express）+ 浏览器前端（原生 HTML/CSS/JS，无框架）。数据存储用 SQLite（better-sqlite3），全文检索用 FTS5 trigram 分词（应对中文子串检索），查询长度 < 3 字符时退化为 LIKE 扫描。

正文分页采用 CSS 多栏排版（`column-count`）+ 原生 `scrollLeft` 横向滚动模拟翻页（而非 `transform: translateX`——后者对未曾滚动到过的多栏溢出内容存在绘制缺陷）；每次翻页跨越的像素间距需按“可视宽度 + 一个 column-gap”计算（否则每翻一页会少算一个栏间距，越往后偏差越大）。

扫描版 PDF（无可提取文字层）不走文字解析，只在导入时用 `pdf-parse` 取页数/元信息，正文由前端 `pdfjs-dist`（挂载于 `/vendor/pdfjs`，来自 node_modules 直出，无需构建步骤）逐页渲染 canvas 图片，翻页 = 换一张图，不支持批注/全文检索。

```
server/
  index.js              # Express 入口
  db.js                  # 建表 + FTS5 虚拟表 + 触发器
  routes/                # books（含 :id/file 原始文件流）/ progress / annotations / search
  parsers/               # txt.js（编码检测+分章）、epub.js（epub2解析）、pdf.js（仅取页数/元信息）
  storage/               # books/ 原始文件、covers/ 封面、library.db（均 .gitignore）
public/
  index.html / reader.html
  css/style.css
  js/                    # bookshelf.js / reader.js（文本翻页 + PDF 图片翻页两种模式）/ annotate.js / search.js
```

启动：`npm install && npm start`，浏览器打开 http://localhost:3000

Windows 下也可直接双击根目录 `启动阅读工具.bat`：首次运行自动 `npm install`，随后自动启动服务并打开浏览器。关闭它打开的控制台窗口即可停止服务。

## 待完善事项

- 批注跨 DOM 文本节点的选区高亮（annotate.js 的 wrapRange）在选区跨越多个段落时会静默跳过，尚未做鲁棒处理
- 封面（cover_path）目前未生成，书架卡片暂无封面图
- multer 1.x 有已知安全公告，个人本地工具可接受，后续可评估升级 2.x
- 扫描版 PDF 走整页图片翻页模式，无文字层，批注和全文检索对这类书不生效；如需支持可后续接入 OCR
