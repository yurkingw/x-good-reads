import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const STATUS_ID = /^\d{5,25}$/;
const HANDLE = /^[A-Za-z0-9_]{1,30}$/;

export function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

export function normalizeTimestamp(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  const text = String(value ?? "").trim();
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toISOString();
}

export function formatBeijing(value) {
  const text = normalizeTimestamp(value);
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}（北京时间）`;
}

function normalizeImages(value, fullText) {
  const list = Array.isArray(value) ? value : [];
  const images = [];
  for (const item of list) {
    const href = safeHttpUrl(typeof item === "string" ? item : item?.url);
    if (!href || fullText.includes(href) || images.includes(href)) continue;
    images.push(href);
  }
  return images;
}

export function buildStoredPost(input) {
  const status_id = String(input.status_id ?? "").trim();
  if (!STATUS_ID.test(status_id)) {
    throw new Error("status_id 必须是 5 到 25 位数字，并且要写成字符串");
  }
  const full_text = String(input.full_text ?? "").replace(/\r\n/g, "\n").trim();
  if (!full_text) throw new Error("full_text 不能为空");

  const author_handle = String(input.author_handle ?? "").trim().replace(/^@/, "");
  const author_name = String(input.author_name ?? "").trim();
  let title = String(input.title ?? "").replace(/\s+/g, " ").trim();
  if (!title) {
    const line = full_text.split("\n").map((item) => item.trim()).find(Boolean) || "";
    title = line.replace(/^#{1,6}\s*/, "").slice(0, 80) || `帖子 ${status_id}`;
  }

  let original_url = "";
  if (input.original_url) {
    original_url = safeHttpUrl(input.original_url);
    if (!original_url) throw new Error("original_url 必须是 http 或 https 链接");
  } else if (HANDLE.test(author_handle)) {
    original_url = `https://x.com/${author_handle}/status/${status_id}`;
  } else {
    original_url = `https://x.com/i/status/${status_id}`;
  }

  return {
    status_id,
    title,
    author_name,
    author_handle,
    created_at: normalizeTimestamp(input.created_at),
    original_url,
    summary_zh: String(input.summary_zh ?? "").replace(/\r\n/g, "\n").trim(),
    images: normalizeImages(input.images, full_text),
    full_text
  };
}

function present(stored) {
  return {
    ...stored,
    page_url: `/x/${stored.status_id}/`,
    created_at_display: formatBeijing(stored.created_at),
    summary_plain: stored.summary_zh.replace(/\s+/g, " ").trim().slice(0, 180)
  };
}

function readSource(file) {
  const raw = fs.readFileSync(file, "utf8");
  if (file.endsWith(".json")) {
    const token = raw.match(/"status_id"\s*:\s*([^,\n}]+)/);
    if (token && !token[1].trim().startsWith('"')) {
      throw new Error(
        `${path.basename(file)}: status_id 必须写成 JSON 字符串，例如 "2117512471930167377"。这条 ID 超过 JS 安全整数，写成数字会丢精度。`
      );
    }
    const data = JSON.parse(raw);
    return {
      status_id: data.status_id,
      title: data.title,
      author_name: data.author_name || data.author?.name || "",
      author_handle: data.author_handle || data.author?.username || data.author?.screen_name || "",
      created_at: data.created_at,
      original_url: data.original_url || data.url || "",
      summary_zh: data.summary_zh || "",
      images: data.images || data.media || [],
      full_text: data.full_text || ""
    };
  }

  const parsed = matter(raw);
  const data = parsed.data || {};
  return {
    status_id: data.status_id,
    title: data.title,
    author_name: data.author_name || data.author?.name || "",
    author_handle: data.author_handle || data.author?.username || "",
    created_at: data.created_at,
    original_url: data.original_url || data.url || "",
    summary_zh: data.summary_zh || "",
    images: data.images || [],
    full_text: parsed.content.trim() || data.full_text || ""
  };
}

export function loadPosts(dir = path.join(process.cwd(), "content", "x")) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir)
    .filter((name) => name.endsWith(".json") || name.endsWith(".md"))
    .sort();
  const posts = [];
  const seen = new Map();
  for (const name of files) {
    const file = path.join(dir, name);
    const base = name.replace(/\.(json|md)$/, "");
    const stored = buildStoredPost(readSource(file));
    if (stored.status_id !== base) {
      throw new Error(`${name}: 文件名必须与 status_id 一致（当前解析为 ${stored.status_id}）。长数字请加引号。`);
    }
    if (seen.has(stored.status_id)) {
      throw new Error(`${name}: status_id ${stored.status_id} 与 ${seen.get(stored.status_id)} 重复`);
    }
    seen.set(stored.status_id, name);
    posts.push(present(stored));
  }
  return posts.sort((a, b) => {
    const byTime = String(b.created_at).localeCompare(String(a.created_at));
    if (byTime !== 0) return byTime;
    return String(b.status_id).localeCompare(String(a.status_id));
  });
}
