import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync("src/css/site.css", "utf8");
const base = fs.readFileSync("src/_includes/base.njk", "utf8");
const post = fs.readFileSync("src/post.njk", "utf8");
const index = fs.readFileSync("src/index.njk", "utf8");

function customProps(block) {
  const props = {};
  for (const match of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    props[match[1]] = match[2].trim();
  }
  return props;
}

function ruleBody(source, selector) {
  const wanted = selector.trim().replace(/,$/, "").replace(/\s+/g, " ");
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(",").map((part) => part.trim().replace(/\s+/g, " "));
    if (selectors.includes(wanted)) return match[2];
  }
  assert.fail(`missing selector ${selector}`);
}

test("spacing uses only the eight-step scale", () => {
  for (const [token, value] of [
    ["--s-1", "4px"],
    ["--s-2", "8px"],
    ["--s-3", "12px"],
    ["--s-4", "16px"],
    ["--s-5", "24px"],
    ["--s-6", "32px"],
    ["--s-7", "48px"],
    ["--s-8", "64px"]
  ]) {
    assert.match(css, new RegExp(`${token}:\\s*${value}`));
  }
  assert.match(css, /--pad-x:\s*var\(--s-4\)/);
  assert.match(css, /max-width:\s*380px[\s\S]*?--pad-x:\s*var\(--s-3\)/);

  const rem = [...css.matchAll(/(\d*\.\d+|\d+)rem/g)].map((match) => match[1]);
  assert.deepEqual(rem, ["36", "40"]);

  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const decls = clean.match(/(?:margin|padding|gap)(?:-[a-z]+)?\s*:[^;]+;/g) || [];
  assert.ok(decls.length > 8);
  for (const decl of decls) {
    assert.doesNotMatch(decl, /rem/, decl);
    const px = decl.match(/(\d+)px/g) || [];
    for (const token of px) assert.equal(token, "6px", decl);
  }
});

test("type scale is six roles with a real summary/original split", () => {
  assert.match(css, /--t1-size:\s*28px/);
  assert.match(css, /--t2-size:\s*24px/);
  assert.match(css, /--t3-size:\s*17px/);
  assert.match(css, /--t4-size:\s*15px/);
  assert.match(css, /--t5-size:\s*14px/);
  assert.match(css, /--t6-size:\s*12px/);
  assert.match(css, /--t1-weight:\s*600/);
  assert.match(css, /--t2-weight:\s*560/);
  assert.match(css, /--t3-weight:\s*400/);
  assert.match(css, /--t4-weight:\s*450/);
  assert.match(css, /--t5-weight:\s*500/);
  assert.match(css, /--t6-weight:\s*500/);
  assert.match(css, /--t1-lh:\s*1\.2\b/);
  assert.match(css, /--t2-lh:\s*1\.25\b/);
  assert.match(css, /--t3-lh:\s*1\.7\b/);
  assert.match(css, /--t4-lh:\s*1\.55\b/);
  assert.match(css, /--t1-track:\s*-0\.025em/);
  assert.match(css, /--t2-track:\s*-0\.02em/);
  assert.match(css, /--t6-track:\s*0\.02em/);
  assert.match(css, /--t6-track-label:\s*0\.04em/);
  assert.match(css, /min-width:\s*640px[\s\S]*?--t1-size:\s*32px/);
  assert.match(css, /min-width:\s*640px[\s\S]*?--t3-size:\s*18px/);
  assert.match(css, /html\s*\{[^}]*font-size:\s*16px/);
  assert.doesNotMatch(css, /font-size:\s*17px/);
  assert.match(css, /font-optical-sizing:\s*auto/);
  assert.match(css, /font-feature-settings:\s*"ss01"\s*on,\s*"cv11"\s*on/);
  assert.match(ruleBody(css, ".is-post h1"), /font-size:\s*var\(--t1-size\)/);
  assert.match(ruleBody(css, ".is-home h1"), /font-size:\s*var\(--t2-size\)/);
  assert.match(ruleBody(css, ".original-body"), /font-size:\s*var\(--t3-size\)/);
  assert.match(ruleBody(css, ".original-body"), /font-weight:\s*var\(--t3-weight\)/);
  assert.match(ruleBody(css, ".original-body"), /line-height:\s*var\(--t3-lh\)/);
  assert.match(ruleBody(css, ".summary-body"), /font-size:\s*var\(--t4-size\)/);
  assert.match(ruleBody(css, ".summary-body"), /font-weight:\s*var\(--t4-weight\)/);
  assert.match(ruleBody(css, ".summary-body"), /line-height:\s*var\(--t4-lh\)/);
  assert.match(ruleBody(css, ".summary-body.is-zh"), /line-height:\s*1\.7/);
  assert.match(ruleBody(css, ".index-title"), /font-size:\s*var\(--t5-size\)/);
  assert.match(ruleBody(css, ".index-title"), /font-weight:\s*500/);
  assert.match(ruleBody(css, ".seg"), /font-size:\s*var\(--t6-size\)/);
  assert.match(ruleBody(css, "h2"), /font-size:\s*var\(--t6-size\)/);
  assert.match(ruleBody(css, "h2"), /letter-spacing:\s*var\(--t6-track-label\)/);
});

