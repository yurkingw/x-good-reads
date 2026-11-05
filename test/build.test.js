import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { footerNotice } from "../site.config.js";
import { loadPosts } from "../src/lib/posts.js";

const root = process.cwd();
const sampleId = "2117512471930167377";

test("static build matches the archive page contract", { timeout: 60_000 }, () => {
  execFileSync(path.join(root, "node_modules", ".bin", "eleventy"), [], {
    cwd: root,
    stdio: "inherit"
  });

  const index = fs.readFileSync(path.join(root, "_site", "index.html"), "utf8");
  assert.match(index, /href="\/x-good-reads\/css\/site\.css"/);
  assert.match(index, new RegExp(`href="/x-good-reads/x/${sampleId}/"`));
  assert.match(index, /Critical thinking when agents do the work/);
  assert.match(index, /原文版权归原作者/);

  for (const post of loadPosts()) {
    const file = path.join(root, "_site", "x", post.status_id, "index.html");
    assert.equal(fs.existsSync(file), true, file);
    const html = fs.readFileSync(file, "utf8");
    const markers = ['id="summary"', 'id="meta"', 'id="original"', 'id="notice"'];
    const positions = markers.map((marker) => {
      const index = html.indexOf(marker);
      assert.ok(index >= 0, marker);
      return index;
    });
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
    assert.match(html, /AI 摘要/);
    assert.match(html, /本段由 AI 生成/);
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
  const summary = sample.slice(sample.indexOf('id="summary"'), sample.indexOf('id="meta"'));
  const original = sample.slice(sample.indexOf('id="original"'), sample.indexOf('id="notice"'));
  assert.match(summary, /<p>/);
  assert.match(summary, /认知投降/);
  assert.match(sample, /<time datetime="2026-11-03T07:01:29\.000Z">2026-11-03T07:01:29\.000Z<\/time>/);
  assert.match(sample, /2026-11-03 15:01（北京时间）/);
  assert.match(sample, /href="https:\/\/x\.com\/addyosmani\/status\/2117512471930167377"/);
  assert.match(original, /<h3>Offloading, deferral and surrender<\/h3>/);
  assert.match(original, /Back in the day, critical thinking/);
  assert.match(original, /Think independently/);
  assert.doesNotMatch(sample, /<script/i);
  assert.equal(fs.existsSync(path.join(root, "_site", "css", "site.css")), true);
  assert.match(sample, /href="\/x-good-reads\/favicon\.svg"/);
  assert.equal(fs.existsSync(path.join(root, "_site", "favicon.svg")), true);
});
