const fs = require("fs");
const path = require("path");
const markdownIt = require("markdown-it");
const markdownItFootnote = require("markdown-it-footnote");
const markdownItAnchor = require("markdown-it-anchor");

module.exports = function (eleventyConfig) {
  // Copy assets (fonts, css, downloadable data files) straight through to the build
  eleventyConfig.addPassthroughCopy("src/assets");

  // Browsers ask for /favicon.ico at the root whether or not it is linked
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });

  // The content manager is a static app — copy it verbatim, never render it
  // as a template (its HTML is not Nunjucks).
  eleventyConfig.addPassthroughCopy("src/admin");
  eleventyConfig.ignores.add("src/admin/**");

  // Rebuild when a chart's data changes
  eleventyConfig.addWatchTarget("charts/");

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

  // Hide anything still marked as a draft in the editor
  eleventyConfig.addFilter("published", (posts) =>
    (posts || []).filter((post) => !post.data.draft)
  );

  // ---- Authoring shortcodes --------------------------------------------
  // These exist so a post never has to contain hand-written HTML.

  const captionHtml = (caption) =>
    caption ? `\n<p class="caption">${caption}</p>` : "";

  // {% figure "Figure 1. Caption." %} …anything… {% endfigure %}
  // Wraps arbitrary content in the site's figure block.
  eleventyConfig.addPairedShortcode("figure", (content, caption) => {
    return `<div class="figure">\n${content.trim()}${captionHtml(caption)}\n</div>`;
  });

  // {% image "photo.png", "Figure 2. Caption.", "alt text" %}
  // Files live in src/assets/img/ (or img/uploads/ if added via the CMS).
  eleventyConfig.addShortcode("image", (src, caption, alt) => {
    const url = /^(https?:|\/)/.test(src) ? src : `/assets/img/${src}`;
    const altText = (alt || caption || "").replace(/"/g, "&quot;");
    return `<div class="figure">\n<img src="${url}" alt="${altText}" style="max-width:100%;height:auto;">${captionHtml(
      caption
    )}\n</div>`;
  });

  // {% chart "cpi-inflation", "Figure 1. CPI inflation. Source: ONS." %}
  // Reads charts/cpi-inflation.json — a Plotly figure exported from Python
  // with fig.write_json(). Site styling is applied in the browser by
  // assets/js/charts.js, so the Python script needs no styling boilerplate.
  eleventyConfig.addShortcode("chart", (name, caption) => {
    const file = path.join(__dirname, "charts", `${name}.json`);
    if (!fs.existsSync(file)) {
      console.warn(`[chart] missing data file: charts/${name}.json`);
      return `<div class="figure"><p class="caption">Chart “${name}” not found — expected <code>charts/${name}.json</code>.</p></div>`;
    }
    // Escaping "<" stops a "</script>" inside the data from closing the tag early.
    const spec = fs.readFileSync(file, "utf8").trim().replace(/</g, "\\u003c");
    return `<div class="figure">\n<div class="chart" data-chart><script type="application/json">${spec}</script></div>${captionHtml(
      caption
    )}\n</div>`;
  });

  // ---- Small-caps opener -----------------------------------------------
  // The first few words of an article are set in small capitals. This used to
  // mean typing <span class="opener"> by hand; now it is automatic. Writing
  // the span manually still works and takes precedence.
  const OPENER_WORDS = 3;
  eleventyConfig.addTransform("opener", function (content) {
    const out = this.page && this.page.outputPath;
    if (!out || !out.endsWith(".html")) return content;
    if (!content.includes('class="post-body"')) return content;
    if (content.includes('class="opener"')) return content;

    return content.replace(
      /(<div class="post-body">\s*<p[^>]*>)([^<]+)/,
      (match, openTag, text) => {
        const parts = text.split(/(\s+)/); // keeps the whitespace as entries
        let words = 0;
        let i = 0;
        for (; i < parts.length && words < OPENER_WORDS; i++) {
          if (parts[i].trim()) words++;
        }
        const head = parts.slice(0, i).join("");
        const tail = parts.slice(i).join("");
        if (!head.trim()) return match;
        return `${openTag}<span class="opener">${head}</span>${tail}`;
      }
    );
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
