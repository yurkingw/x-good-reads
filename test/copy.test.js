import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const banned = [
  ["We", "Chat"].join(""),
  String.fromCharCode(0x5fae, 0x4fe1),
  ["Bei", "jing"].join(""),
  ["Asia", "Shanghai"].join("/")
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "_site" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|njk|md|css|json|yml|svg|html)$/.test(entry.name)) out.push(full);
  }
  return out;
}

test("repo copy does not name a chat app or a city clock", () => {
  for (const file of walk(process.cwd())) {
    const text = fs.readFileSync(file, "utf8");
    for (const word of banned) {
      assert.equal(text.includes(word), false, `${path.relative(process.cwd(), file)} includes banned copy`);
    }
  }
});

test("public lede has no parenthetical", () => {
  const config = fs.readFileSync("site.config.js", "utf8");
  const index = fs.readFileSync("src/index.njk", "utf8");
  const lede = "One X post, one page. Share the link anywhere.";
  assert.equal(config.includes(lede), true);
  assert.equal(index.includes(lede), true);
  assert.equal(config.includes(`${lede} (`), false);
  assert.equal(index.includes(`${lede} (`), false);
});
