// Builds the Font Awesome CSS for the page <head>, keeping only icons the site uses. It is regenerated on
// every build by scanning src/ for "fa-" class names, so an icon added in the CMS or a template just works.
// Icons built from a variable name at runtime aren't detected: write out the full class name somewhere.
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..");
const VENDOR = path.join(SRC, "_includes", "vendor", "font-awesome-6.4.0.min.css");
const SCANNED = /\.(html|njk|md|json|ya?ml|js|css)$/;
const SKIPPED_DIRS = new Set(["admin", "vendor", "images", "fonts"]);

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : walk(path.join(dir, entry.name));
    return SCANNED.test(entry.name) ? [path.join(dir, entry.name)] : [];
  });

module.exports = () => {
  const used = new Set();
  for (const file of walk(SRC)) {
    for (const [name] of fs.readFileSync(file, "utf8").matchAll(/\bfa-[a-z0-9-]+/g)) used.add(name);
  }

  return fs
    .readFileSync(VENDOR, "utf8")
    // Only the Font Awesome 6 fonts are served; the site doesn't use the v4/v5 compatibility names
    .replace(/@font-face\{[^}]*\}/g, (face) => {
      if (!face.includes('"Font Awesome 6')) return "";
      return face.replace(/src:[^;}]*/, (src) => `src:${src.match(/url\([^)]*\.woff2\) format\("woff2"\)/)[0]}`);
    })
    .replace(/\.\.\/webfonts\//g, "/assets/fonts/fa/")
    // Icon rules look like .fa-x:before,.fa-y:before{content:"..."}: drop the names nothing uses
    .replace(/([^{}]+)\{content:"[^"]*"\}/g, (rule, selectors) => {
      const list = selectors.split(",");
      if (!list.every((s) => /^\.fa-[a-z0-9-]+:before$/.test(s))) return rule;
      const kept = list.filter((s) => used.has(s.slice(1, -":before".length)));
      return kept.length ? rule.replace(selectors, kept.join(",")) : "";
    });
};
