import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildStoredPost, safeHttpUrl } from "../src/lib/posts.js";

export class IngestError extends Error {
  constructor(message) {
    super(message);
    this.name = "IngestError";
  }
}

const FETCH_TARGETS = [
  (id) => `https://api.fxtwitter.com/status/${id}`,
  (id) => `https://api.vxtwitter.com/Twitter/status/${id}`
];

function textOf(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pushImage(images, value) {
  if (value && typeof value === "object") {
    const type = String(value.type || "");
    if (type && !/photo|image/i.test(type)) return;
  }
  const href = safeHttpUrl(typeof value === "string" ? value : value?.url);
  if (href && !images.includes(href)) images.push(href);
}

function collectImages(images, value) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) pushImage(images, item);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value)) {
      if (Array.isArray(item) || typeof item === "object") collectImages(images, item);
      else pushImage(images, item);
    }
  }
}

export function resolveStatusId(statusId, tweetUrl) {
  const fromInput = String(statusId || "").trim();
  const fromUrl = (String(tweetUrl || "").match(/status(?:es)?\/(\d{5,25})/) || [])[1] || "";
  if (fromInput && fromUrl && fromInput !== fromUrl) {
    throw new IngestError(`status_id（${fromInput}）与 tweet_url 里的 id（${fromUrl}）不一致。`);
  }
  const id = fromInput || fromUrl;
  if (!/^\d{5,25}$/.test(id)) {
    throw new IngestError("请提供 status_id，或提供包含 /status/<数字> 的 tweet_url。");
  }
  return id;
}

export function pickFetchedPost(payload) {
  const tweet = payload?.tweet || payload?.data || payload;
  if (!tweet || typeof tweet !== "object" || Array.isArray(tweet)) return null;
  const article = tweet.article || {};
  const author = tweet.author || tweet.user || {};
  const images = [];
  collectImages(images, tweet.media?.photos || tweet.photos);
  collectImages(images, tweet.media_extended);
  collectImages(images, tweet.entities?.media);
  const full_text = textOf(article.content?.text, article.body, article.text, tweet.full_text, tweet.text);
  if (!full_text) return null;
  return {
    full_text,
    title: textOf(article.title, tweet.title),
    author_name: textOf(author.name, tweet.author_name),
    author_handle: textOf(author.screen_name, author.username, author.handle).replace(/^@/, ""),
    created_at: textOf(tweet.created_at, tweet.createdAt, tweet.date),
    original_url: textOf(tweet.url, tweet.tweetURL),
    images
  };
}

export async function bestEffortFetch(statusId, fetchImpl) {
  const errors = [];
  for (const buildUrl of FETCH_TARGETS) {
    const url = buildUrl(statusId);
    try {
      const response = await fetchImpl(url, {
        headers: {
          accept: "application/json",
          "user-agent": "x-good-reads/1.0 (+https://github.com/yurkingw/x-good-reads)"
        },
        redirect: "follow",
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) {
        errors.push(`${url} 返回 HTTP ${response.status}`);
        continue;
      }
      const post = pickFetchedPost(await response.json());
      if (post) return { post, errors };
      errors.push(`${url} 没有返回可用正文`);
    } catch (error) {
      const reason = error?.name === "TimeoutError" ? "超时" : (error?.message || String(error));
      errors.push(`${url} 失败：${reason}`);
    }
  }
  return { post: null, errors };
}

function failureMessage(errors) {
  const lines = [
    "无法取得原文，已停止，没有写入内容文件。",
    "X 经常拦截匿名抓取。本工作流不打开本机浏览器；抓取失败时，调用方必须传入 full_text。",
    "建议同时传入 summary_zh。",
    "尝试记录："
  ];
  for (const error of errors) lines.push(`- ${error}`);
  return lines.join("\n");
}

export async function runIngest({ env, contentDir, fetchImpl }) {
  const status_id = resolveStatusId(env.STATUS_ID, env.TWEET_URL);
  let fullText = String(env.FULL_TEXT ?? "").trim();
  let fetched = null;
  if (!fullText) {
    const result = await bestEffortFetch(status_id, fetchImpl);
    if (!result.post) throw new IngestError(failureMessage(result.errors));
    fetched = result.post;
    fullText = fetched.full_text;
    console.log("未提供 full_text，已使用尽力抓取的正文。X 文章经常只有链接，抓到的内容请核对。");
  }

  const tweetUrl = safeHttpUrl(env.TWEET_URL);
  let stored;
  try {
    stored = buildStoredPost({
      status_id,
      title: env.TITLE || fetched?.title || "",
      author_name: env.AUTHOR_NAME || fetched?.author_name || "",
      author_handle: env.AUTHOR_HANDLE || fetched?.author_handle || "",
      created_at: env.CREATED_AT || fetched?.created_at || "",
      original_url: tweetUrl || fetched?.original_url || "",
      summary_zh: env.SUMMARY_ZH || "",
      images: fetched?.images || [],
      full_text: fullText
    });
  } catch (error) {
    throw new IngestError(error.message);
  }

  const root = path.resolve(contentDir);
  const file = path.resolve(root, `${stored.status_id}.json`);
  if (!file.startsWith(`${root}${path.sep}`)) {
    throw new IngestError("拒绝写入内容目录之外的路径");
  }
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(stored, null, 2)}\n`);
  return { status_id: stored.status_id, file };
}

function isCli() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isCli()) {
  const contentDir = process.env.CONTENT_DIR || path.join(process.cwd(), "content", "x");
  runIngest({
    env: process.env,
    contentDir,
    fetchImpl: globalThis.fetch
  }).then((result) => {
    console.log(`已写入 ${path.relative(process.cwd(), result.file) || result.file}`);
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `status_id=${result.status_id}\n`);
    }
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
