import assert from "node:assert/strict";
import test from "node:test";
import { renderText } from "../src/lib/render.js";

test("preserves single newlines and linkifies urls", () => {
  const html = renderText("hello\nsee https://example.com/a");
  assert.match(html, /hello<br>\s*see/);
  assert.match(html, /href="https:\/\/example\.com\/a"/);
});

test("renders markdown headings and images", () => {
  const html = renderText("### Offloading\n\n![pic](https://example.com/a.png)");
  assert.match(html, /<h3>Offloading<\/h3>/);
  assert.match(html, /<img[^>]+src="https:\/\/example\.com\/a\.png"/);
});

test("escapes raw html", () => {
  const html = renderText("<script>alert(1)</script>");
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
