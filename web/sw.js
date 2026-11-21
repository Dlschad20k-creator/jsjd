/* AURA KINO – Service Worker: App-Hülle offline, Cover aus dem Cache, Daten zuerst live.
 * Funktioniert auf der Box (Pfad "/") und auf GitHub Pages (Pfad "/jsjd/"). */
const VERSION = "aura-v2";
const SHELL = `${VERSION}-shell`;
const IMG = "aura-img";
const DATA = "aura-data";
const IMG_MAX = 2500;
const BASE = new URL(self.registration.scope).pathname;   // "/" oder "/jsjd/"

const SHELL_FILES = [
  "./", "static/app.css", "static/app.js", "static/local.js", "manifest.json",
  "static/fonts/inter-latin-wght-normal.woff2", "static/fonts/inter-latin-ext-wght-normal.woff2",
  "static/icons/icon-192.png", "static/icons/apple-touch-icon.png", "static/icons/tmdb.svg", "static/icons/favicon-32.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k.endsWith("-shell") && k !== SHELL) await caches.delete(k);
      if (k === "aura-api") await caches.delete(k); // alter Name aus v1
    }
    await self.clients.claim();
  })());
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

// Bilder: zuerst Cache, sonst Netz (und merken)
async function imageFirst(req, cors) {
  const c = await caches.open(IMG);
  const hit = await c.match(req.url);
  if (hit) return hit;
  try {
    const res = cors ? await fetch(req.url, { mode: "cors", credentials: "omit" }) : await fetch(req);
    if (res.ok) {
      c.put(req.url, res.clone());
      if (Math.random() < 0.05) trim(IMG, IMG_MAX);
    }
    return res;
  } catch (e) {
    return new Response("", { status: 504 });
  }
}

// Daten (API/Katalog): zuerst live, offline die zuletzt gesehene Antwort
async function networkFirst(req) {
  const c = await caches.open(DATA);
  try {
    const res = await fetch(req);
    if (res.ok) c.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await c.match(req, { ignoreSearch: false });
    if (hit) return hit;
    return new Response(JSON.stringify({ error: "Offline – diese Seite wurde noch nicht geladen." }), {
      status: 503, headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}

// App-Dateien: Cache sofort liefern, im Hintergrund aktualisieren
async function staleWhileRevalidate(req) {
  const c = await caches.open(SHELL);
  const hit = await c.match(req, { ignoreSearch: true });
  const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || new Response("Offline", { status: 503 });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === "https://image.tmdb.org") { e.respondWith(imageFirst(req, true)); return; }
  if (url.origin !== location.origin) return;              // GitHub-API, YouTube … nie anfassen

  const rel = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) : url.pathname.replace(/^\//, "");
  if (rel.startsWith("img/") || rel.startsWith("uploads/")) { e.respondWith(imageFirst(req, false)); return; }
  if (rel.startsWith("api/")) {
    if (/^api\/(auth|export|update|tmdb)/.test(rel)) return;  // nie cachen
    e.respondWith(networkFirst(req));
    return;
  }
  if (rel.startsWith("data/")) { e.respondWith(networkFirst(req)); return; }
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put("./", copy)); } return res; })
      .catch(async () => (await caches.match("./")) || (await caches.match(BASE)) || new Response("Offline", { status: 503 })));
    return;
  }
  if (rel.startsWith("static/") || rel === "manifest.json") { e.respondWith(staleWhileRevalidate(req)); return; }
});
