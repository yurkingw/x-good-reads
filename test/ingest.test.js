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
      SUMMARY_EN: "This is the summary",
      SUMMARY_ZH: "这是中文摘要",
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
  assert.equal(saved.summary_en, "This is the summary");
  assert.equal(saved.summary_zh, "这是中文摘要");
  assert.equal(saved.summary, undefined);
  assert.deepEqual(saved.images, []);
  assert.deepEqual(saved.videos, []);
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

test("uses the second mirror when the first one fails and hosts media locally", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xgr-mirror-"));
  const mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), "xgr-media-"));
  const seen = [];
  const downloaded = [];
  const result = await runIngest({
    env: { TWEET_URL: `https://x.com/addyosmani/status/${ID}`, SUMMARY_ZH: "只有中文" },
    contentDir: dir,
    mediaDir,
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
    },
    downloadImpl: async (url) => {
      downloaded.push(url);
      if (url.endsWith(".png")) return { bytes: Buffer.from("png"), contentType: "image/png" };
      if (url.endsWith(".mp4")) return { bytes: Buffer.from("mp4"), contentType: "video/mp4" };
      throw new Error(`unexpected ${url}`);
    }
  });
  assert.equal(seen.length, 2);
  assert.deepEqual(downloaded.sort(), ["https://example.com/p.png", "https://example.com/v.mp4"]);
  const saved = JSON.parse(fs.readFileSync(result.file, "utf8"));
  assert.equal(saved.summary_en, "");
  assert.equal(saved.summary_zh, "只有中文");
  assert.equal(saved.full_text, "Fetched body");
  assert.equal(saved.author_handle, "addyosmani");
  assert.equal(saved.created_at, "2026-11-03T07:01:29.000Z");
  assert.deepEqual(saved.images, [`/media/x/${ID}/image-1.png`]);
  assert.deepEqual(saved.videos, [{
    src: `/media/x/${ID}/video.mp4`,
    type: "video/mp4"
  }]);
  assert.equal(fs.readFileSync(path.join(mediaDir, ID, "video.mp4"), "utf8"), "mp4");
  assert.equal(fs.readFileSync(path.join(mediaDir, ID, "image-1.png"), "utf8"), "png");
  assert.doesNotMatch(JSON.stringify(saved), /example\.com|twimg\.com/);
});

test("pickFetchedPost prefers an mp4 over a playlist and keeps the thumbnail separate", () => {
  const post = pickFetchedPost({
    tweet: {
      text: "hello",
      media: {
        photos: [{ type: "photo", url: "https://pbs.twimg.com/media/a.jpg" }],
        videos: [{
          type: "video",
          url: "https://video.twimg.com/amplify_video/playlist.m3u8",
          thumbnail_url: "https://pbs.twimg.com/amplify_video_thumb/a.jpg",
          formats: [
            { url: "https://video.twimg.com/amplify_video/low.mp4", bitrate: 256000 },
            { url: "https://video.twimg.com/amplify_video/high.mp4", bitrate: 832000 }
          ]
        }]
      },
      media_extended: [
        { type: "gif", url: "https://video.twimg.com/tweet_video/g.mp4", thumbnail_url: "https://pbs.twimg.com/tweet_video_thumb/g.jpg" }
      ]
    }
  });
  assert.deepEqual(post.media, [
    { kind: "image", url: "https://pbs.twimg.com/media/a.jpg", posterUrl: "" },
    {
      kind: "video",
      url: "https://video.twimg.com/amplify_video/high.mp4",
      posterUrl: "https://pbs.twimg.com/amplify_video_thumb/a.jpg"
    },
    {
      kind: "gif",
      url: "https://video.twimg.com/tweet_video/g.mp4",
      posterUrl: "https://pbs.twimg.com/tweet_video_thumb/g.jpg"
    }
  ]);
});

test("media download failure does not write a remote thumbnail as success", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xgr-media-fail-"));
  const mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), "xgr-media-fail-files-"));
  await assert.rejects(() => runIngest({
    env: { STATUS_ID: ID },
    contentDir: dir,
    mediaDir,
    fetchImpl: async () => jsonResponse({
      tweet: {
        text: "Fetched body",
        media: {
          videos: [{
            type: "video",
            url: "https://video.twimg.com/amplify_video/x.mp4",
            thumbnail_url: "https://pbs.twimg.com/amplify_video_thumb/x.jpg"
          }]
        }
      }
    }),
    downloadImpl: async () => {
      throw new Error("cdn blocked");
    }
  }), /without writing a content file/);
  assert.equal(fs.readdirSync(dir).length, 0);
  assert.equal(fs.existsSync(path.join(mediaDir, ID)), false);
});

test("rejects an HTML payload or a file over 95MB instead of archiving it", async () => {
  const cases = [
    {
      name: "html",
      payload: { bytes: Buffer.from("<html>login</html>"), contentType: "text/html" },
      pattern: /content-type|html/i
    },
    {
      name: "oversize",
      payload: { bytes: Buffer.alloc(95 * 1024 * 1024 + 1), contentType: "video/mp4" },
      pattern: /95MB/
    }
  ];
  for (const item of cases) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `xgr-${item.name}-`));
    const mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), `xgr-${item.name}-media-`));
    await assert.rejects(() => runIngest({
      env: { STATUS_ID: ID },
      contentDir: dir,
      mediaDir,
      fetchImpl: async () => jsonResponse({
        tweet: {
          text: "Fetched body",
          media: {
            videos: [{
              type: "video",
              url: "https://video.twimg.com/amplify_video/x.mp4",
              thumbnail_url: "https://pbs.twimg.com/amplify_video_thumb/x.jpg"
            }]
          }
        }
      }),
      downloadImpl: async () => item.payload
    }), item.pattern);
    assert.equal(fs.readdirSync(dir).length, 0, item.name);
  }
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

