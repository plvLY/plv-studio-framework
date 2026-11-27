# PLV Studio Framework

PLV Studio 个人研发工作室的展示站点框架。基于 Astro 7 的纯静态站点：**构建期**从独立的数据仓库读取 JSON / Markdown，经 Zod 契约校验后预渲染全部页面，运行时不依赖后端。

- 数据仓库：`plv-studio-data-plv`（与框架仓库同级目录）
- 设计规范与数据契约：`doc V2/04-01-产品UI设计优化方案.md`、`doc V2/03-A-数据契约.md`
- 线上地址：`https://plvstudio.pages.dev`（Cloudflare Pages）

## 技术栈

| 能力 | 方案 |
| --- | --- |
| 框架 / 输出 | Astro 7，`output: 'static'`，全站尾斜杠 `trailingSlash: 'always'` |
| 样式 | Tailwind CSS 4（`@tailwindcss/vite`）+ `src/styles/global.css` 中的设计 Token |
| 数据校验 | Zod 4（`src/lib/contracts`） |
| Markdown | `@astrojs/markdown-remark` + Shiki + `rehype-slug` + Mermaid 内联 SVG |
| 图片优化 | Astro 远程图片（`image.remotePatterns` 由 `DATA_BASE` 推导） |
| 运行时 | Node.js ≥ 22.23.4（见 `.nvmrc`） |

## 目录结构

```
plv-studio-framework/
├─ scripts/
│  └─ validate-data.ts          # 只拉数据、跑契约校验，不构建
├─ public/
│  ├─ _headers                  # Cloudflare Pages 缓存与安全响应头
│  └─ favicon.png / logo.png / plv.png
├─ src/
│  ├─ components/
│  │  ├─ layout/                # SiteHeader、MobileNav、ThemeToggle、SiteFooter、SkipLink
│  │  ├─ project/               # Hero、卡片、能力 Tabs、发布日志、流程轨道等业务组件
│  │  ├─ progress/              # StageTimeline 阶段时间线
│  │  ├─ docs/                  # MarkdownBody、DocToc、DocPager、DocumentCard
│  │  └─ ui/                    # Button、SectionHeading、PageHeader、徽标、进度条等基础组件
│  ├─ layouts/                  # BaseLayout / PageLayout / DocLayout
│  ├─ lib/
│  │  ├─ contracts/             # Zod Schema、错误类型、跨文件校验（V-xx 规则）
│  │  ├─ data-source.ts         # 构建期数据拉取、缓存、并发控制、图片 HEAD 校验
│  │  ├─ derive.ts              # 总进度、最近更新、发布日志等派生口径
│  │  ├─ markdown.ts            # Markdown 渲染（Shiki + Mermaid + 标题锚点）
│  │  ├─ mermaid.ts             # Mermaid 渲染配置（与 markdown.ts 共用中性主题）
│  │  └─ constants.ts           # 导航、阶段与状态文案
│  ├─ pages/                    # 路由（见下表）
│  └─ styles/global.css         # 设计 Token、暗色主题、排版与无障碍基础样式
├─ astro.config.mjs             # 静态输出、站点地址、远程图片、DATA_BASE 构建守卫
├─ package.json
└─ tsconfig.json
```

## 快速开始

### 1. 启动数据服务

框架本身不含业务数据。先在同级数据仓库启动静态 HTTP 服务（默认 `4321`）：

```powershell
cd ../plv-studio-data-plv
python -m http.server 4321 --bind 127.0.0.1
```

没有 Python 时可用：`npx --yes serve . -l 4321`。

### 2. 安装依赖并启动开发服务

```powershell
# 在 plv-studio-framework 目录
npm install

$env:DATA_BASE = 'http://127.0.0.1:4321'
npm run dev -- --port 4320
```

> Astro 开发服务默认端口也是 `4321`，会与数据服务冲突，因此显式改用 `4320`。
> 打开 <http://localhost:4320/>。

### 3. 常用命令

| 命令 | 说明 | 需要 `DATA_BASE` |
| --- | --- | --- |
| `npm run dev` | 开发服务器，支持热更新 | 是（页面渲染时） |
| `npm run check` | `astro check` 类型与模板检查 | 否 |
| `npm run validate:data` | 只拉取并校验数据，输出作品/文档/能力数量 | 是 |
| `npm run build` | 预渲染全部页面到 `dist/` | 是（缺失直接失败） |
| `npm run preview` | 本地预览构建产物 | 否（读取 `dist/`） |

PowerShell 下为命令单独注入环境变量：

```powershell
$env:DATA_BASE = 'http://127.0.0.1:4321'
npm run build
npm run preview -- --port 4322
```

## 环境变量

