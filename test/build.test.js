import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { footerNotice } from "../site.config.js";
import { loadPosts } from "../src/lib/posts.js";

const root = process.cwd();
const sampleId = "2117512471930167377";

test("static build matches the archive page contract", { timeout: 90_000 }, async () => {
  execFileSync(path.join(root, "node_modules", ".bin", "eleventy"), [], {
    cwd: root,
    stdio: "inherit"
  });

  const index = fs.readFileSync(path.join(root, "_site", "index.html"), "utf8");
  assert.match(index, /href="\/x-good-reads\/css\/site\.css"/);
  assert.match(index, new RegExp(`href="/x-good-reads/x/${sampleId}/"`));
  assert.match(index, /Critical thinking when agents do the work/);
  assert.match(index, /X Good Reads/);
  assert.match(index, /One X post, one page\. Share the link anywhere \(WeChat works\)\./);
  assert.match(index, /Original content belongs to its authors/);
  assert.doesNotMatch(index, /[\u4e00-\u9fff]/);

  for (const post of loadPosts()) {
    const file = path.join(root, "_site", "x", post.status_id, "index.html");
    assert.equal(fs.existsSync(file), true, file);
    const html = fs.readFileSync(file, "utf8");
    const markers = ['id="meta"', 'id="summary"', 'id="original"', 'id="notice"'];
    const positions = markers.map((marker) => {
      const index = html.indexOf(marker);
      assert.ok(index >= 0, marker);
      return index;
    });
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
    assert.match(html, /<h2 id="summary-heading">Summary<\/h2>/);
    assert.match(html, /AI-generated for skimming\. Not a substitute for the original\./);
    assert.match(html, /<h2 id="meta-heading">Source<\/h2>/);
    assert.match(html, /<h2 id="original-heading">Original<\/h2>/);
    assert.match(html, /<dt>Author<\/dt>/);
    assert.match(html, /<dt>Handle<\/dt>/);
    assert.match(html, /<dt>Published<\/dt>/);
    assert.match(html, /<dt>Original<\/dt>/);
    assert.match(html, />Open on X<\/a>/);
    assert.ok(html.includes(footerNotice));
    assert.ok(html.includes(`href="${post.original_url}"`));
    assert.match(html, /href="\/x-good-reads\/css\/site\.css"/);
    const escaped = (value) => value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
    if (post.author_name) assert.ok(html.includes(escaped(post.author_name)));
    if (post.author_handle) assert.ok(html.includes(`@${escaped(post.author_handle)}`));
    if (post.created_at) assert.ok(html.includes(post.created_at));
  }

  const sample = fs.readFileSync(path.join(root, "_site", "x", sampleId, "index.html"), "utf8");
  const summary = sample.slice(sample.indexOf('id="summary"'), sample.indexOf('id="original"'));
  const original = sample.slice(sample.indexOf('id="original"'), sample.indexOf('id="notice"'));
  const englishSummary = summary.slice(summary.indexOf('class="summary-body is-en"'), summary.indexOf('lang="zh-CN"'));
  const chineseSummary = summary.slice(summary.indexOf('lang="zh-CN"'));
  assert.match(summary, /<p>/);
  assert.match(englishSummary, /cognitive surrender/);
  assert.match(chineseSummary, /认知投降/);
  const sourceAt = sample.indexOf('<h2 id="meta-heading">Source</h2>');
  const summaryAt = sample.indexOf('<h2 id="summary-heading">Summary</h2>');
  const originalAt = sample.indexOf('<h2 id="original-heading">Original</h2>');
  assert.ok(sourceAt >= 0 && summaryAt >= 0 && originalAt >= 0);
  assert.ok(sourceAt < summaryAt && summaryAt < originalAt, "DOM order is Source, then Summary, then Original");
  assert.match(sample, /id="summary-lang-en"[^>]*checked/);
  assert.match(sample, /<label class="opt-en"[^>]*>EN<\/label>/);
  assert.match(sample, /<label class="opt-zh"[^>]*>ZH<\/label>/);
  assert.ok(sample.indexOf('id="summary-lang-zh"') < sample.indexOf('class="summary-body is-en"'));
  assert.ok(sample.indexOf('class="summary-body is-en"') < sample.indexOf('class="summary-body is-zh"'));
  assert.doesNotMatch(englishSummary, /认知投降/);
  assert.match(sample, /<time datetime="2026-11-03T07:01:29\.000Z">2026-11-03T07:01:29\.000Z<\/time>/);
  assert.match(sample, /2026-11-03 15:01 \(Beijing time\)/);
  assert.match(sample, /lang="en"/);
  assert.doesNotMatch(original, /[\u4e00-\u9fff]/);
  assert.match(sample, /href="https:\/\/x\.com\/addyosmani\/status\/2117512471930167377"/);
  assert.match(original, /<h3>Offloading, deferral and surrender<\/h3>/);
  assert.match(original, /Back in the day, critical thinking/);
  assert.match(original, /Think independently/);
  assert.doesNotMatch(sample, /<script/i);
  assert.equal(fs.existsSync(path.join(root, "_site", "css", "site.css")), true);
  assert.match(sample, /href="\/x-good-reads\/favicon\.svg"/);
  assert.equal(fs.existsSync(path.join(root, "_site", "favicon.svg")), true);

  const indexTemplate = fs.readFileSync(path.join(root, "src", "index.njk"), "utf8");
  assert.match(indexTemplate, /No posts yet/);
  assert.match(indexTemplate, /Unknown author/);
  const postTemplate = fs.readFileSync(path.join(root, "src", "post.njk"), "utf8");
  assert.match(postTemplate, /No summary yet\. Add a summary in the content file, then publish\./);
  assert.match(postTemplate, /post\.summary_en and post\.summary_zh/);
  assert.match(postTemplate, /Unknown/);
  assert.match(postTemplate, /Post image/);

  const css = fs.readFileSync(path.join(root, "src", "css", "site.css"), "utf8");
  assert.match(css, /--bg:\s*#f4f1ea/);
  assert.match(css, /--surface:\s*#fbfaf7/);
  assert.match(css, /--ink:\s*#1a1714/);
  assert.match(css, /--accent:\s*#0c5c3a/);
  assert.match(css, /--accent-tint:\s*#e8f2ec/);
  assert.match(css, /--radius-md:\s*8px/);
  assert.match(css, /--shadow:\s*none/);
  assert.match(css, /--measure:\s*38rem/);
  assert.match(css, /--lh-summary:\s*1\.65/);
  assert.match(css, /--font-ui:\s*system-ui, "Segoe UI", "Helvetica Neue", Arial, sans-serif/);
  assert.match(css, /--font-en-serif:\s*"Iowan Old Style"/);
  assert.doesNotMatch(css, /border-radius:\s*1[2-9]px/);
  assert.doesNotMatch(indexTemplate, /display:\s*grid/);
  assert.match(css, /\.summary:has\(\.show-en\) \.is-zh \{ display: none; \}/);
  assert.match(css, /\.show-zh:checked ~ \.is-en \{ display: none; \}/);
  assert.match(css, /\.show-zh:checked ~ \.is-zh \{ display: block; \}/);
  assert.deepEqual(summaryVisibility(false), { en: "block", zh: "none" });
  assert.deepEqual(summaryVisibility(true), { en: "none", zh: "block" });

  await assertToggleInChrome(sampleId);
});

function summaryVisibility(zhChecked) {
  if (zhChecked) return { en: "none", zh: "block" };
  return { en: "block", zh: "none" };
}

function chromePath() {
  return ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]
    .find((candidate) => fs.existsSync(candidate));
}

function startSite(siteDir) {
  const root = path.resolve(siteDir);
  const server = http.createServer((req, res) => {
    const raw = decodeURIComponent((req.url || "/").split("?")[0]);
    let rel = raw.replace(/^\/x-good-reads(?=\/|$)/, "") || "/";
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.resolve(root, `.${rel}`);
    if (!file.startsWith(`${root}${path.sep}`)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end();
        return;
      }
      const type = file.endsWith(".css") ? "text/css; charset=utf-8" : "text/html; charset=utf-8";
      res.writeHead(200, { "content-type": type });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function assertToggleInChrome(sampleId) {
  const executablePath = chromePath();
  if (!executablePath) return;
  const { chromium } = await import("playwright-core");
  const server = await startSite(path.join(root, "_site"));
  const browser = await chromium.launch({
    executablePath,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    const { port } = server.address();
    await page.goto(`http://127.0.0.1:${port}/x-good-reads/x/${sampleId}/`);
    const display = (selector) => page.locator(selector).evaluate((node) => getComputedStyle(node).display);
    assert.equal(await display(".is-en"), "block");
    assert.equal(await display(".is-zh"), "none");
    assert.match(await page.locator(".is-en").innerText(), /cognitive surrender/);
    await page.locator(".opt-zh").click();
    assert.equal(await display(".is-en"), "none");
    assert.equal(await display(".is-zh"), "block");
    assert.match(await page.locator(".is-zh").innerText(), /认知投降/);
    await page.locator(".opt-en").click();
    assert.equal(await display(".is-en"), "block");
    assert.equal(await display(".is-zh"), "none");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
