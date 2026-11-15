import assert from "node:assert/strict";
import test from "node:test";
import { contentLang } from "../src/lib/content-lang.js";
import { residualHan, stripLangElements } from "./lib/ui-scan.js";

test("contentLang marks Chinese blocks and leaves a Latin block in English", () => {
  assert.equal(contentLang(""), "");
  assert.equal(contentLang("Critical thinking when agents do the work"), "en");
  assert.equal(contentLang("Addy Osmani"), "en");
  assert.equal(contentLang("币安刚刚发布了一份初步调查报告"), "zh-CN");
  assert.equal(contentLang("杀破狼 WolfyXBT"), "zh-CN");
  assert.equal(contentLang("English aside 中"), "");
});

test("residual UI scan ignores Chinese blocks tagged zh-CN", () => {
  const html = [
    "<p>Home</p>",
    '<span lang="zh-CN">杀破狼 WolfyXBT</span>',
    '<div class="original-body" lang="zh-CN"><p>币安</p><div><p>报告</p></div></div>',
    '<button aria-label="Back to top" title="Back to top">Top</button>'
  ].join("");
  assert.equal(stripLangElements(html, "zh-CN").includes("币安"), false);
  assert.equal(stripLangElements(html, "zh-CN").includes("杀破狼"), false);
  assert.equal(residualHan(html), "");
  assert.match(residualHan("<p>回顶</p>"), /回顶/);
});

test("residual UI scan ignores a Chinese post title copied into the document title", () => {
  const html = [
    "<title>谁在倒黄 · X Good Reads</title>",
    '<meta property="og:title" content="谁在倒黄">',
    '<meta name="twitter:title" content="谁在倒黄">',
    '<meta name="description" content="English description">',
    "<p>Home</p>"
  ].join("");
  assert.equal(residualHan(html), "");
  assert.match(residualHan(`${html}<p>回顶</p>`), /回顶/);
  assert.match(residualHan('<meta name="description" content="回顶">'), /回顶/);
});
