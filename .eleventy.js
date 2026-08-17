const markdownIt = require("markdown-it");
const markdownItFootnote = require("markdown-it-footnote");
const markdownItAnchor = require("markdown-it-anchor");

module.exports = function (eleventyConfig) {
  // Copy assets (fonts, css, downloadable data files) straight through to the build
  eleventyConfig.addPassthroughCopy("src/assets");

  // ---- Markdown configuration ------------------------------------------
  const md = markdownIt({ html: true, linkify: true, typographer: true })
    .use(markdownItFootnote)
    .use(markdownItAnchor, {
      permalink: false,
      slugify: (s) =>
        s
          .trim()
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-"),
    });

  // Render footnote markers as plain superscript numbers (no brackets)
  md.renderer.rules.footnote_caption = (tokens, idx) => {
    let n = Number(tokens[idx].meta.id + 1).toString();
    if (tokens[idx].meta.subId > 0) n += ":" + tokens[idx].meta.subId;
    return n;
  };

  eleventyConfig.setLibrary("md", md);

  // ---- Table of contents filter ----------------------------------------
  eleventyConfig.addFilter("toc", (html) => {
    if (!html) return [];
    const headings = [];
    const re = /<h2[^>]*\sid="([^"]+)"[^>]*>(.*?)<\/h2>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const text = m[2].replace(/<[^>]+>/g, "").trim();
      headings.push({ id: m[1], text });
    }
    return headings;
  });

  // Current year, for the footer
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  // A simple date filter for post listings
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    if (!dateObj) return "";
    const d = new Date(dateObj);
    return d.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
