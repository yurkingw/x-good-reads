# EN-xgr report

Track: x-good-reads only. EN-V1 and EN-V2 belong to briefings and were not done.

Brief sha256: `6a95006c3cdc69965d0c7e001f729d1e6707721fa6535ca0ba91ef4ffdc65555`.

Tested commit: `f156a58016c3340adb7f1a45d79558cec78e77de`.

Base: `5f9567a33aba75a83ae345feb6af4b600c093d77` (`main`).

Logs in this directory were produced at the tested commit. A later commit that only adds `evidence/en-xgr/` does not change templates, CSS, content, or tests. Check with:

`git diff f156a58016c3340adb7f1a45d79558cec78e77de HEAD -- . ':(exclude)evidence'`

## What changed

- Back to top visible text is `Top` only. `aria-label` and `title` are `Back to top`. Still one button, bottom-right, 44px hit area, hidden until the page has scrolled one viewport, `scrollTo` uses `auto` when reduced motion is requested and `smooth` otherwise.
- Summary language options are `English` and `Chinese`, including the noscript link.
- Chinese blocks are not labeled English: Chinese original body and the Chinese author name use `lang="zh-CN"`. The document shell stays `lang="en"`.
- No new navigation, filter, or theme control. No CSS edit. No content, URL, id, or hash edit. No font-size shrink. No new `overflow: hidden`.

## EN-V3 — PASS

UI inventory: `ui-inventory.csv` and `ui-inventory.md`.

Chinese content whitelist: `content-whitelist.md` and `content-whitelist.csv`.

Build scan of `_site/**/*.html` after removing `lang="zh-CN"` blocks: residual Han is empty, and each page has one Top button. `build-ui-scan.csv`. Templates listed in the inventory have no Han. Command 2 and 3 in `commands.txt`, exit 0.

## EN-V4 — PASS

Runtime, same `npm test` Chrome session (`EN_UI_RUNTIME`, exit 0):

- Visible text `Top`; aria and title `Back to top`; one control.
- At scroll 0 the button is hidden. After scrolling one viewport it is shown. Tab from the previous control focuses it. Outline style is `solid`.
- Enter under `prefers-reduced-motion: reduce` calls `scrollTo({ top: 0, behavior: "auto" })`.
- Space without reduced motion calls `behavior: "smooth"`.
- Hit target from `::before` is 44.

Both index and the sample post ship the same button in HTML. A screen recording was not captured: 录屏未验证. The pass is the assertion log, not a video.

## EN-V5 — PASS for overflow measurement; screenshots 未验证

`EN_UI_RUNTIME` rows, index and post, Day and Night, 1280×800 and 375×812:

- `maxOver` is 0 on every row (element boxes versus the viewport, tolerance 1px).
- `scrollWidth` equals `clientWidth`.
- English / Chinese / Auto / Day / Night pills report `cut: false`.
- Pressed Day is `rgb(47, 95, 158)` on white. Pressed Night is `rgb(181, 74, 74)` on white.

`html { overflow-x: clip }` is pre-existing and was not used as the proof. The proof is `getBoundingClientRect`. No screenshots were taken: 截图未验证. This pass is not a static-only claim.

Pre-existing, not introduced here: `.index-excerpt` line-clamp, `.byline` ellipsis. Index titles and post `h1` are not clamped. CSS file is unchanged versus base.

## EN-V6 — PASS

`commands.txt` item 4, exit 0: content files, renderer, post loader, CSS, and site config match the base.

`semantic-html.txt`, exit 0: visible title, both summaries, original body, and document title match a build of the base. Original URLs and status ids are present on both builds.

No title was restored or rewritten. There is no before/after content pair.

## EN-V7 — PASS for computed tokens; screenshots 未验证

`src/css/site.css` has no diff against the base, so Cairn colors, `--shadow-card`, and callout surfaces were not edited.

The same Chrome run waited until the pressed theme chip was day blue `#2f5f9e` / white and night red `#b54a4a` / white. Screenshot comparison against H-abs was not produced: 截图未验证.

## EN-V8 — local package PASS; CI 未验证

This directory is the evidence index.

| File | Role |
| --- | --- |
| REPORT.md | this verdict |
| manifest.json | HEAD, base, file hashes, commands |
| commands.txt | command, time, exit |
| npm-test.txt | `npm test` at the tested commit, 47 pass |
| ui-inventory.csv / ui-inventory.md | UI strings |
| content-whitelist.csv / content-whitelist.md | content left untranslated |
| build-ui-scan.csv | built HTML residual UI scan |
| semantic-html.txt | visible content versus base build |

GitHub Actions was not waited on. CI result: 未验证.

Not done: merge, deploy, public preview, a new dev server, a browser session outside `npm test`.

## Routes

| Page | Built file |
| --- | --- |
| Index | `_site/index.html` |
| Post 2117512471930167377 | `_site/x/2117512471930167377/index.html` |
| Post 2117762468177183064 | `_site/x/2117762468177183064/index.html` |