function countEnglishWords(text) {
  return (String(text).match(/\b[\w'-]+\b/g) || []).length;
}

function countChineseChars(text) {
  return String(text).replace(/\s+/g, "").length;
}

function words(count, token = "word") {
  return Array.from({ length: count }, () => token).join(" ");
}

test("rejects an over-limit English summary and writes nothing", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xgr-en-limit-"));
  let called = false;
  const summary = words(251);
  assert.equal(countEnglishWords(summary), 251);
  await assert.rejects(() => runIngest({
    env: {
      STATUS_ID: ID,
      FULL_TEXT: "Body that must not be archived",
      SUMMARY_EN: summary
    },
    contentDir: dir,
    fetchImpl: async () => {
      called = true;
      throw new Error("should not fetch");
    }
  }), /summary_en is 251 English words, over the hard max of 250[\s\S]*without writing a content file/);
  assert.equal(called, false);
  assert.equal(fs.readdirSync(dir).length, 0);
});

test("rejects an over-limit Chinese summary and writes nothing", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xgr-zh-limit-"));
  const summary = `${"字 ".repeat(501)}`;
  assert.equal(countChineseChars(summary), 501);
  await assert.rejects(() => runIngest({
    env: {
      STATUS_ID: ID,
      FULL_TEXT: "Body that must not be archived",
      SUMMARY_ZH: summary
    },
    contentDir: dir,
    fetchImpl: async () => {
      throw new Error("should not fetch");
    }
  }), /summary_zh is 501 characters after removing whitespace, over the hard max of 500[\s\S]*without writing a content file/);
  assert.equal(fs.readdirSync(dir).length, 0);
});

test("rejects when both summaries are over the limit and writes nothing", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xgr-both-limit-"));
  let downloaded = false;
  await assert.rejects(() => runIngest({
    env: {
      STATUS_ID: ID,
      SUMMARY: words(251),
      SUMMARY_ZH: "字".repeat(501)
    },
    contentDir: dir,
    fetchImpl: async () => jsonResponse({ tweet: { text: "Fetched body" } }),
    downloadImpl: async () => {
      downloaded = true;
      return { bytes: Buffer.from("png"), contentType: "image/png" };
    }
  }), /summary_en is 251 English words, over the hard max of 250[\s\S]*summary_zh is 501 characters after removing whitespace, over the hard max of 500[\s\S]*without writing a content file/);
  assert.equal(downloaded, false);
  assert.equal(fs.readdirSync(dir).length, 0);
});

test("accepts empty summaries and summaries inside the target band", async () => {
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "xgr-empty-summary-"));
  const empty = await runIngest({
    env: {
      STATUS_ID: ID,
      FULL_TEXT: "Body",
      SUMMARY_EN: " \n\t ",
      SUMMARY_ZH: " \n "
    },
    contentDir: emptyDir,
    fetchImpl: async () => {
      throw new Error("should not fetch");
    }
  });
  const emptySaved = JSON.parse(fs.readFileSync(empty.file, "utf8"));
  assert.equal(emptySaved.summary_en, "");
  assert.equal(emptySaved.summary_zh, "");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xgr-ok-summary-"));
  const summaryEn = words(150, "self-check");
  const summaryZh = "摘".repeat(280);
  assert.equal(countEnglishWords(summaryEn), 150);
  assert.equal(countChineseChars(summaryZh), 280);
  const result = await runIngest({
    env: {
      STATUS_ID: ID,
      FULL_TEXT: "Body",
      SUMMARY_EN: summaryEn,
      SUMMARY_ZH: summaryZh
    },
    contentDir: dir,
    fetchImpl: async () => {
      throw new Error("should not fetch");
    }
  });
  const saved = JSON.parse(fs.readFileSync(result.file, "utf8"));
  assert.equal(saved.summary_en, summaryEn);
  assert.equal(saved.summary_zh, summaryZh);
});

test("accepts summaries at the hard max, including hyphenated words and spaced Chinese", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xgr-max-summary-"));
  const summaryEn = words(250, "can't");
  const summaryZh = "字 ".repeat(500);
  assert.equal(countEnglishWords(summaryEn), 250);
  assert.equal(countChineseChars(summaryZh), 500);
  assert.ok(summaryZh.length > 500);
  const result = await runIngest({
    env: {
      STATUS_ID: ID,
      FULL_TEXT: "Body",
      SUMMARY_EN: summaryEn,
      SUMMARY_ZH: summaryZh
    },
    contentDir: dir,
    fetchImpl: async () => {
      throw new Error("should not fetch");
    }
  });
  const saved = JSON.parse(fs.readFileSync(result.file, "utf8"));
  assert.equal(countEnglishWords(saved.summary_en), 250);
  assert.equal(countChineseChars(saved.summary_zh), 500);
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
      SUMMARY_EN: "CLI summary",
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
