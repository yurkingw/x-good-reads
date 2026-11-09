import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { residualHan } from "../test/lib/ui-scan.js";

const root = process.cwd();
const base = process.env.BASE_SHA || "";

function walk(dir, pred, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, pred, out);
    else if (pred(entry.name)) out.push(full);
  }
  return out;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function csv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const uiRows = [[
  "route",
  "kind",
  "source",
  "text",
  "dictionary",
  "action"
]];

function add(route, kind, source, text, dictionary, action) {
  uiRows.push([route, kind, source, text, dictionary, action]);
}

add("all", "nav", "base.njk", "Home", "首页 → Home", "already English");
add("all", "brand", "base.njk / site.config.js", "X Good Reads", "product name", "kept");
add("all", "group", "base.njk aria-label", "Color theme", "主题 → Theme", "already English; kept (no new label)");
add("all", "button", "base.njk", "Auto", "主题随系统 → Auto", "already English");
add("all", "button", "base.njk", "Day", "日间 → Day", "already English");
add("all", "button", "base.njk", "Night", "夜间 → Night", "already English");
add("all", "button-visible", "base.njk .back-to-top", "Top", "回顶可见 → Top", "changed from 回顶");
add("all", "aria-label", "base.njk .back-to-top", "Back to top", "回顶 aria → Back to top", "changed from 回顶");
add("all", "title", "base.njk .back-to-top", "Back to top", "回顶 title → Back to top", "added title");
add("index", "h1", "index.njk", "X Good Reads", "product name", "kept");
add("index", "lede", "index.njk / site.config.js", "One X post, one page. Share the link anywhere.", "", "already English");
add("index", "empty", "index.njk", "No posts yet.", "暂无条目 → No entries yet.", "already English; kept (no 暂无条目 control)");
add("index", "fallback", "index.njk", "Unknown author", "", "already English");
add("index", "cta", "index.njk", "Read", "阅读 → Read", "already English");
add("post", "h2", "post.njk", "Source", "来源 → Source", "already English");
add("post", "dt", "post.njk", "Author", "", "already English");
add("post", "dt", "post.njk", "Handle", "", "already English");
add("post", "dt", "post.njk", "Published", "", "already English");
add("post", "dt", "post.njk", "Original", "", "already English");
add("post", "fallback", "post.njk", "Unknown", "", "already English");
add("post", "link", "post.njk", "Open on X", "在 X 打开 → Open on X", "already English");
add("post", "h2", "post.njk", "AI summary", "", "already English");
add("post", "group", "post.njk aria-label", "Summary language", "语言 → Language", "already English; kept");
add("post", "button", "post.njk", "English", "英语 / EN → English", "changed from EN");
add("post", "button", "post.njk", "Chinese", "中文（控件）→ Chinese", "changed from 中文");
add("post", "noscript", "post.njk", "Chinese", "中文（控件）→ Chinese", "changed from 中文");
add("post", "note", "post.njk", "AI-generated for skimming. Not a substitute for the original.", "", "already English");
add("post", "missing", "post.njk", "Chinese summary unavailable.", "", "already English");
add("post", "missing", "post.njk", "English summary unavailable.", "", "already English");
add("post", "missing", "post.njk", "No summary yet. Add a summary in the content file, then publish.", "", "already English");
add("post", "h2", "post.njk", "Original", "", "already English");
add("post", "aria-label", "post.njk video", "Post video", "", "already English");
add("post", "alt", "post.njk img", "Post image", "", "already English");
add("all", "footer", "site.config.js", "Original content belongs to its authors. This site is a readable archive; the source post is authoritative.", "", "already English");
add("all", "meta", "site.config.js description", "One X post, one page. Share the link anywhere.", "", "already English");
add("none", "absent", "dictionary", "Show more / Show less / Previous / Next / Archive / Copy link / Skip to content / Loading… / Try again / No results found.", "遇到才用", "no such control; not added");

const hanUi = [];
for (const rel of ["src/_includes/base.njk", "src/index.njk", "src/post.njk", "src/css/site.css", "site.config.js"]) {
  const text = fs.readFileSync(path.join(root, rel), "utf8");
  if (/[\u4e00-\u9fff]/.test(text)) hanUi.push(rel);
}

const built = walk(path.join(root, "_site"), (name) => name.endsWith(".html"));
const scanRows = [["file", "back_to_top", "residual_han"]];
let scanFail = 0;
for (const file of built) {
  const html = fs.readFileSync(file, "utf8");
  const residual = residualHan(html);
  const tops = html.match(/class="back-to-top"/g) || [];
  if (residual || tops.length !== 1 || !html.includes(">Top</button>") || html.includes(">回顶<") || html.includes(">EN</button>") || html.includes(">中文</button>")) {
    scanFail += 1;
  }
  scanRows.push([path.relative(root, file), String(tops.length), residual || ""]);
}

const contentFiles = walk(path.join(root, "content"), (name) => name.endsWith(".json") || name.endsWith(".md")).sort();
const whiteRows = [[
  "file",
  "field",
  "sha256",
  "chars",
  "base_sha256",
  "unchanged",
  "rule"
]];
let semanticFail = 0;
for (const file of contentFiles) {
  const rel = path.relative(root, file);
  const current = fs.readFileSync(file);
  let baseRaw = null;
  if (base) {
    try {
      baseRaw = execFileSync("git", ["show", `${base}:${rel}`], { cwd: root });
    } catch {
      baseRaw = null;
      semanticFail += 1;
    }
  }
  const sameFile = baseRaw ? current.equals(baseRaw) : "";
  if (base && sameFile !== true) semanticFail += 1;
  const data = file.endsWith(".json") ? readJson(file) : {};
  const fields = ["status_id", "title", "author_name", "author_handle", "created_at", "original_url", "summary_en", "summary_zh", "full_text"];
  for (const field of fields) {
    const value = data[field] == null ? "" : String(data[field]);
    whiteRows.push([
      rel,
      field,
      sha256(value),
      String(value.length),
      baseRaw && file.endsWith(".json") ? sha256(String(readJsonBuffer(baseRaw)[field] ?? "")) : "",
      sameFile === "" ? "" : String(sameFile),
      "content whitelist; not translated"
    ]);
  }
}

function readJsonBuffer(buffer) {
  return JSON.parse(buffer.toString("utf8"));
}

const outDir = process.env.OUT_DIR || "";
const inventory = csv(uiRows);
const scan = csv(scanRows);
const white = csv(whiteRows);
const summary = {
  head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  base: base || null,
  templateHanFiles: hanUi,
  builtPages: built.length,
  scanFail,
  semanticFail,
  contentFiles: contentFiles.map((file) => path.relative(root, file))
};

if (outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "ui-inventory.csv"), inventory);
  fs.writeFileSync(path.join(outDir, "build-ui-scan.csv"), scan);
  fs.writeFileSync(path.join(outDir, "content-whitelist.csv"), white);
  fs.writeFileSync(path.join(outDir, "inventory-summary.json"), JSON.stringify(summary, null, 2) + "\n");
}

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (hanUi.length || scanFail || semanticFail) process.exitCode = 1;
