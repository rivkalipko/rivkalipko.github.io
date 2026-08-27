import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const tags = readJson("tags.json");
const glossary = fs.existsSync(path.join(SOURCE, "glossary.json")) ? readJson("glossary.json") : [];

const uniquePosts = new Map();
for (const post of [...generalPosts, ...stsPosts]) uniquePosts.set(post.id, post);
const allPosts = [...uniquePosts.values()].sort((a, b) => new Date(b.date_gmt || b.date) - new Date(a.date_gmt || a.date));
const categoryById = new Map(categories.map((category) => [category.id, category]));
const tagById = new Map(tags.map((tag) => [tag.id, tag]));

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
    .trim();
}

function featuredImage(record) {
  const raw = record?._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
  return raw ? localizeUrl(raw) : "";
}

function recordCategories(post) {
  return (post.categories || []).map((id) => categoryById.get(id)).filter(Boolean);
}

function recordTags(post) {
  return (post.tags || []).map((id) => tagById.get(id)).filter(Boolean);
}

function formatDate(post) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(post.date_gmt || post.date));
}

function isoDate(post) {
  return new Date(post.date_gmt || post.date).toISOString();
}

function descriptionOf(record, maximum = 36) {
  return truncateWords(stripHtml(record?.excerpt?.rendered || record?.content?.rendered || ""), maximum);
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
        <p><a href="/feed.xml">RSS</a><span aria-hidden="true"> · </span><a href="https://github.com/rivkalipko">GitHub</a></p>
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
<html lang="en">
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
  <script>document.documentElement.dataset.theme=localStorage.getItem("theme")||"dark"</script>
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
  return recordCategories(post).map((category) => `<a href="/${category.slug}/">${escapeHtml(category.name)}</a>`).join(", ");
}

function postCard(post) {
  const image = featuredImage(post);
  return `<article class="post-card">
    ${image ? `<a class="post-card-image" href="/${post.slug}/" tabindex="-1" aria-hidden="true"><img src="${escapeHtml(image)}" alt="" loading="lazy"></a>` : ""}
    <div class="post-card-body">
      <h2><a href="/${post.slug}/">${escapeHtml(titleOf(post))}</a></h2>
      <p class="post-meta">${postMeta(post)}</p>
      <p>${escapeHtml(descriptionOf(post, 45))}</p>
      <a class="read-more" href="/${post.slug}/">Read more <span aria-hidden="true">→</span></a>
    </div>
  </article>`;
}

function pagination(current, pageCount, base = "/blog/") {
  if (pageCount <= 1) return "";
  const href = (page) => page === 1 ? base : `${base}page/${page}/`;
  const items = Array.from({ length: pageCount }, (_, index) => index + 1).map((page) =>
    page === current ? `<span aria-current="page">${page}</span>` : `<a href="${href(page)}">${page}</a>`
  ).join("");
  return `<nav class="pagination" aria-label="Archive pages">
    ${current > 1 ? `<a class="pagination-wide" href="${href(current - 1)}">← Previous</a>` : "<span></span>"}
    <div>${items}</div>
    ${current < pageCount ? `<a class="pagination-wide" href="${href(current + 1)}">Next →</a>` : "<span></span>"}
  </nav>`;
}

function archiveBody(title, intro, posts, options = {}) {
  return `<section class="archive-shell">
    <header class="archive-header">
      <p class="eyebrow">${escapeHtml(options.eyebrow || "Writing")}</p>
      <h1>${escapeHtml(title)}</h1>
      ${intro ? `<p>${escapeHtml(intro)}</p>` : ""}
    </header>
    <div class="post-list">${posts.map(postCard).join("\n") || "<p>No posts yet.</p>"}</div>
  </section>`;
}

