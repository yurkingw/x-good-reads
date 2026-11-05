import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pickFetchedPost, resolveStatusId, runIngest } from "../scripts/ingest.js";

const ID = "2117512471930167377";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    }
  };
}

test("resolveStatusId accepts either input and rejects a mismatch", () => {
  assert.equal(resolveStatusId(ID, ""), ID);
  assert.equal(resolveStatusId("", `https://x.com/addyosmani/status/${ID}`), ID);
  assert.throws(() => resolveStatusId("123456789012345", `https://x.com/a/status/${ID}`), /does not match/);
  assert.throws(() => resolveStatusId("", "https://x.com/addyosmani"), /status_id/);
});

test("does not fetch when full_text is provided", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xgr-ingest-"));
  let called = false;
  const result = await runIngest({
    env: {
      STATUS_ID: ID,
      FULL_TEXT: "Hello from the caller\nhttps://example.com",
      SUMMARY: "This is the summary",
      TITLE: "A title",
      AUTHOR_NAME: "Addy Osmani",
      AUTHOR_HANDLE: "addyosmani",
      CREATED_AT: "2026-11-03T07:01:29.000Z",
      TWEET_URL: `https://x.com/addyosmani/status/${ID}`
    },
    contentDir: dir,
    fetchImpl: async () => {
      called = true;
      throw new Error("should not fetch");
    }
  });
  assert.equal(called, false);
  const saved = JSON.parse(fs.readFileSync(result.file, "utf8"));
  assert.equal(typeof saved.status_id, "string");
  assert.equal(saved.status_id, ID);
  assert.equal(saved.summary, "This is the summary");
  assert.equal(saved.summary_zh, undefined);
  assert.match(saved.full_text, /Hello from the caller/);
});

test("fetch failure writes nothing", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xgr-fetch-"));
  await assert.rejects(() => runIngest({
    env: { STATUS_ID: ID },
    contentDir: dir,
    fetchImpl: async () => {
      throw new Error("blocked");
    }
  }), /without writing a content file/);
  assert.equal(fs.readdirSync(dir).length, 0);
});

test("uses the second mirror when the first one fails", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xgr-mirror-"));
  const seen = [];
  const result = await runIngest({
    env: { TWEET_URL: `https://x.com/addyosmani/status/${ID}`, SUMMARY: "English summary" },
    contentDir: dir,
    fetchImpl: async (url) => {
      seen.push(url);
      if (url.includes("fxtwitter")) return jsonResponse({ tweet: null }, 404);
      return jsonResponse({
        tweet: {
          text: "Fetched body",
          created_at: "Tue Nov 03 07:01:29 +0000 2026",
          author: { name: "Addy Osmani", screen_name: "addyosmani" },
          media: {
            photos: [{ url: "https://example.com/p.png", type: "photo" }],
            videos: [{ url: "https://example.com/v.mp4", type: "video" }]
          }
        }
      });
    }
  });
  assert.equal(seen.length, 2);
  const saved = JSON.parse(fs.readFileSync(result.file, "utf8"));
  assert.equal(saved.summary, "English summary");
  assert.equal(saved.summary_zh, undefined);
  assert.equal(saved.full_text, "Fetched body");
  assert.equal(saved.author_handle, "addyosmani");
  assert.equal(saved.created_at, "2026-11-03T07:01:29.000Z");
  assert.deepEqual(saved.images, ["https://example.com/p.png"]);
});

test("pickFetchedPost prefers article text", () => {
  const post = pickFetchedPost({
    tweet: {
      text: "https://t.co/short",
      article: { title: "Essay", content: { text: "The full essay" } },
      author: { name: "A", username: "a" }
    }
  });
  assert.equal(post.full_text, "The full essay");
  assert.equal(post.title, "Essay");
});

test("cli writes a file and a status id output", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xgr-cli-"));
  const output = path.join(dir, "github-output.txt");
  const result = spawnSync(process.execPath, ["scripts/ingest.js"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      CONTENT_DIR: dir,
      GITHUB_OUTPUT: output,
      STATUS_ID: "123456789012345",
      FULL_TEXT: "CLI body",
      SUMMARY: "CLI summary",
      AUTHOR_HANDLE: "ada"
    }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(output, "utf8"), /status_id=123456789012345/);
  assert.equal(result.status, 0);

  const missing = spawnSync(process.execPath, ["scripts/ingest.js"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, CONTENT_DIR: dir, STATUS_ID: "", TWEET_URL: "", FULL_TEXT: "" }
  });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /status_id/);
});
