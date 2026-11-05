import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const INPUTS = [
  "tweet_url",
  "status_id",
  "title",
  "author_name",
  "author_handle",
  "created_at",
  "full_text",
  "summary",
  "summary_en",
  "summary_zh"
];

test("ingest workflow exposes the bot contract and dispatches Pages", () => {
  const ingest = fs.readFileSync(".github/workflows/ingest.yml", "utf8");
  assert.match(ingest, /^name: ingest$/m);
  for (const key of INPUTS) {
    assert.match(ingest, new RegExp(`^ {6}${key}:$`, "m"), key);
  }
  assert.match(ingest, /gh workflow run pages\.yml --ref main/);
  assert.match(ingest, /git add content\/x media\/x/);
  assert.doesNotMatch(ingest, /vercel|netlify|cloudflare/i);
});

test("pages workflow is the only publish path", () => {
  const pages = fs.readFileSync(".github/workflows/pages.yml", "utf8");
  assert.match(pages, /^name: pages$/m);
  assert.match(pages, /branches: \[main\]/);
  assert.match(pages, /workflow_dispatch:/);
  assert.match(pages, /actions\/upload-pages-artifact@v5/);
  assert.match(pages, /actions\/deploy-pages@v5/);
  assert.match(pages, /name: github-pages/);
  assert.doesNotMatch(pages, /vercel|netlify|gh-pages/i);
});

function countEnglishWords(text) {
  return (String(text).match(/\b[\w'-]+\b/g) || []).length;
}

function countChineseChars(text) {
  return String(text).replace(/\s+/g, "").length;
}

function summaryShape(text) {
  const lines = String(text).split("\n");
  const bulletAt = lines.findIndex((line) => /^\s*[-*]\s+\S/.test(line));
  const lead = (bulletAt === -1 ? String(text) : lines.slice(0, bulletAt).join("\n")).trim();
  return {
    bullets: (String(text).match(/^\s*[-*]\s+\S/gm) || []).length,
    leadParagraphs: lead.split(/\n\s*\n/).filter((part) => part.trim()).length
  };
}

test("ingest counts summaries with the published rules and fails before a file is written", () => {
  const source = fs.readFileSync("scripts/ingest.js", "utf8");
  assert.match(source, /\\b\[\\w'-]\+\\b/);
  assert.match(source, /replace\(\/\\s\+\/g, ""\)/);
  assert.match(source, /over the hard max of 250/);
  assert.match(source, /over the hard max of 500/);
  assert.match(source, /Stopped without writing a content file/);
  const checkAt = source.indexOf("assertSummaryLimits(summaryEn, summaryZh)");
  const writeAt = source.indexOf("JSON.stringify(stored, null, 2)");
  assert.ok(checkAt >= 0 && writeAt > checkAt);
});

test("ingest workflow records the summary limits before the commit step", () => {
  const ingest = fs.readFileSync(".github/workflows/ingest.yml", "utf8");
  assert.match(ingest, /250 words/);
  assert.match(ingest, /500 characters/);
  assert.match(ingest, /Validate summaries and write content file/);
  assert.ok(ingest.indexOf("Validate summaries and write content file") < ingest.indexOf("Commit archive"));
});

test("readme documents summary length limits", () => {
  const readme = fs.readFileSync("README.md", "utf8");
  assert.match(readme, /120–180 words/);
  assert.match(readme, /250 words/);
  assert.match(readme, /220–350 characters/);
  assert.match(readme, /500 characters/);
  assert.match(readme, /\\b\[\\w'-]\+\\b/);
  assert.match(readme, /len\(re\.sub\(r'\\s\+',''/);
  assert.match(readme, /one lead paragraph, or a lead paragraph plus at most five bullets/);
  assert.match(readme, /Do not restate the full post/);
  assert.match(readme, /event timeline may reach the hard max/);
  assert.match(readme, /must not approach the length of the original/);
  assert.match(readme, /Over the hard max is an ingest failure/);
  assert.match(readme, /does not write a content file/);
  assert.match(readme, /An empty summary is allowed/);
});

test("archived critical-thinking summaries stay inside the target bands", () => {
  const post = JSON.parse(fs.readFileSync("content/x/2117512471930167377.json", "utf8"));
  const enWords = countEnglishWords(post.summary_en);
  const zhChars = countChineseChars(post.summary_zh);
  assert.ok(enWords >= 120 && enWords <= 180, `summary_en is ${enWords} words`);
  assert.ok(zhChars >= 220 && zhChars <= 350, `summary_zh is ${zhChars} characters`);
  assert.ok(enWords <= 250);
  assert.ok(zhChars <= 500);
  for (const text of [post.summary_en, post.summary_zh]) {
    const shape = summaryShape(text);
    assert.equal(shape.leadParagraphs, 1);
    assert.ok(shape.bullets >= 1 && shape.bullets <= 5, `${shape.bullets} bullets`);
  }
  assert.match(post.summary_en, /cognitive offloading/);
  assert.match(post.summary_en, /deferral/);
  assert.match(post.summary_en, /cognitive surrender/);
  assert.match(post.summary_en, /cognitive debt/);
  assert.match(post.summary_en, /comprehension debt/);
  assert.match(post.summary_en, /5W1H/);
  assert.match(post.summary_en, /hypothesis before asking/);
  assert.match(post.summary_en, /Worth archiving/);
  assert.match(post.summary_zh, /认知卸载/);
  assert.match(post.summary_zh, /推迟/);
  assert.match(post.summary_zh, /认知投降/);
  assert.match(post.summary_zh, /认知债/);
  assert.match(post.summary_zh, /comprehension debt/);
  assert.match(post.summary_zh, /值得存档/);
  assert.match(post.summary_zh, /提问前有没有先形成一个假设/);
  assert.match(post.full_text, /Back in the day, critical thinking/);
  assert.ok(countEnglishWords(post.summary_en) * 4 < countEnglishWords(post.full_text));
});

test("readme documents the contract and the live urls", () => {
  const readme = fs.readFileSync("README.md", "utf8");
  assert.match(readme, /https:\/\/github\.com\/yurkingw\/x-good-reads/);
  assert.match(readme, /https:\/\/yurkingw\.github\.io\/x-good-reads\/x\/2117512471930167377\//);
  assert.match(readme, /https:\/\/yurkingw\.github\.io\/x-good-reads\//);
  assert.match(readme, /ingest\.yml/);
  assert.match(readme, /pathPrefix/);
  assert.match(readme, /GitHub Actions/);
  for (const key of INPUTS) assert.match(readme, new RegExp(`\`${key}\``));
  assert.match(readme, /summary_en/);
  assert.match(readme, /summary_zh/);
  assert.match(readme, /media\/x\/<status_id>\//);
  assert.match(readme, /addPassthroughCopy/);
  assert.match(readme, /"videos"/);
  assert.match(readme, /animated GIFs/);
  assert.match(readme, /noreferrer noopener/);
  assert.match(readme, /25MB/);
  assert.match(readme, /50MB/);
  assert.match(readme, /95MB/);
  assert.match(readme, /Git LFS/);
  assert.match(readme, /hotlink/);
  assert.match(readme, /does not backfill/);
  assert.match(readme, /2117762468177183064/);
  assert.match(readme, /og:image/);
  assert.match(readme, /summary_large_image/);
  assert.match(readme, /media\/site\/og-default\.jpg/);
  assert.match(readme, /videos\[0\]\.poster/);
  assert.match(readme, /gif-poster-/);
});
