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

const MAX_MEDIA_BYTES = 95 * 1024 * 1024;
const NOTE_MEDIA_BYTES = 50 * 1024 * 1024;
const MEDIA_TYPES = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "video/mp4": ".mp4"
};

function kindOf(item) {
  const type = String(item?.type || "").toLowerCase();
  if (/animated_gif|\bgif\b/.test(type)) return "gif";
  if (type.includes("video")) return "video";
  if (/photo|image/.test(type)) return "image";
  return "";
}

function directFileUrl(item) {
  for (const candidate of [item?.media_url_https, item?.mediaUrl, item?.url]) {
    const href = safeHttpUrl(candidate);
    if (!href) continue;
    if (new URL(href).hostname === "t.co") continue;
    return href;
  }
  return "";
}

function bestPlayableUrl(item) {
  const formats = []
    .concat(item?.formats || [])
    .concat(item?.variants || [])
    .concat(item?.video_info?.variants || []);
  const mp4s = [];
  for (const format of formats) {
    const href = safeHttpUrl(format?.url || format?.src || "");
    if (!href || !/\.mp4(?:$|\?)/i.test(href)) continue;
    mp4s.push({ href, bitrate: Number(format.bitrate || format.bit_rate || 0) });
  }
  mp4s.sort((a, b) => b.bitrate - a.bitrate);
  if (mp4s[0]) return mp4s[0].href;
  const direct = directFileUrl(item);
  if (!direct || /\.m3u8(?:$|\?)/i.test(direct)) return "";
  return direct;
}

function posterUrlOf(item) {
  return safeHttpUrl(item?.thumbnail_url || item?.preview_image_url || item?.poster || "") || "";
}

