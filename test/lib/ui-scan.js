// Drops elements whose start tag sets lang, so a residual-UI scan can see chrome only.
export function stripLangElements(html, lang) {
  const attr = `lang="${lang}"`;
  let cursor = 0;
  let out = "";
  while (cursor < html.length) {
    const lt = html.indexOf("<", cursor);
    if (lt < 0) {
      out += html.slice(cursor);
      break;
    }
    out += html.slice(cursor, lt);
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt);
      const stop = end < 0 ? html.length : end + 3;
      out += html.slice(lt, stop);
      cursor = stop;
      continue;
    }
    const gt = html.indexOf(">", lt);
    if (gt < 0) {
      out += html.slice(lt);
      break;
    }
    const open = html.slice(lt, gt + 1);
    const nameMatch = /^<([A-Za-z][\w:-]*)/.exec(open);
    if (!nameMatch || open.startsWith("</") || open.endsWith("/>") || !open.includes(attr)) {
      out += open;
      cursor = gt + 1;
      continue;
    }
    const name = nameMatch[1].toLowerCase();
    let depth = 1;
    let i = gt + 1;
    while (depth > 0 && i < html.length) {
      const next = html.indexOf("<", i);
      if (next < 0) {
        i = html.length;
        break;
      }
      if (html.startsWith("<!--", next)) {
        const end = html.indexOf("-->", next);
        i = end < 0 ? html.length : end + 3;
        continue;
      }
      const close = html.indexOf(">", next);
      if (close < 0) {
        i = html.length;
        break;
      }
      const token = html.slice(next, close + 1);
      const parsed = /^<\/?([A-Za-z][\w:-]*)/.exec(token);
      if (parsed && parsed[1].toLowerCase() === name) {
        if (token.startsWith("</")) depth -= 1;
        else if (!token.endsWith("/>")) depth += 1;
      }
      i = close + 1;
    }
    cursor = i;
  }
  return out;
}

const HAN = /[\u4e00-\u9fff]/;

export function residualHan(html) {
  const stripped = stripLangElements(html, "zh-CN");
  const hit = HAN.exec(stripped);
  if (!hit) return "";
  const from = Math.max(0, hit.index - 48);
  return stripped.slice(from, hit.index + 48).replace(/\s+/g, " ");
}
