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
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.4/dist/katex.min.css" integrity="sha384-u1zONI5gPXUx0UKI62c75/zww972y0v2rSK5ZYlVdS6xEuWDeZWUI66v6t1gvlXJ" crossorigin="anonymous">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.18.4/dist/katex.min.js" integrity="sha384-ykMNcWQhhTUb0YV9SPpPUFURHZ+tWmubkakGBP+OgNK/UXdO2gtzglWx0Rj9hnO3" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.18.4/dist/contrib/auto-render.min.js" integrity="sha384-bjyGPfbij8/NDKJhSGZNP/khQVgtHUE5exjm4Ydllo42FwIgYsdLO2lXGmRBf5Mz" crossorigin="anonymous"></script>`;
const SUBSCRIBE_ENDPOINT = process.env.SUBSCRIBE_ENDPOINT || "";

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
    output = output.replace(/<img/i, `<img src="${escapeHtml(localizeUrl(chosenSource))}"`);
  }
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

function cleanContent(value = "") {
  return value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<img\b[^>]*>/gi, cleanImageTag)
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
    .trim();
}

function featuredImage(record) {
  const raw = record?._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
  return raw ? localizeUrl(raw) : "";
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
    <dialog class="search-dialog" id="search-dialog">
      <form method="dialog" class="search-bar">
        <label for="search-input">Search Rivka’s writing</label>
        <button class="icon-button" value="cancel" aria-label="Close search">${CLOSE_ICON}</button>
      </form>
      <input id="search-input" type="search" autocomplete="off" placeholder="Try “causal inference”" />
      <div id="search-results" class="search-results" aria-live="polite"></div>
    </dialog>`;
}

function layout({ route, title, description, body, image = "", type = "website", published = "", modified = "", extraHead = "", bodyClass = "" }) {
  const pageTitle = route === "/" ? "Rivka Lipkovitz" : `${title} — Rivka Lipkovitz`;
  const pageUrl = canonical(route);
  const socialImage = image ? canonical(image) : canonical("/assets/media/2025/06/20250306_-Lipkovitz_Rivka_CasualPortraits_0005_KR-scaled.jpg");
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
  <meta name="theme-color" content="#121212">
  <link rel="canonical" href="${pageUrl}">
  <link rel="icon" href="/assets/icon.png" sizes="any">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;650;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/styles.css">
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
  <script>document.documentElement.classList.replace("no-js","js");document.documentElement.dataset.theme=localStorage.getItem("theme")||"dark"</script>
  ${extraHead}
</head>
<body class="${escapeHtml(bodyClass)}">
  ${header()}
  <main id="content">${body}</main>
  ${footer()}
  <script src="/assets/site.js" defer></script>
</body>
</html>`;
}

function categoryLinks(post) {
  return recordCategories(post).map((category) => `<a href="/blog/?category=${encodeURIComponent(category.slug)}">${escapeHtml(categoryLabel(category))}</a>`).join(", ");
}

function postCard(post) {
  const image = featuredImage(post);
  const categorySlugs = recordCategories(post).map((category) => category.slug).join(" ");
  return `<article class="post-card" data-categories="${escapeHtml(categorySlugs)}">
    ${image ? `<a class="post-card-image" href="/${post.slug}/" tabindex="-1" aria-hidden="true"><img src="${escapeHtml(image)}" alt="" loading="lazy"></a>` : ""}
    <div class="post-card-body">
      <h2><a href="/${post.slug}/">${escapeHtml(titleOf(post))}</a></h2>
      <p class="post-meta">${postMeta(post)}</p>
      <p>${escapeHtml(descriptionOf(post, 45))}</p>
      <a class="read-more" href="/${post.slug}/">Read more <span aria-hidden="true">→</span></a>
    </div>
  </article>`;
}

function archiveBody(title, posts) {
  return `<section class="archive-shell">
    <header class="archive-header"><h1>${escapeHtml(title)}</h1></header>
    <div class="post-list">${posts.map(postCard).join("\n") || "<p>No posts yet.</p>"}</div>
  </section>`;
}

function subscribeBlock() {
  return `<section class="subscribe" id="subscribe" aria-labelledby="subscribe-title">
    <h2 id="subscribe-title">Subscribe</h2>
    <p>Get an email when I publish something new. Nothing else, ever.</p>
    ${SUBSCRIBE_ENDPOINT ? `<form class="subscribe-form" action="${escapeHtml(SUBSCRIBE_ENDPOINT)}" method="post" data-subscribe-form>
      <label class="screen-reader-text" for="subscribe-email">Email address</label>
      <input id="subscribe-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" required>
      <input class="subscribe-trap" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
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
    <div class="post-list" data-infinite-list>${allPosts.map(postCard).join("\n")}</div>
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
      <div class="prose">${cleanContent(editedPostContent(post))}</div>
      <nav class="back-to-blog"><a href="/blog/">← Back to the blog</a></nav>
      ${subscribeBlock()}
    </article>
    ${readNext(post)}
  </div>`;
}

function buildHome() {
  const about = pages.find((page) => page.slug === "about");
  const description = "MIT student studying mathematics, economics, and computer science, with interests in causal inference, econometrics, data science, and fencing.";
  const body = `<section class="home-shell">${cleanContent(about.content.rendered)}</section>`;
  const extraHead = `<script type="application/ld+json">${jsonLd({
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Rivka Lipkovitz",
    url: SITE_URL,
    image: canonical(featuredImage(about)),
    sameAs: ["https://github.com/rivkalipko", "https://www.linkedin.com/in/rivkalipkovitz/", "https://x.com/rivkalipko"]
  })}</script>`;
  writeRoute("/", layout({ route: "/", title: "Rivka Lipkovitz", description, body, image: featuredImage(about), extraHead, bodyClass: "home-page" }));
}

function buildBlog() {
  const route = "/blog/";
  writeRoute(route, layout({
    route,
    title: "Blog",
    description: "Writing by Rivka Lipkovitz on data science, causal inference, learning, and fencing.",
    body: blogBody(),
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
  fs.copyFileSync(path.join(ROOT, "src", "static", "styles.css"), path.join(OUTPUT, "assets", "styles.css"));
  fs.copyFileSync(path.join(ROOT, "src", "static", "site.js"), path.join(OUTPUT, "assets", "site.js"));
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
if (missingMedia.length) console.log(`Run the media download step; ${missingMedia.length} files are still missing.`);