| 变量 | 必填 | 默认值 | 用途 |
| --- | --- | --- | --- |
| `DATA_BASE` | 是 | 无 | 数据仓库基址，如 `http://127.0.0.1:4321` 或线上数据站点地址；框架不会回退到线上默认值 |
| `SITE_URL` | 否 | `https://plvstudio.pages.dev` | 写入 Astro `site`；站点级 sitemap 以 `profile.json` 的 `seo.siteUrl` 为准 |

`astro.config.mjs` 注册了构建守卫：`npm run build` 时缺少 `DATA_BASE` 会直接抛错；同时会从 `DATA_BASE` 推导 Astro 远程图片的 `remotePatterns`。

## 路由

| 路由 | 页面 |
| --- | --- |
| `/` | 首页：Hero、工作室概览、精选作品、正在开发、能力与证据、发布日志、通用开发流程 |
| `/projects/` | 作品列表 |
| `/projects/[slug]/` | 作品详情：痛点方案价值、架构与流程、项目概览、进度时间线、设计文档、验收上线 |
| `/projects/[slug]/docs/[docId]/` | 公开设计文档（仅 `visibility: public`） |
| `/about/` | 关于：简介、工作方式、技术栈、公开入口 |
| `/404.html` | 404 页 |
| `/sitemap.xml`、`/robots.txt` | 构建期生成 |

## 数据约定

框架只读取数据，不写入数据。数据仓库结构：

```
profile.json                 品牌、作者、Hero、精选 slug、SEO
works/index.json             作品 slug 列表（顺序即展示顺序）
works/{slug}.json            作品元数据（封面、链接、文档索引等）
progress.json                八阶段进度与 changelog
skills.json                  能力与证据（可选）
documents/{slug}/{doc-id}.md 设计文档正文
images/                      封面、头像、OG 图
```

- 所有 JSON 必须含 `"schemaVersion": "1.0"`，`slug` 仅允许小写字母、数字、连字符。
- `private` 文档不会被请求、索引或生成路由。
- 构建期会校验：索引与作品文件双向一致、进度 key 与作品集合一致、封面/头像/架构图存在（HEAD 请求）。
- 数据拉取内置 6 路并发、10 秒超时、2 次重试与模块级缓存；失败信息统一输出「文件 / 字段 / 规则编号 / 原因」。
- 百分比、最近更新时间、发布日志等派生值一律由 `src/lib/derive.ts` 计算，数据文件不存储。

## 设计与主题

设计 Token 集中在 `src/styles/global.css`：

- **色彩**：Swiss 风格红黑白灰；品牌砖红 `#c8553d`，暗色主题自动切换为 `#e07a5f`，只覆盖语义变量，不复制组件样式。
- **字体**：正文 `Inter / PingFang SC` 无衬线；`h1`、`h2` 使用衬线栈（Playfair Display → Georgia → 宋体）；页面中的英文与数字由 `BaseLayout` 脚本自动包裹为 `.u-mono` 等宽字体。
- **布局**：容器 1280px，间距 4px 基准，圆角 2/4/8/12px，卡片细边框、不使用默认阴影。
- **主题**：`ThemeScript` 在首屏前恢复主题，支持 浅色 / 深色 / 跟随系统，并同步 `meta[name="theme-color"]`。
- **无障碍与动效**：Focus-visible 轮廓、SkipLink、移动菜单焦点陷阱、`prefers-reduced-motion` 全量降级、首页区块渐显。

修改视觉时优先调整 Token 与基础组件，不要在页面里写死颜色或间距。

## 部署

框架按 Cloudflare Pages 静态站点部署：

| 配置项 | 值 |
| --- | --- |
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| 环境变量 | `DATA_BASE`（线上数据站点地址）、`SITE_URL`（正式域名） |
| 缓存 / 安全头 | `public/_headers` 原样复制到产物 |

数据仓库 push 后由 Cloudflare Pages 数据项目自动部署，并通过 Deploy Hook 触发框架重新构建，约 1 ~ 2 分钟生效。

## 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| `DATA_BASE 未设置` | 注入 `DATA_BASE` 后重试；构建守卫不会回退到线上地址 |
| `ECONNREFUSED` / 请求超时 | 数据服务未启动或端口不一致，确认 `http://127.0.0.1:4321/profile.json` 可访问 |
| 文档 404 | 检查 `works/{slug}.json` 的 `documents` 条目与 `documents/{slug}/{doc-id}.md` 是否对应且为 `public` |
| 图片校验失败（V-11） | JSON 引用的封面/头像路径在数据仓库中不存在 |
| `npm run dev` 端口被占用 | 数据服务占用 4321，改用 `-- --port 4320` |
| 页面路径 404 | 全站强制尾斜杠，站内链接需以 `/` 结尾 |

## 质量基线

提交前建议依次执行：

```powershell
npm run check
$env:DATA_BASE = 'http://127.0.0.1:4321'
npm run validate:data
npm run build
```

要求：`check` 0 error / 0 warning；数据校验通过；全部页面构建成功（页面数量随数据仓库中的作品与公开文档变化）。
