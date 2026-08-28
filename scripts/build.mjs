import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ARTICLE_EDITS, GLOSSARY_EDITS } from "../source/editorial-edits.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "source", "wordpress");
const OUTPUT = path.join(ROOT, "_site");
const MEDIA_SOURCE = path.join(ROOT, "src", "media");
const SITE_URL = process.env.SITE_URL || "https://staging.rivka.me";
const WORDPRESS_URL = "https://rivka.me";
const STYLES_CSS = minifyCss(fs.readFileSync(path.join(ROOT, "src", "static", "styles.css"), "utf8"));
const SCRIPT_HREF = `/assets/site.js?${Math.trunc(fs.statSync(path.join(ROOT, "src", "static", "site.js")).mtimeMs)}`;

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(SOURCE, name), "utf8"));
const generalPosts = readJson("posts.json");
const stsPosts = readJson("sts-posts.json");
const pages = readJson("pages.json");
const categories = readJson("categories.json");
const glossary = fs.existsSync(path.join(SOURCE, "glossary.json")) ? readJson("glossary.json") : [];

const uniquePosts = new Map();
for (const post of [...generalPosts, ...stsPosts]) uniquePosts.set(post.id, post);
const allPosts = [...uniquePosts.values()].sort((a, b) => new Date(b.date_gmt || b.date) - new Date(a.date_gmt || a.date));
const categoryById = new Map(categories.map((category) => [category.id, category]));
const articleEditsBySlug = new Map(ARTICLE_EDITS.map((entry) => [entry.slug, entry.replacements]));
const articleSlugs = new Set(allPosts.map((post) => post.slug));
const missingEditorialReviews = allPosts.filter((post) => !articleEditsBySlug.has(post.slug));
const orphanedEditorialReviews = ARTICLE_EDITS.filter((entry) => !articleSlugs.has(entry.slug));
if (missingEditorialReviews.length || orphanedEditorialReviews.length) {
  throw new Error(`Editorial review index is out of sync. Missing: ${missingEditorialReviews.map((post) => post.slug).join(", ") || "none"}. Orphaned: ${orphanedEditorialReviews.map((entry) => entry.slug).join(", ") || "none"}.`);
}

const CATEGORY_LABELS = new Map([[1, "Other"]]);
const MATH_HEAD = `
  <link rel="stylesheet" href="/assets/katex/katex.min.css">
  <script defer src="/assets/katex/katex.min.js"></script>
  <script defer src="/assets/katex/auto-render.min.js"></script>`;
const SUBSCRIBE_ENDPOINT = process.env.SUBSCRIBE_ENDPOINT || "https://rivka-subscribe.rivkalipko.workers.dev/subscribe";
const DEFAULT_SOCIAL = "/assets/media/2025/06/20250306_-Lipkovitz_Rivka_CasualPortraits_0005_KR-scaled.jpg";
const IMAGE_MAX_SIDE = 1600;
const imageMeta = new Map();

