# Chinese and source-content whitelist

These fields are content. This track does not translate them and does not change their bytes.

Compared with base `5f9567a33aba75a83ae345feb6af4b600c093d77`:

- `git diff --exit-code` on `content/`, `src/lib/render.js`, `src/lib/posts.js`, `src/css/site.css`, and `site.config.js` exited 0.
- Every field below has the same sha256 as that base. `unchanged=true` means the whole JSON file matches the base blob, so `images` and `videos` are covered too.
- Visible text of `h1`, English summary, Chinese summary, original body, and the document title matches a build of that base (see `semantic-html.txt`). URLs and status ids are still in the page.

`lang` is not a content edit:

- `summary_zh` stays `lang="zh-CN"`.
- English `summary_en` stays `lang="en"`.
- Original body uses the block language. The English post is `lang="en"`. The Chinese post (`2117762468177183064`) is `lang="zh-CN"` on `.original-body` only, so the English heading “Original” is not marked Chinese and the Chinese body is not marked English.
- Author display `杀破狼 WolfyXBT` is wrapped with `lang="zh-CN"`. The name string is unchanged.
- A Latin-majority string with only a trace of Han is left unlabeled. It is not stamped `lang="en"`.

Field hashes: `content-whitelist.csv`.

| File | Fields kept |
| --- | --- |
| content/x/2117512471930167377.json | status_id, title, author_name, author_handle, created_at, original_url, summary_en, summary_zh, full_text |
| content/x/2117762468177183064.json | status_id, title, author_name, author_handle, created_at, original_url, summary_en, summary_zh, full_text |

Markdown still drops `###` and list markers when it becomes visible text. `src/lib/render.js` is unchanged, and the visible hashes match the base build, so that is not a rewrite by this track.