function readNext(currentPost) {
  const recent = generalPosts.filter((post) => post.id !== currentPost.id).slice(0, 4);
  return `<aside class="read-next" aria-label="More writing">
    <div class="read-next-grid">
      <div>
        <h2>Read next</h2>
        <ul>${recent.map((post) => `<li><a href="/${post.slug}/">${escapeHtml(titleOf(post))}</a></li>`).join("")}</ul>
      </div>
      <div>
        <h2>Categories</h2>
        <ul>${categories.filter((category) => category.count > 0).map((category) => `<li><a href="/${category.slug}/">${escapeHtml(category.name)}</a> <span>${category.count}</span></li>`).join("")}</ul>
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
  const tagsForPost = recordTags(post);
  return `<div class="post-layout">
    <article class="post-article">
      <header class="post-header">
        <h1>${escapeHtml(titleOf(post))}</h1>
        <p class="post-meta">${postMeta(post)}</p>
      </header>
      <div class="prose">${cleanContent(post.content.rendered)}</div>
      ${tagsForPost.length ? `<footer class="post-tags">${tagsForPost.map((tag) => `<a href="/tag/${tag.slug}/">#${escapeHtml(tag.name)}</a>`).join(" ")}</footer>` : ""}
      <nav class="back-to-blog"><a href="/blog/">← Back to the blog</a></nav>
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
  const pageSize = 7;
  const pageCount = Math.ceil(generalPosts.length / pageSize);
  for (let page = 1; page <= pageCount; page += 1) {
    const posts = generalPosts.slice((page - 1) * pageSize, page * pageSize);
    const route = page === 1 ? "/blog/" : `/blog/page/${page}/`;
    const title = page === 1 ? "Blog" : `Blog — Page ${page}`;
    const body = `${archiveBody("Blog", "Notes on data, causal inference, learning, and fencing.", posts)}${pagination(page, pageCount)}`;
    writeRoute(route, layout({ route, title, description: "Writing by Rivka Lipkovitz on data science, causal inference, learning, and fencing.", body, bodyClass: "archive-page" }));
  }
}

function buildPosts() {
  for (const post of allPosts) {
    const route = `/${post.slug}/`;
    const description = descriptionOf(post, 34);
    const body = postBody(post);
    const extraHead = `<script type="application/ld+json">${jsonLd({
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
    const body = archiveBody(category.name, `${posts.length} article${posts.length === 1 ? "" : "s"} filed here.`, posts, { eyebrow: "Category" });
    writeRoute(route, layout({ route, title: category.name, description: `${category.name} articles by Rivka Lipkovitz.`, body, bodyClass: "archive-page" }));
  }
  for (const tag of tags.filter((item) => item.count > 0)) {
    const posts = allPosts.filter((post) => (post.tags || []).includes(tag.id));
    const route = `/tag/${tag.slug}/`;
    const body = archiveBody(`#${tag.name}`, `${posts.length} featured article${posts.length === 1 ? "" : "s"}.`, posts, { eyebrow: "Tag" });
    writeRoute(route, layout({ route, title: `#${tag.name}`, description: `Featured writing by Rivka Lipkovitz.`, body, bodyClass: "archive-page" }));
  }

  const authorRoute = "/author/rivka/";
  writeRoute(authorRoute, layout({
    route: authorRoute,
    title: "Rivka Lipkovitz",
    description: "All writing by Rivka Lipkovitz.",
    body: archiveBody("Rivka Lipkovitz", `${allPosts.length} published articles.`, allPosts, { eyebrow: "Author" }),
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
    const body = `<article class="glossary-page"><p class="eyebrow">Glossary</p><h1>${escapeHtml(entry.title)}</h1><div class="prose">${cleanContent(entry.description)}</div><p><a href="/blog/">Browse the blog →</a></p></article>`;
    writeRoute(route, layout({ route, title: entry.title, description, body, bodyClass: "standalone" }));
  }
}

function buildFeeds() {
  const items = generalPosts.map((post) => `
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
    ...generalPosts.slice(7).map((_, index) => index).filter((index) => index % 7 === 0).map((index) => `/blog/page/${Math.floor(index / 7) + 2}/`),
    ...allPosts.map((post) => `/${post.slug}/`),
    ...categories.filter((category) => category.count > 0).map((category) => `/${category.slug}/`),
    ...tags.filter((tag) => tag.count > 0).map((tag) => `/tag/${tag.slug}/`),
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
    text: truncateWords(stripHtml(post.content.rendered), 220)
  }));
  fs.writeFileSync(path.join(OUTPUT, "search.json"), JSON.stringify(records));
}

function buildNotFound() {
  const body = `<section class="not-found"><p class="eyebrow">404</p><h1>That page isn’t here.</h1><p>The address may have changed, or the page may have moved.</p><p><a class="button" href="/">Go home</a> <a class="button secondary" href="/blog/">Browse the blog</a></p></section>`;
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