function decodeEntities(value = "") {
  const named = {
    amp: "&", apos: "'", gt: ">", hellip: "…", laquo: "«", ldquo: "“",
    lsquo: "‘", lt: "<", mdash: "—", nbsp: " ", ndash: "–", quot: '"',
    raquo: "»", rdquo: "”", rsquo: "’"
  };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function stripHtml(value = "") {
  return decodeEntities(value)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateWords(value, maximum = 54) {
  const words = value.split(/\s+/).filter(Boolean);
  return words.length <= maximum ? words.join(" ") : `${words.slice(0, maximum).join(" ")}…`;
}

function titleOf(record) {
  return decodeEntities(record?.title?.rendered || "");
}

function mediaInfo(rawUrl) {
  if (!rawUrl) return null;
  const decoded = decodeEntities(rawUrl).replace(/^\/\//, "https://");
  let match = decoded.match(/^https?:\/\/i\d\.wp\.com\/rivka\.me\/wp-content\/uploads\/([^?"'<>\s]+)/i);
  if (!match) match = decoded.match(/^https?:\/\/rivka\.me\/wp-content\/uploads\/([^?"'<>\s]+)/i);
  if (!match) return null;
  const relative = decodeURIComponent(match[1]).replace(/^\/+/, "");
  if (relative.includes("..")) return null;
  return {
    source: `${WORDPRESS_URL}/wp-content/uploads/${relative.split("/").map(encodeURIComponent).join("/")}`,
    relative,
    publicPath: `/assets/media/${relative.split("/").map(encodeURIComponent).join("/")}`
  };
}

function localizeUrl(rawUrl) {
  const media = mediaInfo(rawUrl);
  if (media) return media.publicPath;
  const decoded = decodeEntities(rawUrl);
  const proxied = decoded.match(/^https?:\/\/i\d\.wp\.com\/([^?"'<>\s]+)(?:\?.*)?$/i);
  return proxied ? `https://${proxied[1]}` : decoded;
}

function mediaRecord(publicPath) {
  if (!publicPath) return null;
  return imageMeta.get(publicPath) || imageMeta.get(decodeURIComponent(publicPath)) || null;
}

function mediaHref(publicPath) {
  return mediaRecord(publicPath)?.href || publicPath;
}

function smallestSrc(record, fallback = "") {
  if (record?.srcset) return record.srcset.split(",")[0].trim().split(/\s+/)[0];
  return record?.href || fallback;
}

function fileToPublicPath(absFile) {
  const rel = path.relative(path.join(OUTPUT, "assets", "media"), absFile);
  return `/assets/media/${rel.split(path.sep).map(encodeURIComponent).join("/")}`;
}

function rememberImage(publicPath, record) {
  imageMeta.set(publicPath, record);
  if (record.href !== publicPath) imageMeta.set(record.href, record);
}

function readPngSize(buffer) {
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function readJpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (offset + 4 >= buffer.length) break;
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

function readWebpSize(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") return null;
  const type = buffer.toString("ascii", 12, 16);
  if (type === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16),
      height: 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16)
    };
  }
  if (type === "VP8 " && buffer.length >= 30) {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (type === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function readImageSize(file) {
  const ext = path.extname(file).toLowerCase();
  const fd = fs.openSync(file, "r");
  const size = Math.min(fs.fstatSync(fd).size, 1024 * 1024);
  const buffer = Buffer.alloc(size);
  fs.readSync(fd, buffer, 0, size, 0);
  fs.closeSync(fd);
  if (ext === ".png") return readPngSize(buffer);
  if (ext === ".jpg" || ext === ".jpeg") return readJpegSize(buffer);
  if (ext === ".webp") return readWebpSize(buffer);
  return null;
}

function walkFiles(directory, acc = []) {
  if (!fs.existsSync(directory)) return acc;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function resolveCwebp() {
  for (const bin of ["cwebp", "/Users/rivka/miniconda3/bin/cwebp", "/opt/homebrew/bin/cwebp", "/usr/local/bin/cwebp", "/usr/bin/cwebp"]) {
    try {
      execFileSync(bin, ["-version"], { stdio: "ignore" });
      return bin;
    } catch {
      /* try the next candidate */
    }
  }
  return "";
}

function outputDimensions(width, height) {
  const max = Math.max(width, height);
  if (max <= IMAGE_MAX_SIDE) return { width, height };
  const scale = IMAGE_MAX_SIDE / max;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function convertWebp(cwebp, input, dest, resize) {
  const args = ["-quiet", "-mt", "-q", "90", "-m", "4"];
  if (resize) args.push("-resize", String(resize.width), String(resize.height));
  execFileSync(cwebp, [...args, input, "-o", dest], { stdio: "ignore" });
  return fs.existsSync(dest) ? fs.statSync(dest).size : Number.POSITIVE_INFINITY;
}

function optimizeCopiedMedia() {
  const mediaRoot = path.join(OUTPUT, "assets", "media");
  const cwebp = resolveCwebp();
  const files = walkFiles(mediaRoot).filter((file) => /\.(jpe?g|png|webp)$/i.test(file));
  let converted = 0;
  for (const file of files) {
    const publicPath = fileToPublicPath(file);
    const size = readImageSize(file) || { width: 0, height: 0 };
    const ext = path.extname(file).toLowerCase();
    const originalBytes = fs.statSync(file).size;
    let href = publicPath;
    let width = size.width;
    let height = size.height;
    let srcset = "";
    if (cwebp && (ext === ".jpg" || ext === ".jpeg" || ext === ".png") && originalBytes > 4096) {
      const destFull = `${file}.webp`;
      const full = outputDimensions(width || IMAGE_MAX_SIDE, height || IMAGE_MAX_SIDE);
      const resized = width && height && Math.max(width, height) > IMAGE_MAX_SIDE
        ? { width: full.width, height: full.height }
        : null;
      try {
        const fullBytes = convertWebp(cwebp, file, destFull, resized);
        if (fullBytes < originalBytes) {
          href = `${publicPath}.webp`;
          if (resized) {
            width = full.width;
            height = full.height;
          }
          const candidates = [`${href} ${width || full.width}w`];
          if (size.width > 960) {
            const small = { width: 800, height: Math.max(1, Math.round(size.height * (800 / size.width))) };
            const destSmall = `${file}.w800.webp`;
            const smallBytes = convertWebp(cwebp, file, destSmall, small);
            if (smallBytes < originalBytes) {
              candidates.unshift(`${publicPath}.w800.webp 800w`);
            } else if (fs.existsSync(destSmall)) {
              fs.unlinkSync(destSmall);
            }
          }
          srcset = candidates.join(", ");
          fs.unlinkSync(file);
          converted += 1;
        } else if (fs.existsSync(destFull)) {
          fs.unlinkSync(destFull);
        }
      } catch {
        if (fs.existsSync(destFull)) fs.unlinkSync(destFull);
        const destSmall = `${file}.w800.webp`;
        if (fs.existsSync(destSmall)) fs.unlinkSync(destSmall);
        href = publicPath;
        width = size.width;
        height = size.height;
        srcset = "";
      }
    }
    rememberImage(publicPath, { href, width, height, srcset });
  }
  return converted;
}

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function firstImageSrc(html) {
  return html.match(/<img\b[^>]*\ssrc=(['"])(.*?)\1/i)?.[2] || "";
}

function preloadImageTag(href, sizes = "") {
  if (!href) return "";
  const record = mediaRecord(href);
  const imageHref = record?.href || href;
  const type = imageHref.endsWith(".webp") ? ' type="image/webp"' : "";
  if (record?.srcset) {
    const imagesizes = sizes || "(max-width: 820px) 100vw, 820px";
    const fallback = record.srcset.split(",")[0].trim().split(/\s+/)[0];
    return `<link rel="preload" as="image"${type} href="${escapeHtml(fallback)}" imagesrcset="${escapeHtml(record.srcset)}" imagesizes="${escapeHtml(imagesizes)}" fetchpriority="high">`;
  }
  return `<link rel="preload" as="image"${type} href="${escapeHtml(imageHref)}" fetchpriority="high">`;
}

function markFirstImagePriority(html, sizes = "") {
  let done = false;
  return html.replace(/<img\b[^>]*>/i, (tag) => {
    if (done) return tag;
    done = true;
    let next = tag
      .replace(/\sloading=(['"])[^'"]*\1/i, "")
      .replace(/\sfetchpriority=(['"])[^'"]*\1/i, "");
    if (sizes) {
      next = next.replace(/\ssizes=(['"])[^'"]*\1/i, "");
      next = next.replace(/<img/i, `<img sizes="${sizes}"`);
    }
    return next.replace(/<img/i, '<img loading="eager" fetchpriority="high"');
  });
}

function cleanImageTag(tag) {
  const dataSource = tag.match(/\sdata-src=(['"])(.*?)\1/i)?.[2];
  const regularSource = tag.match(/\ssrc=(['"])(.*?)\1/i)?.[2];
  const chosenSource = dataSource || regularSource;
  let output = tag
    .replace(/\s(?:data-src|data-srcset|data-sizes|data-recalc-dims)=(['"])[\s\S]*?\1/gi, "")
    .replace(/\ssrcset=(['"])[\s\S]*?\1/gi, "")
    .replace(/\ssizes=(['"])[\s\S]*?\1/gi, "")
    .replace(/\ssrc=(['"])[\s\S]*?\1/gi, "")
    .replace(/\sclass=(['"])(.*?)\1/i, (_, quote, classes) => {
      const cleaned = classes.split(/\s+/).filter((name) => name && name !== "lazyload").join(" ");
      return cleaned ? ` class=${quote}${cleaned}${quote}` : "";
    })
    .replace(/\sstyle=(['"])(.*?)\1/i, (_, quote, style) => {
      const cleaned = style.replace(/--smush-[^;]+;?/gi, "").trim();
      return cleaned ? ` style=${quote}${cleaned}${quote}` : "";
    });

  if (chosenSource && !chosenSource.startsWith("data:image/svg+xml")) {
    const localized = localizeUrl(chosenSource);
    const record = mediaRecord(localized);
    const href = smallestSrc(record, record?.href || localized);
    output = output.replace(/<img/i, `<img src="${escapeHtml(href)}"`);
    if (record?.width && record?.height && !/\swidth=/i.test(output)) {
      output = output.replace(/<img/i, `<img width="${record.width}" height="${record.height}"`);
    }
    if (record?.srcset && !/\ssrcset=/i.test(output)) {
      output = output.replace(/<img/i, `<img srcset="${escapeHtml(record.srcset)}"`);
    }
  }
  if (!/\sdecoding=/i.test(output)) output = output.replace(/<img/i, '<img decoding="async"');
  if (!/\ssizes=/i.test(output)) output = output.replace(/<img/i, '<img sizes="(max-width: 820px) 100vw, 820px"');
  if (!/\sloading=/i.test(output)) output = output.replace(/<img/i, '<img loading="lazy"');
  return output;
}

function applyValidatedReplacements(value, replacements, label) {
  let output = value;
  for (const [from, to] of replacements || []) {
    if (!output.includes(from)) throw new Error(`Editorial edit did not match in ${label}: ${from}`);
    output = output.replace(from, to);
  }
  return output;
}

function editedPostContent(post) {
  return applyValidatedReplacements(post.content.rendered, articleEditsBySlug.get(post.slug), post.slug);
}

// KaTeX is three CDN requests, so only the articles that actually carry math pay for it.
function hasMath(html) {
  return /\\\(|\\\[/.test(html);
}

function normalizeProseHeadings(html) {
  const used = [...new Set([...html.matchAll(/<h([2-6])\b/gi)].map((match) => Number(match[1])))].sort((a, b) => a - b);
  if (!used.length) return html;
  const map = new Map();
  let next = 2;
  for (const level of used) {
    map.set(level, next);
    next += 1;
  }
  if ([...map.entries()].every(([from, to]) => from === to)) return html;
  return html.replace(/<\/?h([2-6])\b([^>]*)>/gi, (full, level, attrs) => {
    const source = Number(level);
    const dest = map.get(source);
    if (full.startsWith("</")) return `</h${dest}>`;
    if (/class=(['"])(.*?)\1/i.test(attrs)) {
      return `<h${dest}${attrs.replace(/class=(['"])(.*?)\1/i, (_, quote, classes) => `class=${quote}${classes} is-h${source}${quote}`)}>`;
    }
    return `<h${dest}${attrs} class="is-h${source}">`;
  });
}

function enhanceTables(html) {
  return html.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (table) => {
    if (/<th\b/i.test(table)) return table;
    const open = table.match(/^<table\b[^>]*>/i)?.[0];
    if (!open) return table;
    const inner = table
      .replace(/^<table\b[^>]*>/i, "")
      .replace(/<\/table>$/i, "")
      .replace(/<\/?t(?:head|body|foot)\b[^>]*>/gi, "");
    const rows = inner.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
    if (rows.length < 2) return table;
    const isShortHeader = (row) => {
      const texts = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripHtml(match[1]).trim());
      return texts.some(Boolean) && texts.every((text) => text.length <= 40);
    };
    let headerCount = 0;
    while (headerCount < Math.min(2, rows.length - 1) && isShortHeader(rows[headerCount])) headerCount += 1;
    if (!headerCount) return table;
    const toHeaderRow = (row) => row.replace(/<td(\b[^>]*)>/gi, '<th$1 scope="col">').replace(/<\/td>/gi, "</th>");
    return `${open}<thead>${rows.slice(0, headerCount).map(toHeaderRow).join("")}</thead><tbody>${rows.slice(headerCount).join("")}</tbody></table>`;
  });
}

function annotateVagueLinks(html) {
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (full, attrs, inner) => {
    if (/aria-label=/i.test(attrs) || /aria-hidden=(['"])true\1/i.test(attrs)) return full;
    const text = stripHtml(inner).replace(/\s+/g, " ").trim();
    const href = attrs.match(/href=(['"])(.*?)\1/i)?.[2] || "";
    if (/^(here|click here)$/i.test(text)) {
      const capitalized = text[0] === "H" || text[0] === "C";
      let replacement = capitalized ? "This source" : "this source";
      if (/docs\.google\.com\/spreadsheets/i.test(href)) replacement = capitalized ? "This spreadsheet" : "this spreadsheet";
      else if (href.startsWith("/")) replacement = capitalized ? "This article" : "this article";
      return `<a${attrs}>${replacement}</a>`;
    }
    if (/^\[(\d+)\]$/.test(text)) {
      return `<a${attrs} aria-label="Reference ${text.slice(1, -1)}">${inner}</a>`;
    }
    return full;
  });
}

function cleanContent(value = "") {
  return annotateVagueLinks(enhanceTables(normalizeProseHeadings(value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<img\b[^>]*>/gi, cleanImageTag)
    .replace(/\srel=(['"])noopener nofollow\1/gi, ' rel="noopener noreferrer nofollow"')
    .replace(/https?:\/\/i\d\.wp\.com\/rivka\.me\/wp-content\/uploads\/([^?"'<>\s]+)(?:\?[^"'<>\s]*)?/gi, (_, relative) => `/assets/media/${decodeURIComponent(relative)}`)
    .replace(/https?:\/\/rivka\.me\/wp-content\/uploads\/([^?"'<>\s]+)(?:\?[^"'<>\s]*)?/gi, (_, relative) => `/assets/media/${decodeURIComponent(relative)}`)
    .replace(/https?:\/\/i\d\.wp\.com\/([^?"'<>\s]+)(?:\?[^"'<>\s]*)?/gi, "https://$1")
    .replace(/https?:\/\/rivka\.me\//gi, "/")
    .replace(/\s(?:data-recalc-dims|data-image-caption|data-image-description)=(['"])[\s\S]*?\1/gi, "")
    .replace(/<p>\s*<\/p>/gi, "")
    .replace(/\bp\s+-values\b/g, "p-values")
    .replace(/\bp\s+-value\b/g, "p-value")
    .replace(/often a p-value &lt; 0\.05/g, "often a p-value &gt; 0.05")
    .replace(/\b(\d{4})-(\d{4})\b/g, "$1–$2")
    .trim())));
}

function featuredImage(record) {
  const raw = record?._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
  return raw ? mediaHref(localizeUrl(raw)) : "";
}

function recordCategories(post) {
  return (post.categories || []).map((id) => categoryById.get(id)).filter(Boolean);
}

function categoryLabel(category) {
  return CATEGORY_LABELS.get(category.id) || category.name;
}

function formatDate(post) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(post.date_gmt || post.date));
}

function isoDate(post) {
  return new Date(post.date_gmt || post.date).toISOString();
}

function descriptionOf(record, maximum = 36) {
  const articleContent = articleEditsBySlug.has(record?.slug) ? editedPostContent(record) : record?.content?.rendered;
  return truncateWords(stripHtml(record?.excerpt?.rendered || articleContent || ""), maximum);
}

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeRoute(route, html) {
  const normalized = route === "/" ? "" : route.replace(/^\/+|\/+$/g, "");
  const directory = path.join(OUTPUT, normalized);
  ensureDir(directory);
  fs.writeFileSync(path.join(directory, "index.html"), html);
}

function canonical(route) {
  return `${SITE_URL}${route.startsWith("/") ? route : `/${route}`}`;
}

function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const SEARCH_ICON = '<svg viewBox="0 0 1792 1792" aria-hidden="true" focusable="false"><path d="M1216 832q0-185-131.5-316.5t-316.5-131.5-316.5 131.5-131.5 316.5 131.5 316.5 316.5 131.5 316.5-131.5 131.5-316.5zm512 832q0 52-38 90t-90 38q-54 0-90-38l-343-342q-179 124-399 124-143 0-273.5-55.5t-225-150-150-225-55.5-273.5 55.5-273.5 150-225 225-150 273.5-55.5 273.5 55.5 225 150 150 225 55.5 273.5q0 220-124 399l343 343q37 37 37 90z"/></svg>';
const PALETTE_ICON = '<svg viewBox="0 0 512 512" aria-hidden="true" focusable="false"><path d="M256,0C114.516,0,0,114.497,0,256c0,141.484,114.497,256,256,256c141.484,0,256-114.497,256-256 C512,114.516,397.503,0,256,0z M276,471.079V40.921C385.28,50.889,472,142.704,472,256C472,369.28,385.294,461.11,276,471.079z"/></svg>';
const CLOSE_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M14.95 6.46L11.41 10l3.54 3.54l-1.41 1.41L10 11.42l-3.53 3.53l-1.42-1.42L8.58 10L5.05 6.47l1.42-1.42L10 8.58l3.54-3.53z"/></svg>';

function header() {
  return `
    <a class="skip-link" href="#content">Skip to content</a>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="/" rel="home">Rivka Lipkovitz</a>
        <nav class="main-nav" aria-label="Primary navigation">
          <a href="/blog/">Blog</a>
          <button class="icon-button" id="search-open" type="button" aria-label="Search">${SEARCH_ICON}</button>
          <button class="icon-button" id="theme-toggle" type="button" aria-label="Switch color theme">${PALETTE_ICON}</button>
        </nav>
      </div>
    </header>`;
}

function footer() {
  return `
    <footer class="site-footer">
      <div class="footer-inner">
        <p>© ${new Date().getUTCFullYear()} Rivka Lipkovitz</p>
      </div>
    </footer>
    <dialog class="search-dialog" id="search-dialog" aria-labelledby="search-heading">
      <form method="dialog" class="search-bar">
        <label id="search-heading" for="search-input">Search Rivka’s writing</label>
        <button class="icon-button" value="cancel" aria-label="Close search">${CLOSE_ICON}</button>
      </form>
      <input id="search-input" type="search" autocomplete="off" enterkeyhint="search" placeholder="Try “causal inference”" />
      <div id="search-results" class="search-results" aria-live="polite"></div>
    </dialog>`;
}

function layout({ route, title, description, body, image = "", type = "website", published = "", modified = "", extraHead = "", bodyClass = "", preload = "" }) {
  const pageTitle = route === "/" ? "Rivka Lipkovitz" : `${title} — Rivka Lipkovitz`;
  const pageUrl = canonical(route);
  const socialImage = canonical(mediaHref(image || DEFAULT_SOCIAL));
  const articleMeta = type === "article" ? `
  <meta property="article:published_time" content="${escapeHtml(published)}">
  <meta property="article:modified_time" content="${escapeHtml(modified || published)}">` : "";
  return `<!doctype html>
<html lang="en" class="no-js">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#121212" media="(prefers-color-scheme: dark)">
  <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
  <link rel="canonical" href="${pageUrl}">
  <link rel="icon" href="/assets/icon.png" sizes="any">
  <link rel="preload" href="/assets/fonts/albert-sans-latin.woff2" as="font" type="font/woff2" crossorigin>
  ${preload}
  <style>${STYLES_CSS}</style>
  <link rel="alternate" type="application/rss+xml" title="Rivka Lipkovitz" href="/feed.xml">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="Rivka Lipkovitz">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:image" content="${socialImage}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${socialImage}">${articleMeta}
  <script>document.documentElement.classList.replace("no-js","js");try{document.documentElement.dataset.theme=localStorage.getItem("theme")||"dark"}catch(e){document.documentElement.dataset.theme="dark"}</script>
  ${extraHead}
</head>
<body class="${escapeHtml(bodyClass)}">
  ${header()}
  <main id="content">${body}</main>
  ${footer()}
  <script src="${SCRIPT_HREF}" defer></script>
</body>
</html>`;
}

function categoryLinks(post) {
  return recordCategories(post).map((category) => `<a href="/blog/?category=${encodeURIComponent(category.slug)}">${escapeHtml(categoryLabel(category))}</a>`).join(", ");
}

function postCard(post, { priority = false, hidden = false } = {}) {
  const image = featuredImage(post);
  const record = mediaRecord(image);
  const src = smallestSrc(record, image);
  const categorySlugs = recordCategories(post).map((category) => category.slug).join(" ");
  const loading = priority
    ? 'loading="eager" fetchpriority="high" decoding="async"'
    : 'loading="lazy" decoding="async"';
  const dims = record?.width && record?.height ? ` width="${record.width}" height="${record.height}"` : "";
  const sizes = ' sizes="(max-width: 820px) calc(100vw - 30px), 820px"';
  const srcset = record?.srcset ? ` srcset="${escapeHtml(record.srcset)}"` : "";
  return `<article class="post-card"${hidden ? " hidden" : ""} data-categories="${escapeHtml(categorySlugs)}">
    ${image ? `<a class="post-card-image" href="/${post.slug}/" tabindex="-1" aria-hidden="true"><img src="${escapeHtml(src)}" alt="" ${loading}${dims}${srcset}${sizes}></a>` : ""}
    <div class="post-card-body">
      <h2><a href="/${post.slug}/">${escapeHtml(titleOf(post))}</a></h2>
      <p class="post-meta">${postMeta(post)}</p>
      <p>${escapeHtml(descriptionOf(post, 45))}</p>
      <a class="read-more" href="/${post.slug}/">Read more <span class="screen-reader-text">about ${escapeHtml(titleOf(post))}</span> <span aria-hidden="true">→</span></a>
    </div>
  </article>`;
}

function archiveBody(title, posts) {
  return `<section class="archive-shell">
    <header class="archive-header"><h1>${escapeHtml(title)}</h1></header>
    <div class="post-list">${posts.map((post, index) => postCard(post, { priority: index === 0 })).join("\n") || "<p>No posts yet.</p>"}</div>
  </section>`;
}

function subscribeBlock() {
  return `<section class="subscribe" id="subscribe" aria-label="Subscribe">
    ${SUBSCRIBE_ENDPOINT ? `<form class="subscribe-form" action="${escapeHtml(SUBSCRIBE_ENDPOINT)}" method="post" data-subscribe-form>
      <label class="screen-reader-text" for="subscribe-email">Email address</label>
      <input id="subscribe-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" required>
      <input class="subscribe-trap" name="website" type="text" tabindex="-1" autocomplete="off" aria-label="Company website">
      <button type="submit">Subscribe</button>
      <p class="subscribe-status" data-subscribe-status aria-live="polite"></p>
    </form>` : `<p class="subscribe-status">Subscription setup is being connected.</p>`}
  </section>`;
}

function categoryFilters() {
  const ORDER = ["fencing", "causal-inference", "regeneron-sts", "uncategorized"];
  const chip = (slug, label, count, pressed) =>
    `<button type="button" data-category-filter="${escapeHtml(slug)}" aria-pressed="${pressed}">${escapeHtml(label)} <span>${count}</span></button>`;
  const used = categories
    .filter((category) => allPosts.some((post) => (post.categories || []).includes(category.id)))
    .sort((a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug));
  return [
    chip("all", "All", allPosts.length, "true"),
    ...used.map((category) => chip(
      category.slug,
      categoryLabel(category),
      allPosts.filter((post) => (post.categories || []).includes(category.id)).length,
      "false"
    ))
  ].join("");
}

function blogBody() {
  return `<section class="archive-shell">
    <h1 class="screen-reader-text">Blog</h1>
    <div class="category-filters" role="group" aria-label="Filter by category">${categoryFilters()}</div>
    <div class="post-list" data-infinite-list>${allPosts.map((post, index) => postCard(post, { priority: index === 0, hidden: index >= 8 })).join("\n")}</div>
    <div class="infinite-loader">
      <button class="load-more" type="button" data-load-more>Load more</button>
      <span class="scroll-sentinel" data-scroll-sentinel aria-hidden="true"></span>
    </div>
    ${subscribeBlock()}
  </section>`;
}

function readNext(currentPost) {
  const recent = allPosts.filter((post) => post.id !== currentPost.id).slice(0, 4);
  return `<aside class="read-next" aria-label="More writing">
    <div class="read-next-grid">
      <div>
        <h2>Read next</h2>
        <ul>${recent.map((post) => `<li><a href="/${post.slug}/">${escapeHtml(titleOf(post))}</a></li>`).join("")}</ul>
      </div>
      <div>
        <h2>Categories</h2>
        <ul>${categories.filter((category) => category.count > 0).map((category) => `<li><a href="/blog/?category=${encodeURIComponent(category.slug)}">${escapeHtml(categoryLabel(category))}</a> <span>${allPosts.filter((post) => (post.categories || []).includes(category.id)).length}</span></li>`).join("")}</ul>
      </div>
    </div>
  </aside>`;
}

function postMeta(post) {
  const parts = [
    "by <a href=\"/author/rivka/\" rel=\"author\">Rivka Lipkovitz</a>",
    `<time datetime="${isoDate(post)}">${formatDate(post)}</time>`
  ];
  const inCategories = categoryLinks(post);
  if (inCategories) parts.push(inCategories);
  return parts.join('<span aria-hidden="true"> / </span>');
}

function postBody(post) {
  return `<div class="post-layout">
    <article class="post-article">
      <header class="post-header">
        <h1>${escapeHtml(titleOf(post))}</h1>
        <p class="post-meta">${postMeta(post)}</p>
      </header>
      <div class="prose">${markFirstImagePriority(cleanContent(editedPostContent(post)))}</div>
      <div class="post-end">
        <nav class="back-to-blog"><a href="/blog/">← Back to the blog</a></nav>
        ${subscribeBlock()}
      </div>
    </article>
    ${readNext(post)}
  </div>`;
}

function buildHome() {
  const about = pages.find((page) => page.slug === "about");
  const description = "MIT student studying mathematics, economics, and computer science, with interests in causal inference, econometrics, data science, and fencing.";
  const body = markFirstImagePriority(
    `<section class="home-shell">${cleanContent(about.content.rendered)}</section>`,
    "(max-width: 781px) 100vw, 50vw"
  );
  const extraHead = `<script type="application/ld+json">${jsonLd({
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Rivka Lipkovitz",
    url: SITE_URL,
    image: canonical(featuredImage(about)),
    sameAs: ["https://github.com/rivkalipko", "https://www.linkedin.com/in/rivkalipkovitz/", "https://x.com/rivkalipko"]
  })}</script>`;
  writeRoute("/", layout({
    route: "/",
    title: "Rivka Lipkovitz",
    description,
    body,
    image: featuredImage(about),
    extraHead,
    preload: preloadImageTag(firstImageSrc(body), "(max-width: 781px) 100vw, 50vw"),
    bodyClass: "home-page"
  }));
}

function buildBlog() {
  const route = "/blog/";
  writeRoute(route, layout({
    route,
    title: "Blog",
    description: "Writing by Rivka Lipkovitz on data science, causal inference, learning, and fencing.",
    body: blogBody(),
    preload: preloadImageTag(featuredImage(allPosts[0]), "(max-width: 820px) calc(100vw - 30px), 820px"),
    bodyClass: "archive-page blog-page"
  }));
}

function buildLegacyRedirects() {
  const target = canonical("/blog/");
  const redirect = (route) => writeRoute(route, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0; url=${target}"><link rel="canonical" href="${target}"><title>Writing — Rivka Lipkovitz</title></head><body><p>This archive moved to <a href="${target}">the blog</a>.</p></body></html>`);
  for (let page = 2; page <= Math.ceil(generalPosts.length / 7); page += 1) redirect(`/blog/page/${page}/`);
  redirect("/tag/featured/");
}

function buildPosts() {
  for (const post of allPosts) {
    const route = `/${post.slug}/`;
    const description = descriptionOf(post, 34);
    const body = postBody(post);
    const extraHead = `${hasMath(body) ? MATH_HEAD : ""}<script type="application/ld+json">${jsonLd({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: titleOf(post),
      datePublished: isoDate(post),
      dateModified: new Date(post.modified_gmt || post.modified || post.date_gmt || post.date).toISOString(),
      author: { "@type": "Person", name: "Rivka Lipkovitz", url: SITE_URL },
      mainEntityOfPage: canonical(route),
      image: featuredImage(post) ? canonical(featuredImage(post)) : undefined,
      description
    })}</script>`;
    writeRoute(route, layout({
      route,
      title: titleOf(post),
      description,
      body,
      image: featuredImage(post),
      type: "article",
      published: isoDate(post),
      modified: new Date(post.modified_gmt || post.modified || post.date_gmt || post.date).toISOString(),
      extraHead,
      preload: preloadImageTag(firstImageSrc(body), "(max-width: 820px) 100vw, 820px"),
      bodyClass: "post-page"
    }));
  }
}

function buildTaxonomies() {
  for (const category of categories.filter((item) => item.count > 0)) {
    const posts = allPosts.filter((post) => (post.categories || []).includes(category.id));
    const route = `/${category.slug}/`;
    const body = archiveBody(categoryLabel(category), posts);
    writeRoute(route, layout({ route, title: categoryLabel(category), description: `${categoryLabel(category)} articles by Rivka Lipkovitz.`, body, bodyClass: "archive-page" }));
  }

  const authorRoute = "/author/rivka/";
  writeRoute(authorRoute, layout({
    route: authorRoute,
    title: "Rivka Lipkovitz",
    description: "All writing by Rivka Lipkovitz.",
    body: archiveBody("Rivka Lipkovitz", allPosts),
    bodyClass: "archive-page"
  }));
}

function buildPages() {
  const campaign = pages.find((page) => page.slug === "prez");
  if (campaign) {
    const route = "/prez/";
    const body = `<article class="standalone-page"><header><p class="eyebrow">MIT Undergraduate Association</p><h1>${escapeHtml(titleOf(campaign))}</h1></header><div class="prose">${cleanContent(campaign.content.rendered)}</div></article>`;
    writeRoute(route, layout({ route, title: titleOf(campaign), description: descriptionOf(campaign, 34), body, bodyClass: "standalone" }));
  }
}

function buildGlossary() {
  for (const entry of glossary) {
    const route = `/glossary/${entry.slug}/`;
    const description = truncateWords(stripHtml(entry.description), 30);
    const descriptionHtml = applyValidatedReplacements(entry.description, GLOSSARY_EDITS.filter((edit) => edit.slug === entry.slug).flatMap((edit) => edit.replacements), `glossary:${entry.slug}`);
    const body = `<article class="glossary-page"><p class="eyebrow">Glossary</p><h1>${escapeHtml(entry.title)}</h1><div class="prose">${cleanContent(descriptionHtml)}</div><p><a href="/blog/">Browse the blog →</a></p></article>`;
    writeRoute(route, layout({ route, title: entry.title, description, body, bodyClass: "standalone" }));
  }
}

function buildFeeds() {
  const items = allPosts.map((post) => `
    <item>
      <title>${escapeHtml(titleOf(post))}</title>
      <link>${canonical(`/${post.slug}/`)}</link>
      <guid>${canonical(`/${post.slug}/`)}</guid>
      <pubDate>${new Date(post.date_gmt || post.date).toUTCString()}</pubDate>
      <description>${escapeHtml(descriptionOf(post, 60))}</description>
    </item>`).join("");
  fs.writeFileSync(path.join(OUTPUT, "feed.xml"), `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"><channel><title>Rivka Lipkovitz</title><link>${SITE_URL}/blog/</link><description>Writing on data, causal inference, learning, and fencing.</description>${items}</channel></rss>\n`);

  const routes = [
    "/", "/blog/", "/prez/", "/author/rivka/",
    ...allPosts.map((post) => `/${post.slug}/`),
    ...categories.filter((category) => category.count > 0).map((category) => `/${category.slug}/`),
    ...glossary.map((entry) => `/glossary/${entry.slug}/`)
  ];
  fs.writeFileSync(path.join(OUTPUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...new Set(routes)].map((route) => `<url><loc>${canonical(route)}</loc></url>`).join("")}</urlset>\n`);
  fs.writeFileSync(path.join(OUTPUT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
}

function buildSearch() {
  const records = allPosts.map((post) => ({
    title: titleOf(post),
    url: `/${post.slug}/`,
    date: formatDate(post),
    categories: recordCategories(post).map((category) => category.name),
    excerpt: descriptionOf(post, 38),
    text: truncateWords(stripHtml(editedPostContent(post)), 220)
  }));
  fs.writeFileSync(path.join(OUTPUT, "search.json"), JSON.stringify(records));
}

function buildNotFound() {
  const body = `<section class="not-found"><p class="eyebrow">404</p><h1>Page not found</h1><p>This page may have moved or never existed.</p><p><a class="button" href="/">Home</a> <a class="button secondary" href="/blog/">Blog</a></p></section>`;
  fs.writeFileSync(path.join(OUTPUT, "404.html"), layout({ route: "/404.html", title: "Page not found", description: "Page not found.", body, bodyClass: "standalone" }));
}

function collectMedia() {
  const media = new Map();
  const values = [
    ...allPosts.flatMap((post) => [post.content.rendered, post.excerpt.rendered, post._embedded?.["wp:featuredmedia"]?.[0]?.source_url || ""]),
    ...pages.flatMap((page) => [page.content.rendered, page._embedded?.["wp:featuredmedia"]?.[0]?.source_url || ""]),
    ...glossary.map((entry) => entry.description),
    "https://rivka.me/wp-content/uploads/2024/05/cropped-android-chrome-512x512-1.png"
  ];
  const matcher = /https?:\/\/(?:i\d\.wp\.com\/rivka\.me|rivka\.me)\/wp-content\/uploads\/[^?"'<>\s]+(?:\?[^"'<>\s]*)?/gi;
  for (const value of values) {
    for (const match of String(value).matchAll(matcher)) {
      const info = mediaInfo(match[0]);
      if (info) media.set(info.relative, info);
    }
  }
  const manifest = [...media.values()].sort((a, b) => a.relative.localeCompare(b.relative));
  fs.writeFileSync(path.join(SOURCE, "media-manifest.tsv"), manifest.map((item) => `${item.source}\t${item.relative}`).join("\n") + "\n");
  return manifest;
}

function copyStatic() {
  ensureDir(path.join(OUTPUT, "assets"));
  fs.writeFileSync(path.join(OUTPUT, "assets", "styles.css"), minifyCss(fs.readFileSync(path.join(ROOT, "src", "static", "styles.css"), "utf8")));
  fs.copyFileSync(path.join(ROOT, "src", "static", "site.js"), path.join(OUTPUT, "assets", "site.js"));
  const fonts = path.join(ROOT, "src", "static", "fonts");
  if (fs.existsSync(fonts)) fs.cpSync(fonts, path.join(OUTPUT, "assets", "fonts"), { recursive: true });
  const katex = path.join(ROOT, "src", "vendor", "katex");
  if (fs.existsSync(katex)) {
    fs.cpSync(katex, path.join(OUTPUT, "assets", "katex"), { recursive: true });
    const katexCss = path.join(OUTPUT, "assets", "katex", "katex.min.css");
    if (fs.existsSync(katexCss)) {
      fs.writeFileSync(katexCss, fs.readFileSync(katexCss, "utf8")
        .replace(/,url\(fonts\/[^)]+\.woff\) format\("woff"\)/g, "")
        .replace(/,url\(fonts\/[^)]+\.ttf\) format\("truetype"\)/g, ""));
    }
  }
  if (fs.existsSync(MEDIA_SOURCE)) fs.cpSync(MEDIA_SOURCE, path.join(OUTPUT, "assets", "media"), { recursive: true });
  const icon = path.join(MEDIA_SOURCE, "2024", "05", "cropped-android-chrome-512x512-1.png");
  if (fs.existsSync(icon)) fs.copyFileSync(icon, path.join(OUTPUT, "assets", "icon.png"));
  fs.writeFileSync(path.join(OUTPUT, "CNAME"), `${new URL(SITE_URL).hostname}\n`);
  fs.writeFileSync(path.join(OUTPUT, ".nojekyll"), "");
}

fs.rmSync(OUTPUT, { recursive: true, force: true });
ensureDir(OUTPUT);
const mediaManifest = collectMedia();
copyStatic();
const convertedImages = optimizeCopiedMedia();
buildHome();
buildBlog();
buildLegacyRedirects();
buildPosts();
buildTaxonomies();
buildPages();
buildGlossary();
buildFeeds();
buildSearch();
buildNotFound();

const missingMedia = mediaManifest.filter((item) => !fs.existsSync(path.join(MEDIA_SOURCE, item.relative)));
console.log(`Built ${allPosts.length} posts, ${glossary.length} glossary entries, and ${categories.filter((category) => category.count > 0).length} category archives.`);
console.log(`${mediaManifest.length - missingMedia.length}/${mediaManifest.length} local media files present.`);
console.log(`Wrote ${convertedImages} WebP derivatives.`);
if (missingMedia.length) console.log(`Run the media download step; ${missingMedia.length} files are still missing.`);
