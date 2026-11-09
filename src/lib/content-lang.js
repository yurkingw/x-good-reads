const HAN = /\p{Script=Han}/gu;
const LATIN = /\p{Script=Latin}/gu;

function count(pattern, value) {
  return value.match(pattern)?.length ?? 0;
}

// Language of a content block. Empty means mixed and unlabeled: callers must not
// stamp lang="en" onto that result. UI chrome stays on the document element.
export function contentLang(value) {
  const text = String(value ?? "");
  const han = count(HAN, text);
  const latin = count(LATIN, text);
  if (han === 0 && latin === 0) return "";
  if (han === 0) return "en";
  if (latin === 0) return "zh-CN";
  if (han / (han + latin) >= 0.2) return "zh-CN";
  return "";
}
