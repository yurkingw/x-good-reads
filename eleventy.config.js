import { pathPrefix } from "./site.config.js";
import { contentLang } from "./src/lib/content-lang.js";
import { renderText } from "./src/lib/render.js";

export default function (eleventyConfig) {
  eleventyConfig.addFilter("renderText", (value) => renderText(value));
  eleventyConfig.addFilter("contentLang", (value) => contentLang(value));
  eleventyConfig.addPassthroughCopy({
    "src/css": "css",
    "src/favicon.svg": "favicon.svg",
    "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2": "fonts/inter-latin-wght-normal.woff2",
    "node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2": "fonts/inter-latin-ext-wght-normal.woff2",
    "media": "media"
  });
  eleventyConfig.addWatchTarget("./content/");
}

export const config = {
  pathPrefix,
  dir: {
    input: "src",
    includes: "_includes",
    data: "_data",
    output: "_site"
  }
};
