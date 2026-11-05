# X Good Reads

Turn one X post into a readable static HTML page, then send that page URL to a friend. `content/` in this repository is the only content source. The site publishes only to **GitHub Pages** (a project site).

Page order is fixed: the post title, then source (author, handle, time, link to the original post), then the AI summary, then the original text, then the footer notice. The summary opens in English. When both an English summary (`summary` or `summary_en`) and `summary_zh` are stored, EN / 中文 switches to Chinese.

## URLs

- Repository: https://github.com/yurkingw/x-good-reads
- Home: https://yurkingw.github.io/x-good-reads/
- Sample: https://yurkingw.github.io/x-good-reads/x/2117512471930167377/

Local preview: `npm ci`, then `npm run dev`, and open http://localhost:8080/x-good-reads/ . `pathPrefix` applies locally too.

## Enable Pages (one time)

Do this once, before or after merging to `main`:

1. Open [Settings → Pages](https://github.com/yurkingw/x-good-reads/settings/pages).
2. Under **Build and deployment → Source**, choose **GitHub Actions**. Do not choose Deploy from a branch.
3. If the `pages` workflow already failed because Pages was not enabled, re-run it from Actions.

A push to `main` runs the `pages` workflow (`.github/workflows/pages.yml`): install dependencies, run tests, and publish with `actions/deploy-pages`.

## 1. Add a post

### By hand

Add `content/x/<status_id>.json`, or a `.md` file with the same name. The filename must equal `status_id`. Commit to `main`, or open a PR and merge it. `pages` builds and deploys.

A `status_id` past JavaScript's safe integer range must be a string in JSON.

```json
{
  "status_id": "2117512471930167377",
  "title": "Title, optional",
  "author_name": "Addy Osmani",
  "author_handle": "addyosmani",
  "created_at": "2026-11-03T07:01:29.000Z",
  "original_url": "https://x.com/addyosmani/status/2117512471930167377",
  "summary_en": "English AI summary. It may be empty; the page will say it is not available yet.",
  "summary_zh": "Chinese AI summary. Optional. The page can switch to it.",
  "images": ["/media/x/2117512471930167377/photo.jpg"],
  "videos": [
    {
      "src": "/media/x/2117512471930167377/video.mp4",
      "poster": "/media/x/2117512471930167377/poster.jpg",
      "type": "video/mp4"
    }
  ],
  "full_text": "Original text. Keep the line breaks.\n\nSecond paragraph."
}
```

For Markdown, put the body after the front matter. Quote `status_id` the same way:

```md
---
status_id: "2117512471930167377"
title: "Title"
author_name: "Addy Osmani"
author_handle: "addyosmani"
created_at: "2026-11-03T07:01:29.000Z"
original_url: "https://x.com/addyosmani/status/2117512471930167377"
summary_en: |
  English summary
summary_zh: |
  Chinese summary
---

Original text
```

Do not store both `.json` and `.md` for the same id. The original text is rendered as Markdown: line breaks are kept, URLs become links, and images are shown. HTML in the original text is escaped. `images` and `videos` are rendered after the original text.

## Hosted media

Images, animated GIFs, and videos belong in this repository. Do not leave an X CDN hotlink (`pbs.twimg.com`, `video.twimg.com`, or any other `twimg.com` host) as the only copy.

- Hosting root: `media/x/<status_id>/` (for example `media/x/2117762468177183064/video.mp4` and `poster.jpg`). Eleventy publishes that directory with `addPassthroughCopy`. Store root-relative paths such as `/media/x/<status_id>/video.mp4` in JSON, without `pathPrefix`. The page template adds `pathPrefix`, so the project site serves `https://yurkingw.github.io/x-good-reads/media/x/<status_id>/<file>`.
- `images` stays a string array. Prefer a site path. An `https` URL is still allowed when the file is not on an X CDN.
- `"videos"` is an array of `{ "src", "poster"?, "type"? }`. `src` and `poster` use the same path rules as `images`. The original section renders `<video controls playsinline preload="metadata">` with a `<source>`. This site does not load a third-party player.
- External page URLs in the post text stay links (`rel="noreferrer noopener"`). The archive does not mirror those pages. It only stores image, GIF, and video files.
- Ingest, when it has to fetch the post, downloads images, animated GIFs, and videos into `media/x/<status_id>/` and rewrites `images` and `videos` to those site paths. If a download fails, ingest stops without writing a content file. A remote thumbnail is not a successful archive. Passing `full_text` still skips the fetch; put hosted files in `media/x/<status_id>/` yourself and point JSON at them. The workflow commits both `content/x` and `media/x`.
- Size: prefer each file under 25MB. A file over 50MB must be called out in the pull request. Do not commit a file over 95MB. The video on `2117762468177183064` is about 9.6MB and does not need Git LFS.
- The footer already says original content belongs to its authors. Files under `media/` keep the readable archive working when an X CDN hotlink disappears. This archive does not backfill older posts that have no media. A post that already points at X CDN media, including `2117762468177183064`, has to be hosted here.

## Share image

Every page sets `og:image` and `twitter:image` to the same absolute `https` URL. That URL is `site.baseUrl` plus a path under `media/`. It is never a root-relative path, and it never points at an X CDN host. `twitter:card` is `summary_large_image`. `twitter:title` and `twitter:description` use the same title and description as the Open Graph tags.

For a post, `src/lib/posts.js` chooses the path when the page data is loaded. Ingest does not write an image URL by hand. After it saves files under `media/x/<status_id>/` and rewrites `images` and `videos`, the next build follows those fields:

1. The first JPEG, PNG, GIF, or WebP already stored at `/media/x/<status_id>/<file>` in `images`, skipping a video poster. An animated GIF (`gif-<n>.gif`) uses its still first frame `gif-poster-<n>.jpg` when that file is in `images` or in the same directory. A `gif-poster-<n>.jpg` still counts here when it is also `videos[].poster`.
2. Otherwise the video poster: `videos[0].poster` when that path is on this site, or `media/x/<status_id>/poster.jpg` when the video has no poster field and that file exists.
3. Otherwise `media/site/og-default.jpg`.

The home page uses that same default file. Posters already in the repo (about 82KB) stay as they are. Keep each share image under 300KB.

Store the English summary in `summary_en` and the Chinese summary in `summary_zh`. The page shows English first. A lone `summary` is treated as English. `full_text` stays in the post's original language. If only one summary language is present, that text is shown and the language control is omitted.

### Summary length

An empty summary is allowed. The page then says none is available yet. A summary that is present must stay inside the hard max below. Count each language on its own.

| Language | Field | Target | Hard max | How to count |
| --- | --- | --- | --- | --- |
| English | `summary_en` (or `summary` when `summary_en` is empty) | 120–180 words | 250 words | `/\b[\w'-]+\b/g` |
| Chinese | `summary_zh` | 220–350 characters | 500 characters | Length after removing all whitespace: `len(re.sub(r'\s+','', text))`. Han characters and punctuation count. Spaces and line breaks do not. |

Form: one lead paragraph, or a lead paragraph plus at most five bullets. Point only at the thesis, the facts, and why the post is worth archiving. Do not restate the full post. Exception: an event timeline may reach the hard max, but it still must not approach the length of the original. Over the hard max is an ingest failure. Ingest checks `summary_en` and `summary_zh` before it writes, and it does not write a content file when either one is over the limit. Shorten the summary and run ingest again. Ingest does not commit a partial archive.

### Ingest with Actions

On the Actions page, choose the **ingest** workflow, select the **main** branch, fill in the inputs, and run it. You can also call the API; see the next section.

When `full_text` is set: the workflow writes `content/x/<status_id>.json`, and after tests pass it commits `content/x` and `media/x` to `main` and starts `pages` to publish. No local browser is required. Put image, GIF, and video files under `media/x/<status_id>/` yourself in this mode.

When only `tweet_url` or `status_id` is set: it tries `api.fxtwitter.com`, then `api.vxtwitter.com`. If a body comes back, it is archived and its images, GIFs, and videos are downloaded into `media/x/<status_id>/`. If the request is blocked, there is no body, or a media download fails, the workflow fails and does **not** write a partial file. A remote thumbnail is not a successful archive. X articles often come back as a short link only; for those posts the caller must pass `full_text`. Pass `summary_en` and `summary_zh` at the same time when you can. This repository's Action does not call a summary API.

If the body is very long and the dispatch API rejects the parameters, add the file by hand instead. A push from the default `GITHUB_TOKEN` does not trigger `on: push` again, so after a successful `ingest` the workflow dispatches `pages` once. Do not remove that step, or posts written by the bot will not show up on Pages.

`ingest` can be called only after this file is already on `main`.

## 2. Custom domain later

The site still publishes only through GitHub Pages. The host does not change.

1. Settings → Pages → Custom domain: enter the domain and configure DNS as in GitHub's docs. For a subdomain, add a CNAME to `yurkingw.github.io`.
2. Wait until the HTTPS certificate is active.
3. Edit `site.config.js`: set `pathPrefix` to `"/"`, and `baseUrl` to `https://your.domain` (no trailing slash, and do not include `/x-good-reads`).
4. Push to `main` and wait until `pages` is green.

Pages move from `https://yurkingw.github.io/x-good-reads/x/<id>/` to `https://your.domain/x/<id>/`.

## 3. Bot contract

- Workflow name: `ingest`
- File: `.github/workflows/ingest.yml`
- Trigger: `workflow_dispatch`, and `ref` must be `main`
- Publish workflow: `pages` (`.github/workflows/pages.yml`)

Input keys (all strings, all optional, but at least one of `tweet_url` and `status_id` must resolve to an id; pass `full_text` when you need a reliable archive):

| Key | Role |
| --- | --- |
| `tweet_url` | Original post URL, for example `https://x.com/addyosmani/status/2117512471930167377` |
| `status_id` | Numeric id only. When both this and `tweet_url` are set, they must match |
| `title` | Title. If empty, the first line of the body is used |
| `author_name` | Author display name |
| `author_handle` | Handle, without `@` |
| `created_at` | ISO 8601 timestamp in UTC. The page shows that same instant as `YYYY-MM-DD HH:MM UTC` |
| `full_text` | Original text, kept in its original language. When this is set, nothing is fetched |
| `summary` | English AI summary. Alias of `summary_en` when `summary_en` is empty. Same hard max of 250 words |
| `summary_en` | English AI summary. Shown by default. Target 120–180 words, hard max 250 words |
| `summary_zh` | Chinese AI summary. Optional. Shown when the reader switches to ZH. Target 220–350 characters, hard max 500 characters after whitespace is removed |

The caller generates the summaries. Length, form, the timeline exception, and the over-limit failure are defined in [Summary length](#summary-length). Over the hard max fails `scripts/ingest.js` before the workflow commits.

Send English on `summary_en` (or `summary`) and Chinese on `summary_zh`. Inputs are passed to `scripts/ingest.js` through environment variables. Do not switch this to shell expansion of `${{ inputs.full_text }}`.

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
    "full_text": "Original text…",
    "summary_en": "English summary…",
    "summary_zh": "Chinese summary…"
  }
}
```

The token needs Actions write permission on this repository. Whether the archive is published depends on the following `pages` run succeeding.

## 4. Check locally

```bash
npm ci
npm test
```

`npm test` builds `_site/` and checks that the sample page order is source, summary, original text, then footer.