test("day and night tokens move together", () => {
  const day = {
    "--bg": "#ffffff",
    "--surface": "#fafafa",
    "--surface-soft": "#f7f7f7",
    "--ink": "#0a0a0a",
    "--ink-soft": "#2e2e2e",
    "--muted": "#6b6b6b",
    "--muted-soft": "#8a8a8a",
    "--line": "#ebebeb",
    "--line-strong": "#dcdcdc",
    "--accent": "#0a0a0a",
    "--hover-tint": "rgba(0,0,0,0.03)"
  };
  const night = {
    "--bg": "#0d0d0d",
    "--surface": "#141414",
    "--surface-soft": "#1a1a1a",
    "--ink": "#f5f5f5",
    "--ink-soft": "#d6d6d6",
    "--muted": "#9a9a9a",
    "--muted-soft": "#7a7a7a",
    "--line": "#2a2a2a",
    "--line-strong": "#3a3a3a",
    "--accent": "#f5f5f5",
    "--hover-tint": "rgba(255,255,255,0.04)"
  };
  const root = customProps(ruleBody(css, ":root,"));
  for (const [key, value] of Object.entries(day)) assert.equal(root[key], value, key);
  const nightRule = customProps(ruleBody(css, '[data-theme="night"]'));
  const systemNight = customProps(ruleBody(css, ':root:not([data-theme="day"]):not([data-theme="night"])'));
  for (const [key, value] of Object.entries(night)) {
    assert.equal(nightRule[key], value, key);
    assert.equal(systemNight[key], value, `system ${key}`);
  }
  assert.match(css, /--radius-sm:\s*4px/);
  assert.match(css, /--radius-md:\s*6px/);
  assert.match(css, /--shadow:\s*none/);
  assert.match(css, /--measure:\s*36rem/);
  assert.match(css, /--measure-index:\s*40rem/);
  assert.match(ruleBody(css, ".is-home .top-inner,"), /max-width:\s*var\(--measure-index\)/);
  assert.match(ruleBody(css, ".is-post .top-inner,"), /max-width:\s*var\(--measure\)/);
});

