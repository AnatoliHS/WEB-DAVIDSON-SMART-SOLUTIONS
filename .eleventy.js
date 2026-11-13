const { DateTime } = require("luxon");

// Turnstile site keys are public (they appear in the page source), so they live in code.
// The real key is used on Cloudflare builds; Cloudflare's test key (always passes) locally.
const TURNSTILE_SITE_KEY = "0x4AAAAAAF_tZsvdbgUx_jz8";
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

  // Sitemap <lastmod>: a YYYY-MM-DD date
  eleventyConfig.addFilter("dateToIso", (value) => new Date(value).toISOString().slice(0, 10));

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

  // Turnstile site key: a TURNSTILE_SITE_KEY build variable overrides it if ever set.
  // Local builds use the test key, since the real key only works on the widget's listed hostnames.
  const onCloudflare = Boolean(process.env.CF_PAGES);
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY || (onCloudflare ? TURNSTILE_SITE_KEY : TURNSTILE_TEST_SITE_KEY);
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
