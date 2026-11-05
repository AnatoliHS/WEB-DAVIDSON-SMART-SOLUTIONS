#!/usr/bin/env node
/**
 * Creates a compressed .webp next to every JPG/PNG the site references, then points those
 * references at it. Originals stay in src/assets, untouched. Safe to re-run after adding images:
 * anything already pointing at a .webp is skipped.
 *
 *   node scripts/optimize-images.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC = path.join(__dirname, "..", "src");
const ASSETS = path.join(SRC, "assets");
const TEXT_FILE = /\.(html|njk|json|md|css|ya?ml)$/;

// Keep PNG where other software needs it: browser icons.
const KEEP_IMAGE = /(favicon|apple-touch-icon)/i;

// Sized from how large each is displayed, allowing for 3x phone screens.
const LOGO_WIDTHS = {
  "assets/davidson-logo.png": 600,
  "assets/davidson-logo-light.png": 1100,
  "assets/bulb-white.png": 512,
  "assets/bulb-black.png": 512,
};
const PHOTO_MAX = 2000;

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "admin" ? [] : walk(full);
    return [full];
  });

const siteFiles = walk(SRC);
const textFiles = siteFiles.filter((f) => TEXT_FILE.test(f));
const texts = new Map(textFiles.map((f) => [f, fs.readFileSync(f, "utf8")]));
const allText = [...texts.values()].join("\n");

const images = siteFiles
  .filter((f) => f.startsWith(ASSETS) && /\.(jpe?g|png)$/i.test(f) && !KEEP_IMAGE.test(f))
  .map((file) => ({ file, ref: path.relative(SRC, file).split(path.sep).join("/") }))
  .filter(({ ref }) => allText.includes(ref));

// Names are compared ignoring case: Pergola.webp and pergola.webp are one file on a Mac.
const taken = new Set(siteFiles.map((f) => f.toLowerCase()));
const outputPath = (file) => {
  const base = file.replace(/\.[^.]+$/, "");
  return taken.has(`${base}.webp`.toLowerCase()) ? `${base}-opt.webp` : `${base}.webp`;
};

async function convert({ file, ref }) {
  const logoWidth = LOGO_WIDTHS[ref];
  const isPng = /\.png$/i.test(file);
  const out = outputPath(file);
  const pipeline = sharp(file).rotate();
  const { width: sourceWidth } = await sharp(file).metadata();
  if (logoWidth) pipeline.resize({ width: Math.min(logoWidth, sourceWidth), withoutEnlargement: true });
  else pipeline.resize({ width: PHOTO_MAX, height: PHOTO_MAX, fit: "inside", withoutEnlargement: true });
  const data = await pipeline
    .webp(isPng ? { quality: 90, alphaQuality: 100, effort: 6 } : { quality: 78, smartSubsample: true, effort: 6 })
    .toBuffer();
  const before = fs.statSync(file).size;
  if (data.length >= before * 0.9) return { ref, before, after: before, skipped: true };
  fs.writeFileSync(out, data);
  const outRef = path.relative(SRC, out).split(path.sep).join("/");
  return { ref, outRef, before, after: data.length };
}

(async () => {
  const results = [];
  for (const image of images) results.push(await convert(image));

  const swaps = results.filter((r) => !r.skipped);
  for (const [file, text] of texts) {
    let next = text;
    for (const { ref, outRef } of swaps) next = next.split(ref).join(outRef);
    if (next !== text) fs.writeFileSync(file, next);
  }

  const mb = (n) => (n / 1048576).toFixed(1);
  const total = (key) => results.reduce((sum, r) => sum + r[key], 0);
  results
    .sort((a, b) => b.before - a.before)
    .forEach((r) => console.log(`${mb(r.before).padStart(6)} MB -> ${mb(r.after).padStart(5)} MB  ${r.ref}${r.skipped ? "  (kept: no real saving)" : ""}`));
  console.log(`\n${results.length} images: ${mb(total("before"))} MB -> ${mb(total("after"))} MB`);
})();
