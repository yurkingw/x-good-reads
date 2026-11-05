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
