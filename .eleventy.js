const { DateTime } = require("luxon");

// Cloudflare's public test key (always passes), used only for local builds.
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/admin": "admin" });
  eleventyConfig.ignores.add("src/admin/");
  eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });
  eleventyConfig.addPassthroughCopy({ "src/_redirects": "_redirects" });
  eleventyConfig.addPassthroughCopy({ "src/_headers": "_headers" });

  eleventyConfig.addFilter("postDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toLocaleString(DateTime.DATE_MED);
  });

  eleventyConfig.addFilter("readableDate", (value) =>
    new Date(value).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  );

  // CSS background images are found late by browsers: tell them about each page's hero image up front
  eleventyConfig.addTransform("preloadHeroImage", (content, outputPath) => {
    if (!outputPath || !outputPath.endsWith(".html")) return content;
    const hero = content.match(/class="(?:hero-bg-layer|cs-hero-bg)"[^>]*background-image:\s*url\('([^']+)'\)/);
    if (!hero) return content;
    const link = `<link rel="preload" as="image" href="${hero[1]}" fetchpriority="high">`;
    return content.replace("</head>", `  ${link}\n</head>`);
  });

  eleventyConfig.addTemplateFormats("md");
  eleventyConfig.addLayoutAlias("default", "default.njk");
  eleventyConfig.addGlobalData("layout", "default");

  // The Turnstile site key is public, but differs per environment, so it comes from the
  // TURNSTILE_SITE_KEY build variable. A Cloudflare build without it renders forms that
  // offer email/phone instead of a test widget the real secret key would always reject.
  const onCloudflare = Boolean(process.env.CF_PAGES);
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY || (onCloudflare ? "" : TURNSTILE_TEST_SITE_KEY);
  if (onCloudflare && !turnstileSiteKey) {
    console.warn("[contact form] TURNSTILE_SITE_KEY is not set: online form sending is disabled in this build.");
  }
  eleventyConfig.addGlobalData("turnstileSiteKey", turnstileSiteKey);

  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "njk",
  };
};
