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
  assert.match(index, /One X post, one page\. Share the link anywhere\./);
  assert.doesNotMatch(index, /Share the link anywhere \(/);
  assert.match(index, /2026-11-03 07:01 UTC/);
  assert.match(index, /aria-label="Color theme"/);
  assert.match(index, /data-theme-set="system"[^>]*aria-pressed="true"[^>]*>Auto<\/button>/);
  assert.match(index, /data-theme-set="day"[^>]*>Day<\/button>/);
  assert.match(index, /data-theme-set="night"[^>]*>Night<\/button>/);
  assert.match(index, /localStorage\.getItem\("xgr-theme"\)/);
  assert.match(index, /<html lang="en">/);
  assert.doesNotMatch(index, /<html[^>]*\sdata-theme=/);
  assert.match(index, /Original content belongs to its authors/);
  const indexChrome = index.replace(/<ul class="index">[\s\S]*?<\/ul>/, "");
  assert.doesNotMatch(indexChrome, /[\u4e00-\u9fff]/);

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
    assert.match(html, /<h2 id="summary-heading">AI summary<\/h2>/);
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
  const summaryAt = sample.indexOf('<h2 id="summary-heading">AI summary</h2>');
  const originalAt = sample.indexOf('<h2 id="original-heading">Original</h2>');
  assert.ok(sourceAt >= 0 && summaryAt >= 0 && originalAt >= 0);
  assert.ok(sourceAt < summaryAt && summaryAt < originalAt, "DOM order is Source, then Summary, then Original");
  assert.match(sample, /data-lang="en"[^>]*aria-pressed="true"/);
  assert.match(sample, /data-lang="zh"[^>]*aria-pressed="false"[^>]*>中文<\/button>/);
  assert.match(sample, /aria-label="Summary language"/);
  assert.ok(sample.indexOf('class="summary-body is-en"') < sample.indexOf('id="summary-zh"'));
  assert.doesNotMatch(englishSummary, /认知投降/);
  assert.match(sample, /<time datetime="2026-11-03T07:01:29\.000Z">2026-11-03 07:01 UTC<\/time>/);
  assert.doesNotMatch(sample, />2026-11-03T07:01:29\.000Z</);
  assert.match(sample, /aria-label="Color theme"/);
  assert.match(sample, /data-theme-set="system"[^>]*aria-pressed="true"/);
  assert.match(sample, /lang="en"/);
  assert.doesNotMatch(original, /[\u4e00-\u9fff]/);
  assert.match(sample, /href="https:\/\/x\.com\/addyosmani\/status\/2117512471930167377"/);
  assert.match(original, /<h3>Offloading, deferral and surrender<\/h3>/);
  assert.match(original, /Back in the day, critical thinking/);
  assert.match(original, /Think independently/);
  assert.doesNotMatch(sample, /<script\b[^>]*\bsrc=/i);
  assert.equal(fs.existsSync(path.join(root, "_site", "css", "site.css")), true);
  assert.match(sample, /href="\/x-good-reads\/favicon\.svg"/);
  assert.equal(fs.existsSync(path.join(root, "_site", "favicon.svg")), true);

  const indexTemplate = fs.readFileSync(path.join(root, "src", "index.njk"), "utf8");
  assert.match(indexTemplate, /No posts yet/);
  assert.match(indexTemplate, /Unknown author/);
  const postTemplate = fs.readFileSync(path.join(root, "src", "post.njk"), "utf8");
  assert.match(postTemplate, /No summary yet\. Add a summary in the content file, then publish\./);
  assert.match(postTemplate, /English summary unavailable\./);
  assert.match(postTemplate, /Chinese summary unavailable\./);
  assert.match(postTemplate, /post\.summary_en and post\.summary_zh/);
  assert.match(postTemplate, /Unknown/);
  assert.match(postTemplate, /Post image/);

  const css = fs.readFileSync(path.join(root, "src", "css", "site.css"), "utf8");
  assert.match(css, /--bg:\s*#ffffff/);
  assert.match(css, /--surface:\s*#fafafa/);
  assert.match(css, /--surface-soft:\s*#f7f7f7/);
  assert.match(css, /--ink:\s*#0a0a0a/);
  assert.match(css, /--ink-soft:\s*#2e2e2e/);
  assert.match(css, /--muted:\s*#6b6b6b/);
  assert.match(css, /--line:\s*#ebebeb/);
  assert.match(css, /--accent:\s*#0a0a0a/);
  assert.match(css, /--hover-tint:\s*rgba\(0,0,0,0\.03\)/);
  assert.match(css, /--bg:\s*#0d0d0d/);
  assert.match(css, /--surface:\s*#141414/);
  assert.match(css, /--ink:\s*#f5f5f5/);
  assert.match(css, /--muted:\s*#9a9a9a/);
  assert.match(css, /--line:\s*#2a2a2a/);
  assert.match(css, /--hover-tint:\s*rgba\(255,255,255,0\.04\)/);
  assert.match(css, /--accent:\s*#f5f5f5/);
  assert.match(css, /\[data-theme="night"\]/);
  assert.match(css, /prefers-color-scheme:\s*dark/);
  assert.match(css, /:root:not\(\[data-theme="day"\]\):not\(\[data-theme="night"\]\)/);
  assert.match(css, /--radius-sm:\s*4px/);
  assert.match(css, /--radius-md:\s*6px/);
  assert.match(css, /--shadow:\s*none/);
  assert.match(css, /--measure:\s*36rem/);
  assert.match(css, /--measure-index:\s*40rem/);
  assert.match(css, /--t3-lh:\s*1\.7/);
  assert.match(css, /--t4-lh:\s*1\.55/);
  assert.match(css, /--t1-track:\s*-0\.025em/);
  assert.match(css, /--font-ui:\s*"Inter", system-ui, -apple-system, "Segoe UI", "Helvetica Neue",\s*"PingFang SC", "Noto Sans SC", Arial, sans-serif/);
  assert.match(css, /font-family:\s*"Inter"/);
  assert.doesNotMatch(css, /#f4f1ea|#fbfaf7|#0c5c3a|#e8f2ec|#1a1714/);
  assert.doesNotMatch(css, /--font-en-serif|Iowan Old Style|Georgia|Palatino/);
  assert.doesNotMatch(css, /border-radius:\s*1[2-9]px/);
  assert.doesNotMatch(indexTemplate, /display:\s*grid/);
  assert.match(css, /\.summary:has\(\.is-en\):has\(\.is-zh\):not\(\.is-zh-on\)/);
  assert.match(css, /\.summary\.is-zh-on \.is-en,\s*\.summary:has\(#summary-zh:target\) \.is-en \{ display: none; \}/);
  assert.match(css, /\.summary\.is-zh-on \.is-zh,\s*\.summary:has\(#summary-zh:target\) \.is-zh \{ display: block; \}/);
  assert.deepEqual(summaryVisibility(false), { en: "block", zh: "none" });
  assert.deepEqual(summaryVisibility(true), { en: "none", zh: "block" });

  await assertToggleInChrome(sampleId);
});

function bodyBackground(page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

async function expectBackground(page, color) {
  await page.waitForFunction((expected) => getComputedStyle(document.body).backgroundColor === expected, color);
  assert.equal(await bodyBackground(page), color);
}

function themeTokens(page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      ["--bg", "--surface", "--muted", "--line", "--hover-tint", "--ink"].map((key) => [key, style.getPropertyValue(key).trim()])
    );
  });
}

async function assertCraftOptics(page, homeUrl, postUrl) {
  await page.evaluate(() => document.fonts.ready);
  const read = () => page.evaluate(() => {
    const cs = (sel) => getComputedStyle(document.querySelector(sel));
    const contentLeft = (sel) => {
      const el = document.querySelector(sel);
      const rect = el.getBoundingClientRect();
      return rect.left + parseFloat(cs(sel).paddingLeft);
    };
    const contentRight = (sel) => {
      const el = document.querySelector(sel);
      const rect = el.getBoundingClientRect();
      return rect.right - parseFloat(getComputedStyle(el).paddingRight);
    };
    const summary = cs(".summary-body");
    const original = cs(".original-body");
    const pressed = document.querySelector('.theme-switch button[aria-pressed="true"]');
    const pressedStyle = getComputedStyle(pressed);
    return {
      root: parseFloat(getComputedStyle(document.documentElement).fontSize),
      summary: parseFloat(summary.fontSize),
      original: parseFloat(original.fontSize),
      summaryWeight: summary.fontWeight,
      originalWeight: original.fontWeight,
      summaryLh: summary.lineHeight,
      originalLh: original.lineHeight,
      h1: parseFloat(cs("h1").fontSize),
      top: document.querySelector(".top").getBoundingClientRect().height,
      segHeight: pressedStyle.height,
      segBg: pressedStyle.backgroundColor,
      segRadius: pressedStyle.borderRadius,
      segWeight: pressedStyle.fontWeight,
      segBorder: pressedStyle.borderBottomWidth,
      segFont: pressedStyle.fontSize,
      hit: getComputedStyle(pressed, "::before").height,
      left: {
        top: contentLeft(".top-inner"),
        h1: contentLeft("h1"),
        summary: contentLeft(".summary-body"),
        original: contentLeft(".original-body")
      },
      right: {
        top: contentRight(".top-inner"),
        h1: contentRight("h1"),
        summary: contentRight(".summary-body"),
        original: contentRight(".original-body")
      },
      metaTop: parseFloat(cs(".meta").marginTop),
      summaryPad: parseFloat(cs(".summary").paddingTop),
      originalGap: parseFloat(cs(".original").marginTop)
    };
  });

  const narrow = await read();
  assert.equal(narrow.root, 16);
  assert.equal(narrow.summary, 15);
  assert.equal(narrow.original, 17);
  assert.ok(narrow.original - narrow.summary >= 2);
  assert.notEqual(narrow.summaryWeight, narrow.originalWeight);
  assert.notEqual(narrow.summaryLh, narrow.originalLh);
  assert.equal(narrow.h1, 28);
  assert.ok(narrow.h1 - narrow.original >= 10);
  assert.ok(Math.abs(narrow.top - 48) <= 1, `top ${narrow.top}`);
  assert.equal(narrow.segHeight, "24px");
  assert.equal(narrow.segBg, "rgba(0, 0, 0, 0)");
  assert.equal(narrow.segRadius, "0px");
  assert.equal(narrow.segWeight, "600");
  assert.equal(narrow.segBorder, "1px");
  assert.equal(narrow.segFont, "12px");
  assert.equal(narrow.hit, "44px");
  assert.equal(narrow.metaTop, 12);
  assert.equal(narrow.summaryPad, 24);
  assert.equal(narrow.originalGap, 32);
  for (const edge of [narrow.left, narrow.right]) {
    assert.ok(Math.abs(edge.top - edge.h1) <= 1, JSON.stringify(edge));
    assert.ok(Math.abs(edge.summary - edge.h1) <= 1, JSON.stringify(edge));
    assert.ok(Math.abs(edge.original - edge.h1) <= 1, JSON.stringify(edge));
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  const wide = await read();
  assert.equal(wide.root, 16);
  assert.equal(wide.summary, 15);
  assert.equal(wide.original, 18);
  assert.equal(wide.h1, 32);
  assert.ok(wide.h1 - wide.original >= 10);
  for (const edge of [wide.left, wide.right]) {
    assert.ok(Math.abs(edge.top - edge.h1) <= 1, JSON.stringify(edge));
    assert.ok(Math.abs(edge.summary - edge.h1) <= 1, JSON.stringify(edge));
    assert.ok(Math.abs(edge.original - edge.h1) <= 1, JSON.stringify(edge));
  }

  await page.goto(homeUrl);
  await page.waitForSelector(".index");
  const home = await page.evaluate(() => {
    const h1 = getComputedStyle(document.querySelector("h1"));
    const title = getComputedStyle(document.querySelector(".index-title"));
    const byline = getComputedStyle(document.querySelector(".byline"));
    const left = (sel) => {
      const el = document.querySelector(sel);
      return el.getBoundingClientRect().left + parseFloat(getComputedStyle(el).paddingLeft);
    };
    return {
      h1: parseFloat(h1.fontSize),
      title: parseFloat(title.fontSize),
      titleWeight: title.fontWeight,
      byline: parseFloat(byline.fontSize),
      bylineColor: byline.color,
      titleColor: title.color,
      list: getComputedStyle(document.querySelector(".index")).listStyleType,
      pad: parseFloat(getComputedStyle(document.querySelector(".index a")).paddingTop),
      edges: { top: left(".top-inner"), h1: left("h1"), title: left(".index-title") }
    };
  });
  assert.equal(home.h1, 24);
  assert.equal(home.title, 14);
  assert.equal(home.titleWeight, "500");
  assert.equal(home.byline, 12);
  assert.notEqual(home.bylineColor, home.titleColor);
  assert.equal(home.list, "none");
  assert.equal(home.pad, 16);
  assert.ok(Math.abs(home.edges.top - home.edges.h1) <= 1, JSON.stringify(home.edges));
  assert.ok(Math.abs(home.edges.title - home.edges.h1) <= 1, JSON.stringify(home.edges));
  const indexLink = page.locator(".index a").first();
  await indexLink.hover();
  const hover = await indexLink.evaluate((node) => getComputedStyle(node).backgroundColor);
  assert.equal(hover, "rgba(0, 0, 0, 0.03)");

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(postUrl);
}

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
    const postUrl = `http://127.0.0.1:${port}/x-good-reads/x/${sampleId}/`;
    const homeUrl = `http://127.0.0.1:${port}/x-good-reads/`;
    await page.goto(postUrl);
    await page.emulateMedia({ colorScheme: "light" });
    await assertCraftOptics(page, homeUrl, postUrl);
    const display = (selector) => page.locator(selector).evaluate((node) => getComputedStyle(node).display);
    assert.equal(await display(".is-en"), "block");
    assert.equal(await display(".is-zh"), "none");
    assert.equal(await page.locator('button[data-lang="en"]').getAttribute("aria-pressed"), "true");
    assert.match(await page.locator(".is-en").innerText(), /cognitive surrender/);
    await page.locator('button[data-lang="zh"]').click();
    assert.equal(await page.locator('button[data-lang="zh"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator('button[data-lang="en"]').getAttribute("aria-pressed"), "false");
    assert.equal(await display(".is-en"), "none");
    assert.equal(await display(".is-zh"), "block");
    assert.match(await page.locator(".is-zh").innerText(), /认知投降/);
    const zhType = await page.evaluate(() => {
      const summary = getComputedStyle(document.querySelector(".summary-body.is-zh"));
      const original = getComputedStyle(document.querySelector(".original-body"));
      return {
        summary: parseFloat(summary.fontSize),
        original: parseFloat(original.fontSize),
        summaryWeight: summary.fontWeight,
        originalWeight: original.fontWeight
      };
    });
    assert.ok(zhType.original - zhType.summary >= 2);
    assert.notEqual(zhType.summaryWeight, zhType.originalWeight);
    await page.locator('button[data-lang="en"]').click();
    assert.equal(await page.locator('button[data-lang="en"]').getAttribute("aria-pressed"), "true");
    assert.equal(await display(".is-en"), "block");
    assert.equal(await display(".is-zh"), "none");

    await page.evaluate(() => localStorage.removeItem("xgr-theme"));
    await page.reload();
    await page.emulateMedia({ colorScheme: "dark" });
    assert.equal(await page.locator("html").getAttribute("data-theme"), null);
    assert.equal(await page.locator('[data-theme-set="system"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator('[data-theme-set="day"]').getAttribute("aria-pressed"), "false");
    assert.equal(await page.locator('[data-theme-set="night"]').getAttribute("aria-pressed"), "false");
    await expectBackground(page, "rgb(13, 13, 13)");

    await page.locator('[data-theme-set="day"]').click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "day");
    assert.equal(await page.locator('[data-theme-set="day"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.evaluate(() => localStorage.getItem("xgr-theme")), "day");
    await expectBackground(page, "rgb(255, 255, 255)");
    assert.deepEqual(await themeTokens(page), {
      "--bg": "#ffffff",
      "--surface": "#fafafa",
      "--muted": "#6b6b6b",
      "--line": "#ebebeb",
      "--hover-tint": "rgba(0,0,0,0.03)",
      "--ink": "#0a0a0a"
    });
    await page.reload();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "day");
    assert.equal(await page.locator('[data-theme-set="day"]').getAttribute("aria-pressed"), "true");
    await expectBackground(page, "rgb(255, 255, 255)");

    await page.locator('[data-theme-set="night"]').click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "night");
    assert.equal(await page.evaluate(() => localStorage.getItem("xgr-theme")), "night");
    await expectBackground(page, "rgb(13, 13, 13)");
    assert.deepEqual(await themeTokens(page), {
      "--bg": "#0d0d0d",
      "--surface": "#141414",
      "--muted": "#9a9a9a",
      "--line": "#2a2a2a",
      "--hover-tint": "rgba(255,255,255,0.04)",
      "--ink": "#f5f5f5"
    });
    await page.reload();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "night");
    assert.equal(await page.locator('[data-theme-set="night"]').getAttribute("aria-pressed"), "true");

    await page.locator('[data-theme-set="system"]').click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), null);
    assert.equal(await page.evaluate(() => localStorage.getItem("xgr-theme")), "system");
    assert.equal(await page.locator('[data-theme-set="system"]').getAttribute("aria-pressed"), "true");
    await page.emulateMedia({ colorScheme: "light" });
    await expectBackground(page, "rgb(255, 255, 255)");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
