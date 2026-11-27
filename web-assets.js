import { readFileSync } from "node:fs";

const javascript = "text/javascript; charset=utf-8";
const png = "image/png";
const sources = [
  ["/crew.css", "crew.css", "text/css; charset=utf-8"],
  ["/dialogs.js", "dialogs.js", javascript],
  ["/pwa.js", "public/pwa.js", javascript],
  ["/service-worker.js", "public/service-worker.js", javascript],
  ["/manifest.webmanifest", "public/manifest.webmanifest", "application/manifest+json; charset=utf-8"],
  ["/icon.svg", "public/icon.svg", "image/svg+xml"],
  ["/icon-180.png", "public/icon-180.png", png],
  ["/icon-192.png", "public/icon-192.png", png],
  ["/icon-512.png", "public/icon-512.png", png],
  ["/icon-maskable-512.png", "public/icon-maskable-512.png", png],
];
const assets = new Map(sources.map(([path, filename, type]) => [path, {
  body: readFileSync(new URL(filename, import.meta.url)), type,
}]));

export function sendAsset(req, res, path) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const asset = assets.get(path);
  if (!asset) return false;
  if (path === "/service-worker.js") res.setHeader("Content-Security-Policy", "default-src 'none'; connect-src 'self'");
  res.writeHead(200, { "Content-Type": asset.type, "Content-Length": asset.body.length });
  res.end(req.method === "HEAD" ? undefined : asset.body);
  return true;
}
