# UI string inventory · x-good-reads

Machine-readable copy: `ui-inventory.csv`. Built at `f156a58016c3340adb7f1a45d79558cec78e77de`.

Routes that exist: index `/`, post `/x/<status_id>/`. There is no filter, pager, archive, or skip link, so those dictionary rows were not added.

Shell `html lang` stays `en`. Chinese content blocks are tagged `zh-CN` and are not in this UI list.

| Route | Kind | Text | Action |
| --- | --- | --- | --- |
| all | nav | Home | already English |
| all | brand | X Good Reads | product name, kept |
| all | group aria | Color theme | already English, kept |
| all | button | Auto / Day / Night | already English |
| all | visible | Top | was 回顶 |
| all | aria + title | Back to top | was 回顶; title added |
| index | lede | One X post, one page. Share the link anywhere. | already English |
| index | empty | No posts yet. | already English; dictionary “No entries yet.” not forced onto a different existing sentence |
| index | fallback | Unknown author | already English |
| index | cta | Read | already English |
| post | headings | Source, AI summary, Original | already English |
| post | definition terms | Author, Handle, Published, Original | already English |
| post | link | Open on X | already English |
| post | group aria | Summary language | already English, kept |
| post | button | English | was EN |
| post | button + noscript | Chinese | was 中文 |
| post | note / missing | AI-generated… / Chinese summary unavailable. / English summary unavailable. / No summary yet… | already English |
| post | media | Post video, Post image | already English |
| all | footer | Original content belongs to its authors… | already English |

Not present, not invented: Show more, Show less, Previous, Next, Archive, Copy link, Skip to content, Loading…, Try again, No results found., Morning, Afternoon, Trending, Newcomers, Papers, Appendix.

Templates `src/_includes/base.njk`, `src/index.njk`, `src/post.njk`, `src/css/site.css`, and `site.config.js` contain no Han characters after this change.
