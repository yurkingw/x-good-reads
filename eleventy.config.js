import { pathPrefix } from "./site.config.js";
import { renderText } from "./src/lib/render.js";

export default function (eleventyConfig) {
  eleventyConfig.addFilter("renderText", (value) => renderText(value));
  eleventyConfig.addPassthroughCopy({
    "src/css": "css",
    "src/favicon.svg": "favicon.svg"
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
