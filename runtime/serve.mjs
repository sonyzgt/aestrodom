// Minimal static file server for a built PRISMATIC project (SPA fallback to index.html).
// Reads from disk on every request so a rebuilt site is served immediately.
import http from "node:http";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.env.SITE_DIR || "/srv/prismatic/site");
const PORT = Number(process.env.PORT || 3000);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
};

function fileFor(urlPath) {
  let rel;
  try {
    rel = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  const abs = path.resolve(ROOT, "." + rel);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
  try {
    const st = statSync(abs);
    if (st.isFile()) return abs;
    if (st.isDirectory()) {
      const idx = path.join(abs, "index.html");
      if (statSync(idx).isFile()) return idx;
    }
  } catch {}
  return null;
}

http
  .createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end();
      return;
    }
    if (req.url === "/__prismatic/health") {
      res.writeHead(200, { "content-type": "text/plain" }).end("ok");
      return;
    }
    let file = fileFor(req.url || "/");
    const ext = file ? path.extname(file) : "";
    if (!file && !path.extname((req.url || "/").split("?")[0])) file = fileFor("/index.html");
    if (!file) {
      res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
      return;
    }
    const type = TYPES[path.extname(file)] || "application/octet-stream";
    const immutable = file.includes(`${path.sep}assets${path.sep}`) && ext !== ".html";
    res.writeHead(200, {
      // Previews run in a sandboxed iframe (opaque "null" origin), and Vite emits
      // <script type="module" crossorigin>, so assets are fetched in CORS mode.
      // These are the project's own public static files, so any origin may read them.
      "access-control-allow-origin": "*",
      "content-type": type,
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    });
    if (req.method === "HEAD") return res.end();
    createReadStream(file).pipe(res);
  })
  .listen(PORT, "0.0.0.0");
