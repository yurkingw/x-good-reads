import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { absoluteSiteUrl, buildStoredPost, formatUtc, loadPosts, pickOgImagePath, pickSummaries } from "../src/lib/posts.js";

const ID = "2117512471930167377";

test("formats an ISO instant as UTC without shifting the clock", () => {
  assert.equal(formatUtc("2026-11-03T07:01:29.000Z"), "2026-11-03 07:01 UTC");
  assert.equal(formatUtc("2026-01-02T00:00:00.000Z"), "2026-01-02 00:00 UTC");
  assert.equal(formatUtc(""), "");
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
  assert.equal(post.created_at, "2026-01-02T00:00:00.000Z");
  assert.equal(post.created_at_display, "2026-01-02 00:00 UTC");
});

test("keeps site-hosted images and videos and rejects X CDN media", () => {
  const id = "123456789012345";
  const photo = `/media/x/${id}/image-1.png`;
  const poster = `/media/x/${id}/poster.jpg`;
  const video = `/media/x/${id}/video.mp4`;
  const post = buildStoredPost({
    status_id: id,
    full_text: "A post with media",
    images: [photo, poster, "javascript:alert(1)"],
    videos: [{ src: video, poster, type: "video/mp4" }]
  });
  assert.deepEqual(post.images, [photo, poster]);
  assert.deepEqual(post.videos, [{ src: video, poster, type: "video/mp4" }]);
  assert.equal(post.display_images, undefined);

  assert.throws(() => buildStoredPost({
    status_id: id,
    full_text: "remote thumb only",
    images: ["https://pbs.twimg.com/amplify_video_thumb/abc/img/x.jpg"]
  }), /X CDN/);
  assert.throws(() => buildStoredPost({
    status_id: id,
    full_text: "remote video",
    videos: [{ src: "https://video.twimg.com/amplify_video/abc.mp4" }]
  }), /X CDN/);
  assert.throws(() => buildStoredPost({
    status_id: id,
    full_text: "wrong folder",
    images: ["/media/x/999999999999999/poster.jpg"]
  }), /status_id/);
});

test("loads a site video from a content file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xgr-video-"));
  const id = "2117762468177183064";
  const poster = `/media/x/${id}/poster.jpg`;
  const video = `/media/x/${id}/video.mp4`;
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify({
    status_id: id,
    full_text: "video post",
    images: [poster],
    videos: [{ src: video, poster, type: "video/mp4" }]
  }));
  const [post] = loadPosts(dir);
  assert.equal(post.videos[0].src, video);
  assert.equal(post.videos[0].poster, poster);
  assert.equal(post.videos[0].type, "video/mp4");
  assert.deepEqual(post.images, [poster]);
  assert.deepEqual(post.display_images, []);
});

test("picks a hosted photo, then a video poster, then the site default", () => {
  const id = "123456789012345";
  const photo = `/media/x/${id}/image-1.png`;
  const poster = `/media/x/${id}/poster.jpg`;
  const video = `/media/x/${id}/video.mp4`;
  assert.equal(pickOgImagePath({
    status_id: id,
    images: [poster, "https://example.com/remote.jpg", photo],
    videos: [{ src: video, poster, type: "video/mp4" }]
  }), photo);
  assert.equal(pickOgImagePath({
    status_id: id,
    images: [],
    videos: [{ src: video, poster, type: "video/mp4" }]
  }), poster);
  assert.equal(pickOgImagePath({
    status_id: id,
    images: ["https://example.com/only-remote.jpg"],
    videos: []
  }), "/media/site/og-default.jpg");
  assert.equal(
    absoluteSiteUrl(`/media/x/${id}/poster.jpg`),
    `https://yurkingw.github.io/x-good-reads/media/x/${id}/poster.jpg`
  );
  assert.equal(
    absoluteSiteUrl("/media/site/og-default.jpg", "https://yurkingw.github.io/x-good-reads/"),
    "https://yurkingw.github.io/x-good-reads/media/site/og-default.jpg"
  );
});

test("uses an animated GIF still frame when that frame is present", () => {
  const id = "323456789012345";
  const gif = `/media/x/${id}/gif-1.gif`;
  const still = `/media/x/${id}/gif-poster-1.jpg`;
  const mediaRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xgr-og-"));
  fs.mkdirSync(path.join(mediaRoot, id), { recursive: true });
  fs.writeFileSync(path.join(mediaRoot, id, "gif-poster-1.jpg"), "still");
  assert.equal(pickOgImagePath({
    status_id: id,
    images: [gif],
    videos: []
  }, { mediaRoot }), still);

  const listed = "423456789012345";
  assert.equal(pickOgImagePath({
    status_id: listed,
    images: [`/media/x/${listed}/gif-poster-1.jpg`],
    videos: [{
      src: `/media/x/${listed}/gif-1.mp4`,
      poster: `/media/x/${listed}/gif-poster-1.jpg`
    }]
  }), `/media/x/${listed}/gif-poster-1.jpg`);
});

test("a video post without a poster field uses poster.jpg beside the video", () => {
  const id = "2117762468177183064";
  assert.equal(pickOgImagePath({
    status_id: id,
    images: [],
    videos: [{ src: `/media/x/${id}/video.mp4`, type: "video/mp4" }]
  }), `/media/x/${id}/poster.jpg`);
});

test("loaded posts expose an absolute in-site og_image", () => {
  const posts = loadPosts();
  const video = posts.find((post) => post.status_id === "2117762468177183064");
  const text = posts.find((post) => post.status_id === "2117512471930167377");
  assert.equal(
    video.og_image,
    "https://yurkingw.github.io/x-good-reads/media/x/2117762468177183064/poster.jpg"
  );
  assert.equal(
    text.og_image,
    "https://yurkingw.github.io/x-good-reads/media/site/og-default.jpg"
  );
  assert.equal(video.og_image.includes("twimg.com"), false);
  assert.equal(text.og_image.includes("twimg.com"), false);
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
