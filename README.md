# X 可读存档

把一条 X 帖子收成一页可读的静态 HTML，把页面地址发给微信好友即可。仓库里的 `content/` 是唯一内容来源。站点只发布到 **GitHub Pages**（项目页）。

页面顺序固定为：AI 摘要 → 来源（作者、账号、时间、原帖链接）→ 原文 → 页脚声明。

## 地址

- 仓库：https://github.com/yurkingw/x-good-reads
- 首页：https://yurkingw.github.io/x-good-reads/
- 示例：https://yurkingw.github.io/x-good-reads/x/2117512471930167377/

本地预览：`npm ci` 然后 `npm run dev`，打开 http://localhost:8080/x-good-reads/ 。`pathPrefix` 在本地同样生效。

## 启用 Pages（只需点一次）

合并到 `main` 之前或之后做一次：

1. 打开 [Settings → Pages](https://github.com/yurkingw/x-good-reads/settings/pages)。
2. **Build and deployment → Source** 选择 **GitHub Actions**。不要选 Deploy from a branch。
3. 若 `pages` 工作流已经因为 Pages 未启用而失败，到 Actions 里重新运行它。

合并到 `main` 会跑工作流 `pages`（`.github/workflows/pages.yml`）：安装依赖、跑测试、用 `actions/deploy-pages` 发布。

## 1. 如何增加一篇

### 手动

新增 `content/x/<status_id>.json` 或同名 `.md`，文件名必须等于 `status_id`。提交到 `main`，或开 PR 合并。`pages` 会构建并部署。

`status_id` 超过 JavaScript 安全整数，JSON 里必须写成字符串。

```json
{
  "status_id": "2117512471930167377",
  "title": "标题，可省略",
  "author_name": "Addy Osmani",
  "author_handle": "addyosmani",
  "created_at": "2026-11-03T07:01:29.000Z",
  "original_url": "https://x.com/addyosmani/status/2117512471930167377",
  "summary_zh": "中文 AI 摘要。可以空，页面会标明尚未提供。",
  "images": ["https://example.com/photo.jpg"],
  "full_text": "原文。保留换行。\n\n第二段。"
}
```

Markdown 把正文放在 front matter 之后，`status_id` 同样加引号：

```md
---
status_id: "2117512471930167377"
title: "标题"
author_name: "Addy Osmani"
author_handle: "addyosmani"
created_at: "2026-11-03T07:01:29.000Z"
original_url: "https://x.com/addyosmani/status/2117512471930167377"
summary_zh: |
  中文摘要
---

原文正文
```

同一 id 不要同时放 `.json` 和 `.md`。原文按 Markdown 渲染：保留换行、把 URL 变成链接、显示图片；原文里的 HTML 会转义。`images` 里的 https 图片会附在正文后。图片地址若来自 X，在国内可能打不开或过期。

### 用 Actions 入库

Actions 页面选择工作流 **ingest**，分支选 **main**，填下面的输入后运行。也可以用 API，见下一节。

有 `full_text` 时：写入 `content/x/<status_id>.json`，测试通过后提交到 `main`，再启动 `pages` 发布。不需要本机浏览器。

只有 `tweet_url` 或 `status_id` 时：依次试 `api.fxtwitter.com` 和 `api.vxtwitter.com`。抓到正文就入库；被拦截或没有正文时，工作流失败，**不会**写半截文件。X 文章经常只返回一条短链，这种帖子请由调用方传入 `full_text`。建议同时传入 `summary_zh`。本仓库的 Action 不会调用摘要 API。

正文特别长、dispatch 接口报参数错误时，改用上面的手动文件。默认 `GITHUB_TOKEN` 的 push 不会再次触发 `on: push`，所以 `ingest` 成功后会再 `workflow_dispatch` 一次 `pages`。不要删掉这一步，否则机器人写入的文章不会出现在 Pages 上。

`ingest` 要等本文件已经在 `main` 上才能被调用。

## 2. 以后改自定义域名

站点仍然只走 GitHub Pages，不换托管。

1. Settings → Pages → Custom domain 填域名，按 GitHub 文档配 DNS。子域名用 CNAME 指向 `yurkingw.github.io`。
2. 等 HTTPS 证书生效。
3. 改 `site.config.js`：`pathPrefix` 改成 `"/"`，`baseUrl` 改成 `https://你的域名`（不要末尾斜杠，也不要带 `/x-good-reads`）。
4. 推到 `main`，等 `pages` 变绿。

页面会从 `https://yurkingw.github.io/x-good-reads/x/<id>/` 变成 `https://你的域名/x/<id>/`。

## 3. 机器人调用约定

- 工作流名称：`ingest`
- 文件：`.github/workflows/ingest.yml`
- 触发：`workflow_dispatch`，`ref` 必须是 `main`
- 发布工作流：`pages`（`.github/workflows/pages.yml`）

输入键（全部是字符串，均可省略，但 `tweet_url` 和 `status_id` 至少要有一个能解析出 id；要稳定入库请传 `full_text`）：

| 键 | 作用 |
| --- | --- |
| `tweet_url` | 原帖 URL，例如 `https://x.com/addyosmani/status/2117512471930167377` |
| `status_id` | 纯数字 ID。与 `tweet_url` 同时给出时必须一致 |
| `title` | 标题。空则取正文首行 |
| `author_name` | 作者显示名 |
| `author_handle` | 账号，不要带 `@` |
| `created_at` | ISO 8601 时间 |
| `full_text` | 原文。提供后不会再抓取 |
| `summary_zh` | 中文 AI 摘要 |

调用方生成摘要后从 `summary_zh` 传入。输入通过环境变量交给 `scripts/ingest.js`，不要改成在 shell 里展开 `${{ inputs.full_text }}`。

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/yurkingw/x-good-reads/actions/workflows/ingest.yml/dispatches \
  -d @payload.json
```

```json
{
  "ref": "main",
  "inputs": {
    "tweet_url": "https://x.com/addyosmani/status/2117512471930167377",
    "status_id": "2117512471930167377",
    "title": "Critical thinking when agents do the work",
    "author_name": "Addy Osmani",
    "author_handle": "addyosmani",
    "created_at": "2026-11-03T07:01:29.000Z",
    "full_text": "原文……",
    "summary_zh": "中文摘要……"
  }
}
```

令牌需要本仓库的 Actions 写权限。入库是否发布，看随后的 `pages` 运行是否成功。

## 4. 本地检查

```bash
npm ci
npm test
```

`npm test` 会构建 `_site/`，并检查示例页顺序：摘要、来源、原文、页脚。
