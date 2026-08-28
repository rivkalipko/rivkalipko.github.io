import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "_site");
const PORT = Number(process.env.PORT || 4173);
const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8"
};

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const safe = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
  let file = path.resolve(path.join(ROOT, safe));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return "";
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  else if (!fs.existsSync(file) && !path.extname(file)) {
    const nested = path.join(file, "index.html");
    if (fs.existsSync(nested)) file = nested;
  }
  return file;
}

http.createServer((req, res) => {
  const file = resolveFile(new URL(req.url, "http://127.0.0.1").pathname);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext] || "application/octet-stream";
  const compressible = /^(text\/|application\/(javascript|json|xml))/.test(type);
  const cache = ext === ".html" || ext === ".xml" || ext === ".json" || ext === ".txt"
    ? "no-cache"
    : "public, max-age=31536000, immutable";
  const headers = { "Content-Type": type, "Cache-Control": cache, Vary: "Accept-Encoding" };
  const body = fs.readFileSync(file);
  const accept = req.headers["accept-encoding"] || "";
  if (compressible && /\bbr\b/.test(accept)) {
    headers["Content-Encoding"] = "br";
    res.writeHead(200, headers);
    res.end(zlib.brotliCompressSync(body));
    return;
  }
  if (compressible && /\bgzip\b/.test(accept)) {
    headers["Content-Encoding"] = "gzip";
    res.writeHead(200, headers);
    res.end(zlib.gzipSync(body));
    return;
  }
  res.writeHead(200, headers);
  res.end(body);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Preview http://127.0.0.1:${PORT}/`);
});