test("shared header links home and posts back to the root site", () => {
  const header = base.slice(base.indexOf('<header class="top">'), base.indexOf("</header>"));
  assert.match(header, /<a class="root-link" href="https:\/\/yurkingw\.github\.io\/">Home<\/a>/);
  assert.match(header, /<a class="brand" href="\{\{ "\/" \| url \}\}">\{\{ site\.title \}\}<\/a>/);
  assert.doesNotMatch(header, /href="\{\{ "\/" \| url \}\}"[^>]*>Home</);
  assert.doesNotMatch(index, /yurkingw\.github\.io\/"/);
  assert.doesNotMatch(post, /yurkingw\.github\.io\/"/);
  const link = ruleBody(css, ".root-link");
  assert.match(link, /color:\s*var\(--muted\)/);
  assert.match(link, /font-size:\s*var\(--t5-size\)/);
  assert.match(link, /text-decoration:\s*none/);
  assert.match(link, /white-space:\s*nowrap/);
  assert.doesNotMatch(link, /display:\s*none|visibility:\s*hidden|opacity:\s*0/);
  const lockup = ruleBody(css, ".brand-lockup");
  assert.match(lockup, /display:\s*flex/);
  assert.match(lockup, /align-items:\s*baseline/);
  assert.match(lockup, /gap:\s*var\(--s-2\)/);
  assert.match(ruleBody(css, ".root-link:hover,"), /color:\s*var\(--ink\)/);
});

test("theme and language share one segmented control", () => {
  assert.match(base, /class="seg theme-switch"/);
  assert.match(base, /class="seg-gap" aria-hidden="true">·<\/span>/);
  assert.match(post, /class="seg lang-switch"/);
  assert.match(post, /class="seg-gap" aria-hidden="true">·<\/span>/);
  assert.match(base, /class="is-post"/);
  assert.match(base, /class="is-home"/);
  const button = ruleBody(css, ".seg button");
  assert.match(button, /height:\s*24px/);
  assert.match(button, /padding:\s*0 6px/);
  assert.match(button, /border:\s*0/);
  assert.match(button, /background:\s*transparent/);
  assert.match(button, /border-radius:\s*0/);
  assert.match(button, /box-shadow:\s*none/);
  assert.match(button, /appearance:\s*none/);
  const hit = ruleBody(css, ".seg button::before");
  assert.match(hit, /height:\s*44px/);
  const on = ruleBody(css, '.seg button[aria-pressed="true"]');
  assert.match(on, /color:\s*var\(--ink\)/);
  assert.match(on, /font-weight:\s*600/);
  assert.match(on, /border-bottom-color:\s*var\(--ink\)/);
  assert.match(ruleBody(css, ".top"), /height:\s*var\(--s-7\)/);
  assert.match(ruleBody(css, ".top"), /border-bottom:\s*1px solid var\(--line\)/);
  assert.doesNotMatch(ruleBody(css, ".top"), /overflow:\s*hidden/);
  assert.match(ruleBody(css, ".brand::before,"), /height:\s*44px/);
  assert.match(css, /max-width:\s*380px[\s\S]*?\.top\s*\{[^}]*height:\s*auto/);
  assert.match(css, /max-width:\s*380px[\s\S]*?\.top\s*\{[^}]*min-height:\s*var\(--s-7\)/);
  assert.match(css, /max-width:\s*380px[\s\S]*?\.top\s*\{[^}]*overflow:\s*visible/);
  assert.match(css, /max-width:\s*380px[\s\S]*?\.top-inner\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(css, /max-width:\s*380px[\s\S]*?\.top-inner\s*\{[^}]*row-gap:\s*var\(--s-2\)/);
  assert.match(css, /max-width:\s*380px[\s\S]*?\.brand-lockup,\s*\.top \.theme-switch\s*\{[^}]*flex-shrink:\s*0/);
});

test("index, summary, and original use the reading rhythm", () => {
  assert.match(index, /<ul class="index">/);
  assert.match(ruleBody(css, ".index"), /list-style:\s*none/);
  assert.match(ruleBody(css, ".index"), /border-top:\s*1px solid var\(--line\)/);
  assert.match(ruleBody(css, ".index a"), /padding-block:\s*var\(--s-4\)/);
  assert.match(ruleBody(css, ".index a:hover,"), /background:\s*var\(--hover-tint\)/);
  assert.match(ruleBody(css, ".byline"), /margin-top:\s*var\(--s-1\)/);
  assert.match(ruleBody(css, ".byline"), /color:\s*var\(--muted\)/);
  assert.match(ruleBody(css, ".meta"), /margin-top:\s*var\(--s-3\)/);
  assert.match(ruleBody(css, ".meta dt"), /font-size:\s*var\(--t6-size\)/);
  assert.match(ruleBody(css, ".meta dd"), /margin:\s*var\(--s-1\) 0 0/);
  assert.match(ruleBody(css, ".meta dd"), /font-size:\s*var\(--t5-size\)/);
  assert.match(ruleBody(css, ".meta dl"), /gap:\s*var\(--s-3\) var\(--s-5\)/);
  assert.match(ruleBody(css, ".original-url"), /text-underline-offset:\s*2px/);
  const summary = ruleBody(css, ".summary");
  assert.match(summary, /background:\s*var\(--surface-soft\)/);
  assert.match(summary, /border-top:\s*1px solid var\(--line\)/);
  assert.match(summary, /border-bottom:\s*1px solid var\(--line\)/);
  assert.match(summary, /padding-top:\s*var\(--s-5\)/);
  assert.match(summary, /padding-bottom:\s*var\(--s-5\)/);
  assert.match(summary, /width:\s*100vw/);
  assert.match(summary, /margin-left:\s*calc\(50% - 50vw\)/);
  assert.match(summary, /padding-left:\s*calc\(50vw - 50%\)/);
  assert.match(ruleBody(css, ".label-note"), /margin:\s*var\(--s-3\) 0 var\(--s-2\)/);
  assert.match(ruleBody(css, ".summary-body p"), /margin:\s*var\(--s-3\) 0/);
  assert.match(ruleBody(css, ".summary-body ul,"), /padding-left:\s*1\.25em/);
  assert.match(ruleBody(css, ".original"), /margin-top:\s*var\(--s-6\)/);
  assert.match(ruleBody(css, ".original"), /padding-top:\s*var\(--s-4\)/);
  assert.match(ruleBody(css, ".original"), /border-top:\s*1px solid var\(--line\)/);
  assert.match(ruleBody(css, ".original-body p"), /margin:\s*var\(--s-4\) 0/);
  assert.match(ruleBody(css, ".original-body a"), /text-decoration:\s*underline/);
});

test("back to top is a hairline square on the shared layout", () => {
  assert.match(base, /<button type="button" class="back-to-top" aria-label="Back to top" hidden/);
  assert.match(base, /viewBox="0 0 16 16"/);
  assert.match(base, /stroke="currentColor"/);
  assert.match(base, /stroke-width="1\.5"/);
  assert.match(base, /scrollY >= window\.innerHeight/);
  assert.match(base, /scrollTo\(\{ top: 0, behavior: prefersReducedMotion\(\) \? "auto" : "smooth" \}\)/);
  assert.match(base, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(base, /<a href="#"[^>]*class="back-to-top"/);

  const button = ruleBody(css, ".back-to-top");
  assert.match(button, /position:\s*fixed/);
  assert.match(button, /z-index:\s*20\b/);
  assert.match(button, /width:\s*var\(--s-6\)/);
  assert.match(button, /height:\s*var\(--s-6\)/);
  assert.match(button, /border-radius:\s*var\(--radius-sm\)/);
  assert.match(button, /border:\s*1px solid var\(--line\)/);
  assert.match(button, /background:\s*var\(--surface\)/);
  assert.match(button, /box-shadow:\s*none/);
  assert.match(button, /color:\s*var\(--muted\)/);
  assert.match(button, /right:\s*calc\(var\(--s-4\) \+ env\(safe-area-inset-right, 0px\)\)/);
  assert.match(button, /bottom:\s*calc\(var\(--s-4\) \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(button, /opacity:\s*0/);
  assert.match(button, /visibility:\s*hidden/);
  assert.match(button, /pointer-events:\s*none/);
  assert.match(ruleBody(css, ".back-to-top[hidden]"), /display:\s*none/);
  assert.doesNotMatch(button, /backdrop-filter|blur\(|linear-gradient|radial-gradient|999px|border-radius:\s*50%/);
  assert.doesNotMatch(button, /transition:/);

  const visible = ruleBody(css, ".back-to-top.is-visible");
  assert.match(visible, /opacity:\s*1/);
  assert.match(visible, /visibility:\s*visible/);
  assert.match(visible, /pointer-events:\s*auto/);

  const hit = ruleBody(css, ".back-to-top::before");
  assert.match(hit, /width:\s*44px/);
  assert.match(hit, /height:\s*44px/);

  const hover = ruleBody(css, ".back-to-top:hover");
  assert.match(hover, /color:\s*var\(--ink\)/);
  assert.match(hover, /border-color:\s*var\(--line-strong\)/);
  assert.match(ruleBody(css, ".back-to-top:focus-visible"), /color:\s*var\(--ink\)/);
  assert.match(ruleBody(css, ".back-to-top:active"), /color:\s*var\(--ink\)/);
  assert.doesNotMatch(css, /\.back-to-top:active\s*\{[^}]*transform:/);

  assert.match(css, /max-width:\s*380px[\s\S]*?\.back-to-top\s*\{[^}]*right:\s*calc\(var\(--s-3\) \+ env\(safe-area-inset-right, 0px\)\)/);
  assert.match(css, /max-width:\s*380px[\s\S]*?\.back-to-top\s*\{[^}]*bottom:\s*calc\(var\(--s-3\) \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*\.back-to-top \{[^}]*transition:\s*opacity 180ms ease, visibility 0s linear 180ms/
  );
  assert.match(
    css,
    /\.back-to-top\.is-visible \{[^}]*transition:\s*opacity 180ms ease, visibility 0s linear 0s/
  );
  assert.doesNotMatch(ruleBody(css, ".back-to-top svg"), /animation:/);
});
