/* Settings applied to every post in this folder.
 * (Replaces the old research.json — same job, but this can compute values.)
 */
module.exports = {
  layout: "layouts/post.njk",
  tags: ["research"],

  eleventyComputed: {
    // A post left as a draft in the editor is saved to the repository but no
    // page is built for it. It is genuinely unpublished, not merely missing
    // from the listings — there is no URL a stranger could guess.
    permalink: (data) => (data.draft ? false : data.permalink),
    eleventyExcludeFromCollections: (data) =>
      data.draft ? true : data.eleventyExcludeFromCollections,
  },
};