export function collectMedia(tweet) {
  const items = [];
  const seen = new Set();
  const push = (item) => {
    if (!item || typeof item !== "object") return;
    const kind = kindOf(item);
    if (!kind) return;
    const url = kind === "image" ? directFileUrl(item) : bestPlayableUrl(item);
    const posterUrl = kind === "image" ? "" : posterUrlOf(item);
    if (!url && !posterUrl) return;
    const key = `${kind}:${url}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ kind, url, posterUrl });
  };
  const media = tweet?.media || {};
  const groups = []
    .concat(media.photos || tweet?.photos || [])
    .concat(media.videos || [])
    .concat(media.gifs || [])
    .concat(tweet?.media_extended || [])
    .concat(tweet?.entities?.media || [])
    .concat(media.all || []);
  for (const item of groups) push(item);
  return items;
}

export function resolveStatusId(statusId, tweetUrl) {
  const fromInput = String(statusId || "").trim();
  const fromUrl = (String(tweetUrl || "").match(/status(?:es)?\/(\d{5,25})/) || [])[1] || "";
  if (fromInput && fromUrl && fromInput !== fromUrl) {
    throw new IngestError(`status_id (${fromInput}) does not match the id in tweet_url (${fromUrl}).`);
  }
  const id = fromInput || fromUrl;
  if (!/^\d{5,25}$/.test(id)) {
    throw new IngestError("Provide a status_id, or a tweet_url that contains /status/<digits>.");
  }
  return id;
}

export function pickFetchedPost(payload) {
  const tweet = payload?.tweet || payload?.data || payload;
  if (!tweet || typeof tweet !== "object" || Array.isArray(tweet)) return null;
  const article = tweet.article || {};
  const author = tweet.author || tweet.user || {};
  const media = collectMedia(tweet);
  const full_text = textOf(article.content?.text, article.body, article.text, tweet.full_text, tweet.text);
  if (!full_text) return null;
  return {
    full_text,
    title: textOf(article.title, tweet.title),
    author_name: textOf(author.name, tweet.author_name),
    author_handle: textOf(author.screen_name, author.username, author.handle).replace(/^@/, ""),
    created_at: textOf(tweet.created_at, tweet.createdAt, tweet.date),
    original_url: textOf(tweet.url, tweet.tweetURL),
    images: media.filter((item) => item.kind === "image" && item.url).map((item) => item.url),
    media
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
        errors.push(`${url} returned HTTP ${response.status}`);
        continue;
      }
      const post = pickFetchedPost(await response.json());
      if (post) return { post, errors };
      errors.push(`${url} did not return usable text`);
    } catch (error) {
      const reason = error?.name === "TimeoutError" ? "timed out" : (error?.message || String(error));
      errors.push(`${url} failed: ${reason}`);
    }
  }
  return { post: null, errors };
}

function extensionFor(url, contentType, fallback) {
  const type = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (MEDIA_TYPES[type]) return MEDIA_TYPES[type];
  try {
    let ext = path.extname(new URL(url).pathname).toLowerCase();
    if (ext === ".jpeg") ext = ".jpg";
    if (Object.values(MEDIA_TYPES).includes(ext)) return ext;
  } catch {
    // The URL is only a hint for the file extension.
  }
  return fallback;
}

function assertPayload(bytes, contentType, url) {
  const type = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (!bytes || !bytes.length) {
    throw new IngestError(`Refusing ${url}: the download was empty. Stopped without writing a content file.`);
  }
  if (type === "text/html" || type === "application/xhtml+xml" || type === "application/json" || type.startsWith("text/")) {
    throw new IngestError(`Refusing ${url}: content-type ${type || "unknown"} is not an image, GIF, or video. Stopped without writing a content file.`);
  }
  if (bytes.length > MAX_MEDIA_BYTES) {
    throw new IngestError(`Refusing ${url}: ${bytes.length} bytes is over 95MB. Stopped without writing a content file.`);
  }
  if (bytes.length > NOTE_MEDIA_BYTES) {
    console.warn(`Media file is ${bytes.length} bytes (over 50MB). Call this out in the pull request.`);
  }
}

function mediaFile(mediaDir, statusId, name) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(name)) {
    throw new IngestError(`Refusing media filename ${name}`);
  }
  const root = path.resolve(mediaDir);
  const dir = path.resolve(root, statusId);
  const file = path.resolve(dir, name);
  if (!dir.startsWith(`${root}${path.sep}`) || !file.startsWith(`${dir}${path.sep}`)) {
    throw new IngestError("Refusing to write a path outside the media directory");
  }
  return { dir, file };
}

function publicMediaPath(statusId, name) {
  return `/media/x/${statusId}/${name}`;
}

async function downloadToFile({ url, stem, fallbackExt, statusId, mediaDir, downloadImpl, written }) {
  let downloaded;
  try {
    downloaded = await downloadImpl(url);
  } catch (error) {
    const reason = error?.message || String(error);
    throw new IngestError(`Could not download ${url}. Stopped without writing a content file. A remote thumbnail is not a successful archive. ${reason}`);
  }
  const bytes = Buffer.isBuffer(downloaded?.bytes) ? downloaded.bytes : Buffer.from(downloaded?.bytes || []);
  const contentType = String(downloaded?.contentType || "");
  assertPayload(bytes, contentType, url);
  const ext = extensionFor(url, contentType, fallbackExt);
  const name = `${stem}${ext}`;
  const { dir, file } = mediaFile(mediaDir, statusId, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, bytes);
  written.push(file);
  return { path: publicMediaPath(statusId, name), ext, contentType: contentType.split(";")[0].trim().toLowerCase() };
}

function cleanupMedia(mediaDir, statusId, written) {
  for (const file of written) fs.rmSync(file, { force: true });
  const dir = path.resolve(mediaDir, statusId);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

export async function hostFetchedMedia({ statusId, items, mediaDir, downloadImpl }) {
  const written = [];
  const images = [];
  const videos = [];
  try {
    const moving = items.filter((item) => item.kind === "video" || item.kind === "gif");
    const photos = items.filter((item) => item.kind === "image" && item.url);
    const videoCount = moving.filter((item) => item.kind === "video").length;
    let videoNumber = 0;
    let gifNumber = 0;
    let imageNumber = 0;
    for (const item of moving) {
      if (!item.url) {
        throw new IngestError("A video had no downloadable file. Stopped without writing a content file. A remote thumbnail is not a successful archive.");
      }
      const isGif = item.kind === "gif";
      const number = isGif ? ++gifNumber : ++videoNumber;
      const stem = isGif
        ? `gif-${number}`
        : (videoCount === 1 ? "video" : `video-${number}`);
      const saved = await downloadToFile({
        url: item.url,
        stem,
        fallbackExt: ".mp4",
        statusId,
        mediaDir,
        downloadImpl,
        written
      });
      if (saved.ext === ".gif") {
        images.push(saved.path);
        continue;
      }
      const video = { src: saved.path, type: saved.contentType.startsWith("video/") ? saved.contentType : "video/mp4" };
      if (item.posterUrl) {
        const posterStem = isGif
          ? `gif-poster-${number}`
          : (videoCount === 1 ? "poster" : `poster-${number}`);
        const poster = await downloadToFile({
          url: item.posterUrl,
          stem: posterStem,
          fallbackExt: ".jpg",
          statusId,
          mediaDir,
          downloadImpl,
          written
        });
        video.poster = poster.path;
        if (!images.includes(poster.path)) images.push(poster.path);
      }
      videos.push(video);
    }
    for (const item of photos) {
      imageNumber += 1;
      const saved = await downloadToFile({
        url: item.url,
        stem: `image-${imageNumber}`,
        fallbackExt: ".jpg",
        statusId,
        mediaDir,
        downloadImpl,
        written
      });
      if (!images.includes(saved.path)) images.push(saved.path);
    }
    return { images, videos };
  } catch (error) {
    cleanupMedia(mediaDir, statusId, written);
    if (error instanceof IngestError) throw error;
    throw new IngestError(`Could not host media. Stopped without writing a content file. A remote thumbnail is not a successful archive. ${error.message}`);
  }
}

export async function downloadMedia(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,video/mp4,*/*",
      "user-agent": "x-good-reads/1.0 (+https://github.com/yurkingw/x-good-reads)"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(120000)
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const contentType = response.headers?.get?.("content-type") || "";
  const length = Number(response.headers?.get?.("content-length") || 0);
  if (length > MAX_MEDIA_BYTES) {
    throw new Error(`${url} is ${length} bytes, over 95MB`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, contentType };
}

function failureMessage(errors) {
  const lines = [
    "Could not fetch the original text. Stopped without writing a content file.",
    "X often blocks anonymous fetches. This workflow does not open a local browser. When the fetch fails, the caller must pass full_text.",
    "Pass summary_en and summary_zh when you can.",
    "Attempts:"
  ];
  for (const error of errors) lines.push(`- ${error}`);
  return lines.join("\n");
}

export async function runIngest({ env, contentDir, fetchImpl, mediaDir, downloadImpl }) {
  const status_id = resolveStatusId(env.STATUS_ID, env.TWEET_URL);
  let fullText = String(env.FULL_TEXT ?? "").trim();
  let fetched = null;
  if (!fullText) {
    const result = await bestEffortFetch(status_id, fetchImpl);
    if (!result.post) throw new IngestError(failureMessage(result.errors));
    fetched = result.post;
    fullText = fetched.full_text;
    console.log("No full_text was provided. Using best-effort fetched text. X articles often return only a link; check what was captured.");
  }

  const tweetUrl = safeHttpUrl(env.TWEET_URL);
  let hosted = { images: [], videos: [] };
  if (fetched?.media?.length) {
    const mediaRoot = mediaDir ? path.resolve(mediaDir) : path.join(process.cwd(), "media", "x");
    hosted = await hostFetchedMedia({
      statusId: status_id,
      items: fetched.media,
      mediaDir: mediaRoot,
      downloadImpl: downloadImpl || ((url) => downloadMedia(url, fetchImpl))
    });
  }
  let stored;
  try {
    stored = buildStoredPost({
      status_id,
      title: env.TITLE || fetched?.title || "",
      author_name: env.AUTHOR_NAME || fetched?.author_name || "",
      author_handle: env.AUTHOR_HANDLE || fetched?.author_handle || "",
      created_at: env.CREATED_AT || fetched?.created_at || "",
      original_url: tweetUrl || fetched?.original_url || "",
      summary_en: env.SUMMARY_EN || env.SUMMARY || "",
      summary_zh: env.SUMMARY_ZH || "",
      images: hosted.images,
      videos: hosted.videos,
      full_text: fullText
    });
  } catch (error) {
    throw new IngestError(error.message);
  }

  const root = path.resolve(contentDir);
  const file = path.resolve(root, `${stored.status_id}.json`);
  if (!file.startsWith(`${root}${path.sep}`)) {
    throw new IngestError("Refusing to write a path outside the content directory");
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
  const mediaDir = process.env.MEDIA_DIR || path.join(process.cwd(), "media", "x");
  runIngest({
    env: process.env,
    contentDir,
    mediaDir,
    fetchImpl: globalThis.fetch
  }).then((result) => {
    console.log(`Wrote ${path.relative(process.cwd(), result.file) || result.file}`);
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `status_id=${result.status_id}\n`);
    }
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
