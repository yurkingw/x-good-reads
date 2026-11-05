import MarkdownIt from "markdown-it";

const markdown = new MarkdownIt({
  html: false,
  xhtmlOut: false,
  linkify: true,
  breaks: true,
  typographer: false
});

const defaultLinkOpen = markdown.renderer.rules.link_open
  || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

markdown.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet("href") || "";
  if (/^https?:\/\//i.test(href)) {
    tokens[idx].attrSet("rel", "noreferrer noopener");
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

export function renderText(value) {
  return markdown.render(String(value ?? ""));
}
