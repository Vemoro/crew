const offlinePage = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Verbindung fehlt · Crew</title></head><body><main>
<h1>Verbindung fehlt</h1><p>Verbinde dich mit dem Internet oder deinem Firmennetz, um Crew zu öffnen.</p>
<p><a href="/">Crew erneut öffnen</a></p></main></body></html>`;

const worker = globalThis as unknown as ServiceWorkerGlobalScope;
worker.addEventListener("install", event => event.waitUntil(worker.skipWaiting()));
worker.addEventListener("activate", event => event.waitUntil(worker.clients.claim()));

worker.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET" || request.mode !== "navigate" || new URL(request.url).origin !== worker.location.origin) return;
  event.respondWith(fetch(request).catch(() => new Response(offlinePage, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    },
  })));
});
