import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildStoredPost, formatBeijing, loadPosts, pickSummaries } from "../src/lib/posts.js";

const ID = "2117512471930167377";

test("formats the sample instant in Beijing time", () => {
  assert.equal(formatBeijing("2026-11-03T07:01:29.000Z"), "2026-11-03 15:01 (Beijing time)");
});

test("rejects an unquoted snowflake id and a mismatched filename", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xgr-posts-"));
  fs.writeFileSync(path.join(dir, `${ID}.json`), `{
    "status_id": ${ID},
    "full_text": "hello"
  }`);
  assert.throws(() => loadPosts(dir), /JSON string/);

  fs.writeFileSync(path.join(dir, "123456789012345.json"), JSON.stringify({
    status_id: "123456789012346",
    full_text: "hello from the file"
  }));
  fs.rmSync(path.join(dir, `${ID}.json`));
  assert.throws(() => loadPosts(dir), /filename must match status_id/);
});

test("loads markdown and keeps image urls that are not already in the text", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xgr-md-"));
  const id = "123456789012345";
  fs.writeFileSync(path.join(dir, `${id}.md`), `---
status_id: "${id}"
title: "Hello"
author_name: "Ada"
author_handle: "ada"
created_at: "2026-01-02T00:00:00.000Z"
original_url: "https://x.com/ada/status/${id}"
summary_en: "English summary"
images:
  - "https://example.com/keep.png"
  - "https://example.com/already.png"
  - "javascript:alert(1)"
---

See https://example.com/already.png
`);
  const [post] = loadPosts(dir);
  assert.equal(post.status_id, id);
  assert.equal(post.author_handle, "ada");
  assert.deepEqual(post.images, ["https://example.com/keep.png"]);
  assert.match(post.full_text, /already\.png/);
  assert.equal(post.summary_en, "English summary");
  assert.equal(post.summary_zh, "");
  assert.equal(post.created_at_display, "2026-01-02 08:00 (Beijing time)");
});

test("fills a missing title and original url", () => {
  const post = buildStoredPost({
    status_id: "123456789012345",
    author_handle: "@someone",
    full_text: "First line of the post\nsecond"
  });
  assert.equal(post.title, "First line of the post");
  assert.equal(post.author_handle, "someone");
  assert.equal(post.original_url, "https://x.com/someone/status/123456789012345");
  assert.equal(post.summary_en, "");
  assert.equal(post.summary_zh, "");
  assert.deepEqual(pickSummaries({ summary: "  From summary  ", summary_en: "English", summary_zh: "中文" }), {
    summary_en: "English",
    summary_zh: "中文"
  });
  assert.deepEqual(pickSummaries({ summary: "Fallback English" }), {
    summary_en: "Fallback English",
    summary_zh: ""
  });
  assert.deepEqual(pickSummaries({ summary_zh: "只有中文" }), {
    summary_en: "",
    summary_zh: "只有中文"
  });
});
