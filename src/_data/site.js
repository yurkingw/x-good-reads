import { baseUrl, description, footerNotice, siteTitle } from "../../site.config.js";
import { absoluteSiteUrl, DEFAULT_OG_IMAGE_PATH } from "../lib/posts.js";

export default {
  baseUrl,
  description,
  footerNotice,
  title: siteTitle,
  ogImage: absoluteSiteUrl(DEFAULT_OG_IMAGE_PATH)
};
