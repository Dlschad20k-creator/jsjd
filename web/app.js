/* AURA KINO – App (ohne Framework, ohne Build) */
"use strict";

/* ======================================================= Hilfen */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const view = () => $("#view");
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtDate = (iso, opts = { day: "numeric", month: "long", year: "numeric" }) => {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso);
  return isNaN(d) ? iso : d.toLocaleDateString("de-DE", opts);
};
const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
const fmtRuntime = (m) => !m ? "" : m >= 60 ? `${Math.floor(m / 60)} Std. ${m % 60 ? (m % 60) + " Min." : ""}`.trim() : `${m} Min.`;
const num = (x, d = 1) => x == null ? "" : Number(x).toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
const debounce = (fn, ms) => { let t; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; f.flush = (...a) => { clearTimeout(t); fn(...a); }; f.cancel = () => clearTimeout(t); return f; };
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const I = {
  bookmark: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 4h12v17l-6-4-6 4z"/></svg>',
  bookmarkFill: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 4h12v17l-6-4-6 4z"/></svg>',
  check: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  eye: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  play: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
  back: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  chev: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="m9 6 6 6-6 6"/></svg>',
  search: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  filter: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  x: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  plus: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  trash: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"/></svg>',
  ext: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>',
  film: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></svg>',
  sparkle: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></svg>',
  refresh: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
  lock: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  download: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  upload: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V9M7 14l5-5 5 5M5 4h14"/></svg>',
  shield: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>',
  bug: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="7" y="7" width="10" height="13" rx="5"/><path d="M12 11v9M4 13h3M17 13h3M5 7l2.5 2M19 7l-2.5 2M9 4l1.5 2.5M15 4l-1.5 2.5"/></svg>',
};

/* ======================================================= API */
const API = {
  async req(method, path, body) {
    const opts = { method, headers: {}, credentials: "same-origin" };
    if (body !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(path, opts); }
    catch (e) { throw new Error(navigator.onLine ? "Server nicht erreichbar" : "Du bist offline"); }
    if (res.status === 401) { showLock(); throw new Error("PIN erforderlich"); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* leer */ }
    if (!res.ok) throw new Error((data && data.error) || `Fehler ${res.status}`);
    return data;
  },
  get: (p) => API.req("GET", p),
  post: (p, b = {}) => API.req("POST", p, b),
  put: (p, b = {}) => API.req("PUT", p, b),
  del: (p) => API.req("DELETE", p),
};

let META = null;
async function meta(force = false) {
  if (!META || force) META = await API.get("/api/meta");
  return META;
}

/* ======================================================= Toast & Sheet */
function toast(msg, { undo, error = false, ms = 4500 } = {}) {
  const box = $("#toasts");
  while (box.children.length > 2) box.firstChild.remove();
  const el = document.createElement("div");
  el.className = "toast" + (error ? " err" : "");
  el.setAttribute("role", "status");
  el.innerHTML = `<div class="grow">${esc(msg)}</div>${undo ? '<button class="btn" data-undo>Rückgängig</button>' : ""}`;
  box.appendChild(el);
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 220); };
  const t = setTimeout(close, undo ? Math.max(ms, 6000) : ms);
  if (undo) $("[data-undo]", el).onclick = async () => {
    clearTimeout(t); close();
    try { await undo(); toast("Rückgängig gemacht"); } catch (e) { toast(e.message, { error: true }); }
  };
}
const fail = (e) => toast(e.message || String(e), { error: true });

function sheet(html, onMount, onClose) {
  const bg = document.createElement("div");
  bg.className = "sheet-bg";
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  document.body.appendChild(bg);
  document.body.style.overflow = "hidden";
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    bg.remove();
    if (!$(".sheet-bg")) document.body.style.overflow = "";
    window.removeEventListener("hashchange", close);
    document.removeEventListener("keydown", esc_);
    onClose && onClose();
  };
  const esc_ = (e) => { if (e.key === "Escape") close(); };
  bg.addEventListener("click", (e) => { if (e.target === bg || e.target.closest("[data-close]")) close(); });
  window.addEventListener("hashchange", close);
  document.addEventListener("keydown", esc_);
  onMount && onMount($(".sheet", bg), close);
  const first = $("input:not([type=hidden]):not(.sr),textarea,select", bg);
  if (first && matchMedia("(hover: hover)").matches) first.focus();
  return close;
}

function confirmSheet(title, text, okLabel = "Löschen") {
  return new Promise((resolve) => {
    let ok = false;
    sheet(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p>
      <div class="sheet-actions"><button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>${esc(okLabel)}</button></div>`,
      (s, close) => { $("[data-ok]", s).onclick = () => { ok = true; close(); }; },
      () => resolve(ok));
  });
}

/* ======================================================= Bausteine */
function posterHTML(c, cls = "") {
  const ph = `<div class="ph">${esc(c.title)}</div>`;
  const img = c.poster ? `<img src="${esc(c.poster)}" alt="" loading="lazy" decoding="async">` : "";
  return `<div class="poster ${cls}">${ph}${img}</div>`;
}

function cardHTML(c, { meta: m } = {}) {
  const badges = [];
  if (c.wl != null) badges.push(`<span class="badge ${c.wl ? "red" : ""}" title="Gemerkt">${I.bookmarkFill}</span>`);
  if (c.seen) badges.push(`<span class="badge seen" title="Gesehen">${I.check}</span>`);
  if (c.my_rating) badges.push(`<span class="badge" title="Meine Bewertung">★ ${num(c.my_rating, c.my_rating % 1 ? 1 : 0)}</span>`);
  const line = m ?? [c.year, c.vote ? `<span class="vote">★</span> ${num(c.vote)}` : (c.date && c.date > todayISO() ? fmtDate(c.date, { day: "numeric", month: "short" }) : "")]
    .filter(Boolean).join(" · ");
  return `<a class="card" href="#/film/${c.id}">${posterHTML(c)}${badges.length ? `<div class="badges">${badges.join("")}</div>` : ""}
    <div class="card-t">${esc(c.title)}</div><div class="card-m">${line}</div></a>`;
}

function railHTML(row) {
  return `<section class="row"><div class="row-head wrap"><h2>${esc(row.title)}</h2>${row.link ? `<a href="${esc(row.link)}">Alle ${I.chev}</a>` : ""}</div>
    <div class="rail">${row.items.map((c) => cardHTML(c)).join("")}</div></section>`;
}

function emptyHTML(icon, title, text, action = "") {
  return `<div class="empty"><div class="em-ico">${icon}</div><b>${esc(title)}</b><p>${text}</p>${action}</div>`;
}

function footHTML() {
  return `<footer class="foot wrap">
    <a href="https://www.themoviedb.org" target="_blank" rel="noopener"><img src="/static/icons/tmdb.svg" alt="TMDB" width="120" height="14"></a>
    <div>Diese App nutzt die TMDB-API, ist aber nicht von TMDB unterstützt oder zertifiziert.</div>
    <div>Streaming-Daten: JustWatch</div>
  </footer>`;
}

function skeletonRows(n = 3) {
  return Array.from({ length: n }, () => `<section class="row"><div class="wrap"><div class="skel" style="height:22px;width:160px"></div></div>
    <div class="rail" style="margin-top:12px">${Array.from({ length: 6 }, () => '<div><div class="skel" style="aspect-ratio:2/3"></div></div>').join("")}</div></section>`).join("");
}
function skeletonGrid(n = 9) {
  return `<div class="grid">${Array.from({ length: n }, () => '<div><div class="skel" style="aspect-ratio:2/3"></div></div>').join("")}</div>`;
}

function fskHTML(f) {
  if (!f) return "";
  const k = ["0", "6", "12", "16", "18"].includes(f) ? f : "x";
  return `<span class="fsk fsk-${k}" title="FSK ${esc(f)}">${esc(f)}</span>`;
}

// Bilder einblenden / bei Fehler Platzhalter zeigen
document.addEventListener("load", (e) => { if (e.target.tagName === "IMG") e.target.classList.add("ok"); }, true);
document.addEventListener("error", (e) => { if (e.target.tagName === "IMG") e.target.remove(); }, true);

/* ======================================================= Router */
const routes = [];
const route = (rx, fn, tab) => routes.push({ rx, fn, tab });
const scrollMem = new Map();
let currentKey = null;
let renderToken = 0;
let leaveHooks = [];
const onLeave = (fn) => leaveHooks.push(fn);

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  return { path, query: Object.fromEntries(new URLSearchParams(qs || "")), raw };
}

async function render() {
  leaveHooks.forEach((f) => { try { f(); } catch (e) { /* */ } });
  leaveHooks = [];
  if (currentKey) scrollMem.set(currentKey, window.scrollY);
  const { path, query, raw } = parseHash();
  const key = path === "/suche" ? "/suche" : raw;
  // Zurück erkennen: neues Ziel = vorletzter Eintrag im Verlauf
  let back = false;
  if (stack.length > 1 && stack[stack.length - 2] === key) { stack.pop(); back = scrollMem.has(key); }
  else if (stack[stack.length - 1] !== key) stack.push(key);
  if (stack.length > 60) stack.splice(0, stack.length - 60);
  currentKey = key;
  const token = ++renderToken;
  for (const r of routes) {
    const m = path.match(r.rx);
    if (!m) continue;
    $$("nav.tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === r.tab));
    try {
      await r.fn({ params: m.slice(1), query, token, isCurrent: () => token === renderToken });
    } catch (e) {
      if (token !== renderToken) return;
      view().innerHTML = `<div class="page wrap">${emptyHTML(I.film, "Das hat nicht geklappt", esc(e.message), '<button class="btn" onclick="location.reload()">Neu laden</button>')}</div>`;
    }
    if (token === renderToken) window.scrollTo(0, back ? scrollMem.get(key) || 0 : 0);
    return;
  }
  location.hash = "#/";
}
const stack = [];
window.addEventListener("hashchange", render);
const setView = (html) => { view().innerHTML = `<div class="page">${html}</div>`; };
function goBack() {
  const h = location.hash;
  if (stack.length > 1) history.back();
  setTimeout(() => { if (location.hash === h) location.hash = "#/"; }, 350);
}

/* ======================================================= Entdecken */
route(/^\/$/, async ({ isCurrent }) => {
  setView(`<header class="page-head wrap"><div class="brand"><img class="brand-mark" src="/static/icons/icon-192.png" alt=""><span class="brand-name">AURA <b>KINO</b></span></div>
    <a class="icon-btn" href="#/suche" aria-label="Suche">${I.search}</a></header>${skeletonRows(3)}`);
  const data = await API.get("/api/home");
  if (!isCurrent()) return;
  if (!data.rows.length) {
    setView(`<header class="page-head wrap"><div class="brand"><img class="brand-mark" src="/static/icons/icon-192.png" alt=""><span class="brand-name">AURA <b>KINO</b></span></div></header>
      <div class="wrap">${emptyHTML(I.film, "Noch keine Filme", "Der Katalog ist leer. Starte auf der Box den Erst-Import mit <code>python3 kino.py init</code>.")}</div>${footHTML()}`);
    return;
  }
  setView(`<header class="page-head wrap"><div class="brand"><img class="brand-mark" src="/static/icons/icon-192.png" alt=""><span class="brand-name">AURA <b>KINO</b></span></div>
    <a class="icon-btn" href="#/suche" aria-label="Suche">${I.search}</a></header>
    ${data.rows.map(railHTML).join("")}${footHTML()}`);
}, "entdecken");

/* ======================================================= Neu dazugekommen */
route(/^\/neu$/, async ({ isCurrent }) => {
  setView(`<header class="page-head wrap"><div><h1>Neu dazugekommen</h1></div></header><div class="wrap">${skeletonGrid()}</div>`);
  const data = await API.get("/api/new");
  if (!isCurrent()) return;
  const body = data.runs.length ? data.runs.map((r) => `<section class="section wrap"><div class="row-head"><h2>${esc(r.label)}</h2>
      <span class="muted small">${fmtDate(r.date, { day: "numeric", month: "long" })} · ${r.count} Filme</span></div>
      <div class="grid">${r.items.map((c) => cardHTML(c)).join("")}</div></section>`).join("")
    : `<div class="wrap">${emptyHTML(I.sparkle, "Noch nichts Neues", "Nach dem nächsten täglichen Update siehst du hier die neuen Filme.")}</div>`;
  setView(`<header class="page-head wrap"><div><button class="icon-btn" data-back aria-label="Zurück" style="margin-left:-12px">${I.back}</button><h1>Neu dazugekommen</h1>
    <div class="sub">Filme aus den letzten Updates</div></div></header>${body}${footHTML()}`);
  $("[data-back]").onclick = goBack;
}, "entdecken");

/* ======================================================= Suche */
const SORTS = [["", "Beliebt"], ["rating", "Bewertung"], ["new", "Neu"], ["az", "A–Z"]];
route(/^\/suche$/, async ({ query }) => {
  const m = await meta();
  const st = { ...query };
  setView(`<div class="search-bar wrap"><div class="search-box">${I.search}
      <input class="input" id="q" type="search" placeholder="Titel, Schauspieler, Regie …" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search" value="${esc(st.q || "")}">
      <button class="icon-btn" id="flt" aria-label="Filter" style="background:var(--card-2);border-radius:14px;flex:none">${I.filter}</button></div>
      <div class="chips" id="sorts" style="margin-top:10px"></div><div class="chips" id="active" style="margin-top:8px"></div></div>
    <div class="wrap"><div id="count" class="muted small" style="min-height:20px;margin:4px 0 12px"></div><div id="res"></div><div id="more" style="height:1px"></div><div id="tmdb"></div></div>`);
  const qEl = $("#q");
  let offset = 0, total = 0, loading = false, seq = 0;

  const writeHash = () => {
    const p = new URLSearchParams(Object.entries(st).filter(([, v]) => v !== "" && v != null));
    const h = "#/suche" + (p.toString() ? "?" + p : "");
    if (location.hash !== h) history.replaceState(null, "", h);
  };
  const filterLabels = () => {
    const out = [];
    const g = m.genres.find((x) => String(x.id) === st.genre); if (g) out.push(["genre", g.name]);
    if (st.thema !== undefined && m.themes[st.thema]) out.push(["thema", m.themes[st.thema]]);
    if (st.year_from || st.year_to) out.push(["years", `${st.year_from || "…"}–${st.year_to || "…"}`]);
    if (st.rating_min) out.push(["rating_min", `ab ★ ${num(st.rating_min)}`]);
    if (st.fsk) out.push(["fsk", `FSK ${st.fsk.split(",").join("/")}`]);
    if (st.provider) out.push(["provider", st.provider === "mine" ? "Meine Dienste" : (m.providers.find((p) => String(p.id) === st.provider) || {}).name || "Dienst"]);
    if (st.runtime_max) out.push(["runtime_max", `bis ${st.runtime_max} Min.`]);
    return out;
  };
  const drawChips = () => {
    $("#sorts").innerHTML = SORTS.map(([k, l]) => `<button class="chip ${((st.sort || "") === k) ? "on" : ""}" data-sort="${k}">${l}</button>`).join("");
    $("#active").innerHTML = filterLabels().map(([k, l]) => `<button class="chip on" data-rm="${k}">${esc(l)} <span class="x">✕</span></button>`).join("");
    $("#active").style.display = filterLabels().length ? "" : "none";
  };
  const load = async (reset) => {
    if (loading && !reset) return;
    const my = ++seq;
    loading = true;
    if (reset) { offset = 0; $("#res").innerHTML = skeletonGrid(6); $("#tmdb").innerHTML = ""; }
    const p = new URLSearchParams(Object.entries(st).filter(([, v]) => v !== "" && v != null));
    p.set("offset", offset); p.set("limit", 42);
    try {
      const data = await API.get("/api/search?" + p);
      if (my !== seq) return;
      total = data.total;
      const html = data.items.map((c) => cardHTML(c, c.match ? { meta: `${c.year || ""} · ${esc(c.match)}` } : {})).join("");
      if (reset) $("#res").innerHTML = data.items.length ? `<div class="grid">${html}</div>` : "";
      else $(".grid", $("#res")).insertAdjacentHTML("beforeend", html);
      offset += data.items.length;
      $("#count").textContent = total ? `${total.toLocaleString("de-DE")} ${total === 1 ? "Film" : "Filme"} im Katalog` : "";
      if (reset && st.q && st.q.trim().length >= 2 && m.tmdb) {
        if (!total) tmdbSearch(st.q, true);
        else $("#tmdb").innerHTML = `<div style="text-align:center;margin:26px 0"><button class="btn ghost" id="tmdbbtn">${I.search} Auch bei TMDB suchen</button></div>`;
        const b = $("#tmdbbtn"); if (b) b.onclick = () => tmdbSearch(st.q, false);
      }
      if (reset && !total && !(st.q && m.tmdb)) {
        $("#res").innerHTML = emptyHTML(I.search, "Nichts gefunden", st.q ? `Kein Film passt zu „${esc(st.q)}“.` : "Kein Film passt zu diesen Filtern.");
      }
    } catch (e) { if (my === seq) $("#res").innerHTML = emptyHTML(I.search, "Suche fehlgeschlagen", esc(e.message)); }
    finally { if (my === seq) loading = false; }
  };
  const tmdbSearch = async (q, auto) => {
    $("#tmdb").innerHTML = `<div style="display:grid;place-items:center;padding:30px"><div class="spinner"></div></div>`;
    try {
      const d = await API.get("/api/tmdb/search?q=" + encodeURIComponent(q));
      if (st.q !== q) return;
      $("#tmdb").innerHTML = `<div class="section"><div class="row-head"><h2>${auto ? "Nicht im Katalog – bei TMDB gefunden" : "Bei TMDB"}</h2></div>
        ${d.items.length ? `<div class="list">${d.items.map((r) => `<div class="li">
          <div style="width:52px;flex:none">${posterHTML({ title: r.title, poster: r.poster })}</div>
          <div class="grow"><div style="font-weight:600">${esc(r.title)}</div><div class="muted small">${esc(r.year || "?")}${r.vote ? ` · <span class="vote">★</span> ${num(r.vote)}` : ""}</div></div>
          ${r.id ? `<a class="btn sm" href="#/film/${r.id}">Öffnen</a>` : `<button class="btn sm primary" data-add="${r.tmdb_id}">${I.plus} Hinzufügen</button>`}
        </div>`).join("")}</div>` : `<p class="muted">Auch bei TMDB nichts gefunden. <a class="link" href="#/eigener-film">Eigenen Film anlegen</a></p>`}</div>`;
      $$("[data-add]", $("#tmdb")).forEach((b) => b.onclick = async () => {
        b.disabled = true; b.innerHTML = '<div class="spinner"></div>';
        try {
          const r = await API.post("/api/tmdb/add", { tmdb_id: Number(b.dataset.add) });
          toast("Zum Katalog hinzugefügt");
          location.hash = `#/film/${r.id}`;
        } catch (e) { fail(e); b.disabled = false; b.textContent = "Hinzufügen"; }
      });
    } catch (e) { $("#tmdb").innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
  };

  const onInput = debounce(() => { st.q = qEl.value.trim(); writeHash(); load(true); }, 260);
  qEl.addEventListener("input", onInput);
  qEl.addEventListener("keydown", (e) => { if (e.key === "Enter") { qEl.blur(); onInput.flush(); } });
  $("#sorts").onclick = (e) => { const b = e.target.closest("[data-sort]"); if (!b) return; st.sort = b.dataset.sort; writeHash(); drawChips(); load(true); };
  $("#active").onclick = (e) => {
    const b = e.target.closest("[data-rm]"); if (!b) return;
    const k = b.dataset.rm;
    if (k === "years") { delete st.year_from; delete st.year_to; } else delete st[k];
    writeHash(); drawChips(); load(true);
  };
  $("#flt").onclick = () => filterSheet(m, st, () => { writeHash(); drawChips(); load(true); });
  const io = new IntersectionObserver((en) => { if (en[0].isIntersecting && offset < total && !loading) load(false); }, { rootMargin: "600px" });
  io.observe($("#more"));
  onLeave(() => { io.disconnect(); onInput.cancel(); });
  drawChips();
  load(true);
  if (!st.q && !Object.keys(st).length && matchMedia("(hover: hover)").matches) qEl.focus();
}, "suche");

function filterSheet(m, st, apply) {
  const genres = m.genres.filter((g) => g.n > 0);
  const provs = m.providers.filter((p) => p.n > 0).slice(0, 40);
  const fskSel = new Set((st.fsk || "").split(",").filter(Boolean));
  sheet(`<h2>Filter</h2><div class="form-grid">
    <label class="field"><span>Genre</span><select class="input" name="genre"><option value="">Alle Genres</option>${genres.map((g) => `<option value="${g.id}" ${String(g.id) === st.genre ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select></label>
    ${m.themes.length ? `<label class="field"><span>Thema</span><select class="input" name="thema"><option value="">Alle Themen</option>${m.themes.map((t, i) => `<option value="${i}" ${String(i) === st.thema ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>` : ""}
    <div class="two"><label class="field"><span>Jahr von</span><input class="input" name="year_from" inputmode="numeric" pattern="[0-9]*" placeholder="${m.years[0] || 1950}" value="${esc(st.year_from || "")}"></label>
      <label class="field"><span>bis</span><input class="input" name="year_to" inputmode="numeric" pattern="[0-9]*" placeholder="${m.years[1] || 2026}" value="${esc(st.year_to || "")}"></label></div>
    <label class="field"><span>Bewertung ab</span><select class="input" name="rating_min"><option value="">egal</option>${[5, 6, 6.5, 7, 7.5, 8].map((v) => `<option value="${v}" ${String(v) === st.rating_min ? "selected" : ""}>★ ${num(v)}</option>`).join("")}</select></label>
    <div class="field"><span>FSK</span><div class="chips" id="fsks">${m.fsk.map((f) => `<button type="button" class="chip ${fskSel.has(f) ? "on" : ""}" data-f="${esc(f)}">FSK ${esc(f)}</button>`).join("")}</div></div>
    <label class="field"><span>Streamingdienst</span><select class="input" name="provider"><option value="">egal</option><option value="mine" ${st.provider === "mine" ? "selected" : ""}>Meine Dienste</option>${provs.map((p) => `<option value="${p.id}" ${String(p.id) === st.provider ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
    <label class="field"><span>Laufzeit höchstens</span><select class="input" name="runtime_max"><option value="">egal</option>${[90, 105, 120, 150].map((v) => `<option value="${v}" ${String(v) === st.runtime_max ? "selected" : ""}>${v} Min.</option>`).join("")}</select></label>
  </div><div class="sheet-actions"><button class="btn" data-reset>Zurücksetzen</button><button class="btn primary" data-apply>Anzeigen</button></div>`, (s, close) => {
    $("#fsks", s).onclick = (e) => { const b = e.target.closest("[data-f]"); if (!b) return; b.classList.toggle("on"); };
    $("[data-reset]", s).onclick = () => { ["genre", "thema", "year_from", "year_to", "rating_min", "fsk", "provider", "runtime_max"].forEach((k) => delete st[k]); close(); apply(); };
    $("[data-apply]", s).onclick = () => {
      $$("select,input", s).forEach((el) => { const v = el.value.trim(); if (v) st[el.name] = v; else delete st[el.name]; });
      const f = $$("#fsks .chip.on", s).map((b) => b.dataset.f).join(",");
      if (f) st.fsk = f; else delete st.fsk;
      close(); apply();
    };
  });
}

/* ======================================================= Merkliste */
route(/^\/merkliste$/, async ({ query, isCurrent }) => {
  const sort = query.sort || "";
  const mine = query.mine === "1";
  const m = await meta();
  const head = `<header class="page-head wrap"><div><h1>Merkliste</h1><div class="sub" id="wlsub">&nbsp;</div></div></header>
    <div class="wrap"><div class="chips">${[["", "Zuletzt gemerkt"], ["priority", "Priorität"], ["rating", "Bewertung"], ["title", "A–Z"]]
      .map(([k, l]) => `<a class="chip ${sort === k ? "on" : ""}" href="#/merkliste?${new URLSearchParams({ ...(k ? { sort: k } : {}), ...(mine ? { mine: 1 } : {}) })}">${l}</a>`).join("")}</div>
      <label class="toggle"><span>Nur auf meinen Diensten${m.my_services.length ? "" : ' <span class="dim small">(in „Mehr“ auswählen)</span>'}</span>
        <span class="switch"><input type="checkbox" id="mine" ${mine ? "checked" : ""}><i></i></span></label>
      <div id="wl" style="margin-top:6px">${skeletonGrid()}</div></div>`;
  setView(head);
  $("#mine").onchange = (e) => { location.hash = `#/merkliste?${new URLSearchParams({ ...(sort ? { sort } : {}), ...(e.target.checked ? { mine: 1 } : {}) })}`; };
  const data = await API.get(`/api/watchlist?sort=${sort}&mine=${mine ? 1 : 0}`);
  if (!isCurrent()) return;
  $("#wlsub").textContent = data.total ? `${data.total} ${data.total === 1 ? "Film" : "Filme"}${mine ? " auf deinen Diensten" : ""}` : "";
  $("#wl").innerHTML = data.items.length
    ? `<div class="grid">${data.items.map((c) => cardHTML(c, { meta: [c.wl ? '<span style="color:var(--accent-2);font-weight:700">Unbedingt</span>' : "", c.year, c.vote ? `<span class="vote">★</span> ${num(c.vote)}` : ""].filter(Boolean).join(" · ") })).join("")}</div>`
    : mine ? emptyHTML(I.bookmark, "Nichts auf deinen Diensten", m.my_services.length ? "Keiner deiner gemerkten Filme läuft gerade bei deinen Streamingdiensten." : "Wähle unter „Mehr“ deine Streamingdienste aus.")
      : emptyHTML(I.bookmark, "Noch nichts gemerkt", "Tipp bei einem Film auf das Lesezeichen – dann landet er hier.", '<a class="btn primary" href="#/">Filme entdecken</a>');
  view().insertAdjacentHTML("beforeend", footHTML());
}, "merkliste");

/* ======================================================= Geschaut (Tagebuch) */
const VERDICT = { lohnt: "Lohnt sich", geht: "Geht so", zeit: "Zeitverschwendung" };
route(/^\/geschaut$/, async ({ isCurrent }) => {
  setView(`<header class="page-head wrap"><div><h1>Geschaut</h1><div class="sub">&nbsp;</div></div></header><div class="wrap">${skeletonGrid(6)}</div>`);
  const data = await API.get("/api/diary");
  if (!isCurrent()) return;
  if (!data.total) {
    setView(`<header class="page-head wrap"><div><h1>Geschaut</h1></div></header><div class="wrap">${emptyHTML(I.eye, "Dein Filmtagebuch ist leer", "Tipp bei einem Film auf „Gesehen“ – mit Datum, Bewertung und Notiz entsteht hier dein Tagebuch.", '<a class="btn primary" href="#/merkliste">Zur Merkliste</a>')}</div>${footHTML()}`);
    return;
  }
  setView(`<header class="page-head wrap"><div><h1>Geschaut</h1><div class="sub">${data.total} ${data.total === 1 ? "Eintrag" : "Einträge"} in deinem Filmtagebuch</div></div></header>
    <div class="wrap">${data.groups.map((g) => `<section class="month"><h2>${esc(g.label)}</h2>${g.items.map((it) => {
      const d = new Date(it.watched_on + "T12:00:00");
      return `<a class="entry" href="#/film/${it.id}">
        <div class="day"><b>${d.getDate()}</b><span>${d.toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "")}</span></div>
        ${posterHTML(it)}
        <div><div class="entry-t">${esc(it.title)}</div>
          <div class="entry-m">${it.year ? `<span>${it.year}</span>` : ""}${it.my_rating ? `<span class="mini-stars">★ ${num(it.my_rating, it.my_rating % 1 ? 1 : 0)}</span>` : ""}
            ${it.verdict ? `<span class="verdict v-${it.verdict}">${VERDICT[it.verdict]}</span>` : ""}${it.nth > 1 ? `<span>${it.nth}. Mal</span>` : ""}</div>
          ${it.note ? `<div class="entry-n">${esc(it.note)}</div>` : ""}</div></a>`;
    }).join("")}</section>`).join("")}</div>${footHTML()}`);
}, "geschaut");

/* ======================================================= Filmdetail */
const PROV_LABEL = { flatrate: "Im Abo", free: "Kostenlos", ads: "Mit Werbung", rent: "Leihen", buy: "Kaufen" };
const GOOF_CAT = { anschluss: "Anschlussfehler", logik: "Logikfehler", requisite: "Requisite", ton: "Ton", sonstiges: "Sonstiges" };

route(/^\/film\/(\d+)$/, async ({ params, isCurrent }) => {
  const id = Number(params[0]);
  setView(`<div class="hero"><div class="hero-nav"><button class="icon-btn glass" data-back aria-label="Zurück">${I.back}</button></div></div>
    <div class="wrap"><div class="d-top"><div class="skel" style="aspect-ratio:2/3"></div><div><div class="skel" style="height:28px;width:80%"></div><div class="skel" style="height:16px;width:50%;margin-top:10px"></div></div></div></div>`);
  $("[data-back]").onclick = goBack;
  const f = await API.get(`/api/movie/${id}`);
  if (!isCurrent()) return;
  document.title = `${f.title} – AURA KINO`;
  onLeave(() => { document.title = "AURA KINO"; });
  renderDetail(f);
}, "entdecken");

function renderDetail(f) {
  const main = f.trailers.find((t) => t.is_main) || f.trailers[0];
  const provKinds = ["flatrate", "free", "ads", "rent", "buy"].filter((k) => f.providers[k] && f.providers[k].length);
  const metaBits = [f.year, f.genres.map((g) => esc(g.name)).join(", "), fmtRuntime(f.runtime)].filter(Boolean);
  setView(`
  <div class="hero">${f.backdrop ? `<img src="${esc(f.backdrop)}" alt="" decoding="async">` : ""}
    <div class="hero-nav"><button class="icon-btn glass" data-back aria-label="Zurück">${I.back}</button>
    ${f.manual ? `<a class="icon-btn glass" href="#/eigener-film/${f.id}" aria-label="Bearbeiten">${I.edit}</a>` : ""}</div></div>
  <div class="wrap">
    <div class="d-top">${posterHTML({ title: f.title, poster: f.poster_big || f.poster })}
      <div><div class="d-title">${esc(f.title)}</div>
        ${f.original_title && f.original_title !== f.title ? `<div class="d-orig">${esc(f.original_title)}</div>` : ""}
        <div class="d-meta">${metaBits.map((b) => `<span>${b}</span>`).join('<span class="dim">·</span>')} ${fskHTML(f.fsk)}</div>
        ${f.vote ? `<div class="d-meta"><span class="vote" style="font-weight:700">★ ${num(f.vote)}</span><span>${(f.votes || 0).toLocaleString("de-DE")} Stimmen · TMDB</span></div>` : ""}
        ${f.release_date_de && f.release_date_de > todayISO() ? `<div class="d-meta" style="color:var(--accent-2);font-weight:600">Kinostart ${fmtDate(f.release_date_de)}</div>` : ""}
      </div></div>

    <div class="actions">
      <button class="btn ${f.my.wl ? "on" : ""}" id="a-wl">${f.my.wl ? I.bookmarkFill : I.bookmark}<span>${f.my.wl ? "Gemerkt" : "Merken"}</span></button>
      <button class="btn ${f.my.views.length ? "on" : ""}" id="a-seen">${I.check}<span>${f.my.views.length ? (f.my.views.length > 1 ? `${f.my.views.length}× gesehen` : "Gesehen") : "Gesehen"}</span></button>
      <button class="btn" id="a-tr" ${main ? "" : "disabled"}>${I.play}<span>Trailer</span></button>
    </div>
    <div id="wlbox"></div>

    ${f.tagline ? `<p class="muted" style="font-style:italic;margin:22px 0 0">${esc(f.tagline)}</p>` : ""}
    ${f.overview ? `<div class="section" style="margin-top:18px"><p class="overview clamp" id="ov">${esc(f.overview)}</p>
      ${f.overview_lang === "en" ? '<div class="dim small" style="margin-top:4px">Keine deutsche Beschreibung vorhanden – englischer Text.</div>' : ""}</div>` : ""}
    <dl class="kv">${f.directors.length ? `<dt>Regie</dt><dd>${f.directors.map((d) => `<a href="#/suche?q=${encodeURIComponent(d)}">${esc(d)}</a>`).join(", ")}</dd>` : ""}
      ${f.release_date ? `<dt>Erschienen</dt><dd>${fmtDate(f.release_date_de || f.release_date)}</dd>` : ""}</dl>
    ${f.cast.length ? `<div class="section"><h2>Besetzung</h2><div class="people">${f.cast.map((c) => `<a class="person" href="#/suche?q=${encodeURIComponent(c.name)}"><b>${esc(c.name)}</b>${c.character ? `<span>${esc(c.character)}</span>` : ""}</a>`).join("")}</div></div>` : ""}

    ${main ? `<div class="section" id="trailer-sec"><h2>Trailer</h2>
      <div class="trailer" id="trailer">${f.backdrop ? `<img src="${esc(f.backdrop)}" alt="">` : ""}
        <button class="play" aria-label="Trailer abspielen"><span>${I.play}</span></button><div class="cap" id="trcap">${esc(main.name || "Trailer")}${main.lang ? ` · ${main.lang.toUpperCase()}` : ""}</div></div>
      <div class="chips" id="trlist" style="margin-top:10px">${f.trailers.length > 1 ? f.trailers.map((t, i) => `<button class="chip ${t === main ? "on" : ""}" data-i="${i}">${esc((t.lang || "").toUpperCase())} · ${esc(t.type === "Teaser" ? "Teaser" : "Trailer")}${t.official ? "" : " (inoffiziell)"}</button>`).join("") : ""}</div>
      <a class="link" id="ytlink" href="https://www.youtube.com/watch?v=${esc(main.key)}" target="_blank" rel="noopener">Auf YouTube öffnen ${I.ext}</a></div>` : ""}

    ${f.manual ? "" : `<div class="section"><h2>Wo schauen</h2>${provKinds.length ? provKinds.map((k) => `<div class="provider-group"><h3>${PROV_LABEL[k]}</h3><div class="logos">
        ${f.providers[k].map((p) => `<div class="logo ${p.mine ? "mine" : ""}" title="${esc(p.name)}${p.mine ? " (dein Dienst)" : ""}">${p.logo ? `<img src="${esc(p.logo)}" alt="${esc(p.name)}" loading="lazy">` : esc(p.name)}</div>`).join("")}</div></div>`).join("")
        : '<p class="muted">Aktuell bei keinem Streamingdienst in Deutschland.</p>'}
      ${f.providers.flatrate && f.providers.flatrate.some((p) => p.mine) ? '<p style="color:var(--ok);font-weight:600;font-size:14px;margin:0 0 6px">✓ Läuft auf einem deiner Dienste</p>' : ""}
      ${f.justwatch ? `<a class="link" href="${esc(f.justwatch)}" target="_blank" rel="noopener">Alle Angebote ansehen (JustWatch) ${I.ext}</a>` : ""}</div>`}

    <div class="section"><h2>Mein Film</h2>
      <div class="panel"><div class="panel-h"><h3>Meine Bewertung</h3><button class="link" id="r-clear" style="margin:-8px 0">Zurücksetzen</button></div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><div class="stars" id="stars" role="slider" aria-label="Bewertung" aria-valuemin="1" aria-valuemax="10" tabindex="0"></div>
        <div class="rating-val" id="rval"></div></div>
        <div class="verdicts" id="verdicts">${Object.entries(VERDICT).map(([k, l]) => `<button class="chip" data-v="${k}">${l}</button>`).join("")}</div></div>
      <div class="panel"><div class="panel-h"><h3>Gesehen</h3><button class="btn sm" id="v-add">${I.plus} Eintrag</button></div><div class="list" id="views"></div></div>
      <div class="panel"><div class="panel-h"><h3>Notizen</h3></div>
        <textarea class="input" id="note" rows="4" placeholder="Wie war's? Lieblingsszene, Gedanken, mit wem und wo geschaut …">${esc(f.my.note)}</textarea>
        <div class="save-state" id="nstate">${f.my.note_updated ? "Gespeichert " + fmtDateTime(f.my.note_updated) : "Wird automatisch gespeichert"}</div></div>
      <div class="panel"><div class="panel-h"><h3>Filmfehler <span class="dim" id="gcount"></span></h3><button class="btn sm" id="g-add">${I.plus} Fehler</button></div><div class="list" id="goofs"></div></div>
      ${f.manual ? `<div style="margin-top:14px"><button class="btn ghost block" id="m-del">${I.trash} Eigenen Film löschen</button></div>` : ""}
    </div>

    ${f.similar.length ? `</div><section class="row section"><div class="row-head wrap"><h2>Ähnliche Filme</h2></div><div class="rail">${f.similar.map((c) => cardHTML(c)).join("")}</div></section><div class="wrap">` : ""}
    ${f.tmdb_url ? `<p class="dim small" style="margin-top:28px">Daten: <a class="link" href="${esc(f.tmdb_url)}" target="_blank" rel="noopener" style="min-height:0;font-size:12px">TMDB ${I.ext}</a>${f.updated_at ? ` · aktualisiert ${fmtDate(f.updated_at, { day: "numeric", month: "short" })}` : ""}</p>` : ""}
  </div>${footHTML()}`);

  $("[data-back]").onclick = goBack;
  const ov = $("#ov");
  if (ov) ov.onclick = () => ov.classList.toggle("clamp");
  wireWatchlist(f);
  wireSeen(f);
  wireTrailer(f, main);
  wireRating(f);
  wireNote(f);
  wireGoofs(f);
  if (f.manual) $("#m-del").onclick = async () => {
    if (!(await confirmSheet("Eigenen Film löschen?", `„${f.title}“ mit allen Notizen, Bewertungen und Fehlern löschen? Vorher wird automatisch ein Backup angelegt.`))) return;
    try { await API.del(`/api/manual/${f.id}`); toast("Gelöscht"); location.hash = "#/"; } catch (e) { fail(e); }
  };
}

function wireWatchlist(f) {
  const btn = $("#a-wl"), box = $("#wlbox");
  const draw = () => {
    btn.classList.toggle("on", !!f.my.wl);
    btn.innerHTML = `${f.my.wl ? I.bookmarkFill : I.bookmark}<span>${f.my.wl ? "Gemerkt" : "Merken"}</span>`;
    box.innerHTML = f.my.wl ? `<div class="panel" style="margin-top:12px;padding:12px"><div class="seg" id="prio">
        <button class="${f.my.wl.priority ? "" : "on"}" data-p="0">Normal</button><button class="${f.my.wl.priority ? "on" : ""}" data-p="1">Unbedingt sehen</button></div>
        <div class="dim small" style="margin-top:8px;text-align:center">Gemerkt am ${fmtDate(f.my.wl.added_at)}</div></div>` : "";
    const prio = $("#prio");
    if (prio) prio.onclick = async (e) => {
      const b = e.target.closest("[data-p]"); if (!b) return;
      try { const r = await API.post(`/api/movie/${f.id}/watchlist`, { priority: Number(b.dataset.p) }); f.my.wl = { ...f.my.wl, ...r.wl, added_at: f.my.wl.added_at }; draw(); }
      catch (err) { fail(err); }
    };
  };
  btn.onclick = async () => {
    try {
      if (f.my.wl) {
        const r = await API.del(`/api/movie/${f.id}/watchlist`);
        const prev = r.previous; f.my.wl = null; draw();
        toast("Von der Merkliste entfernt", { undo: async () => { const x = await API.post(`/api/movie/${f.id}/watchlist`, prev); f.my.wl = x.wl; draw(); } });
      } else {
        const r = await API.post(`/api/movie/${f.id}/watchlist`, { priority: 0 });
        f.my.wl = r.wl; draw();
        if (navigator.vibrate) navigator.vibrate(8);
        toast("Gemerkt", { undo: async () => { await API.del(`/api/movie/${f.id}/watchlist`); f.my.wl = null; draw(); } });
      }
    } catch (e) { fail(e); }
  };
  draw();
}

function wireSeen(f) {
  const btn = $("#a-seen"), list = $("#views");
  const draw = () => {
    const n = f.my.views.length;
    btn.classList.toggle("on", n > 0);
    btn.innerHTML = `${I.check}<span>${n > 1 ? `${n}× gesehen` : "Gesehen"}</span>`;
    list.innerHTML = n ? f.my.views.map((v) => `<div class="li"><div class="grow">${fmtDate(v.watched_on, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</div>
      <button class="icon-btn" data-ed="${v.id}" aria-label="Datum ändern">${I.edit}</button><button class="icon-btn" data-del="${v.id}" aria-label="Eintrag löschen">${I.trash}</button></div>`).join("")
      : '<p class="muted small" style="margin:0">Noch nicht gesehen.</p>';
  };
  const addSheet = (editView) => sheet(`<h2>${editView ? "Datum ändern" : "Gesehen"}</h2>
    <label class="field"><span>Wann hast du ihn geschaut?</span><input class="input" type="date" id="vd" max="${todayISO()}" value="${editView ? editView.watched_on : todayISO()}"></label>
    ${!editView && f.my.wl ? `<label class="toggle"><span>Von der Merkliste nehmen</span><span class="switch"><input type="checkbox" id="vwl" checked><i></i></span></label>` : ""}
    <div class="sheet-actions"><button class="btn" data-close>Abbrechen</button><button class="btn primary" id="vsave">Speichern</button></div>`, (s, close) => {
    $("#vsave", s).onclick = async () => {
      const d = $("#vd", s).value || todayISO();
      try {
        if (editView) {
          await API.put(`/api/views/${editView.id}`, { date: d });
          editView.watched_on = d;
          f.my.views.sort((a, b) => b.watched_on.localeCompare(a.watched_on));
          close(); draw(); toast("Datum geändert");
          return;
        }
        const r = await API.post(`/api/movie/${f.id}/views`, { date: d });
        f.my.views.unshift(r.view);
        f.my.views.sort((a, b) => b.watched_on.localeCompare(a.watched_on));
        let removedWl = null;
        if ($("#vwl", s) && $("#vwl", s).checked) {
          const x = await API.del(`/api/movie/${f.id}/watchlist`);
          removedWl = x.previous; f.my.wl = null; wireWatchlist(f);
        }
        close(); draw();
        if (navigator.vibrate) navigator.vibrate(8);
        toast("Als gesehen gespeichert", { undo: async () => {
          await API.del(`/api/views/${r.view.id}`);
          f.my.views = f.my.views.filter((v) => v.id !== r.view.id);
          if (removedWl) { const w = await API.post(`/api/movie/${f.id}/watchlist`, removedWl); f.my.wl = w.wl; wireWatchlist(f); }
          draw();
        } });
      } catch (e) { fail(e); }
    };
  });
  btn.onclick = () => addSheet(null);
  $("#v-add").onclick = () => addSheet(null);
  list.onclick = async (e) => {
    const ed = e.target.closest("[data-ed]"), del = e.target.closest("[data-del]");
    if (ed) addSheet(f.my.views.find((v) => v.id === Number(ed.dataset.ed)));
    if (del) {
      try {
        const r = await API.del(`/api/views/${del.dataset.del}`);
        f.my.views = f.my.views.filter((v) => v.id !== Number(del.dataset.del)); draw();
        toast("Eintrag gelöscht", { undo: async () => { const x = await API.post(`/api/movie/${f.id}/views`, { date: r.previous.watched_on }); f.my.views.push(x.view); f.my.views.sort((a, b) => b.watched_on.localeCompare(a.watched_on)); draw(); } });
      } catch (err) { fail(err); }
    }
  };
  draw();
}

function wireTrailer(f, main) {
  if (!main) return;
  let cur = main;
  const box = $("#trailer");
  const play = () => {
    box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(cur.key)}?autoplay=1&playsinline=1&rel=0&modestbranding=1&hl=de"
      title="${esc(cur.name || "Trailer")}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  };
  box.addEventListener("click", (e) => { if (e.target.closest(".play")) play(); });
  $("#a-tr").onclick = () => { $("#trailer-sec").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" }); play(); };
  const tl = $("#trlist");
  if (tl) tl.onclick = (e) => {
    const b = e.target.closest("[data-i]"); if (!b) return;
    cur = f.trailers[Number(b.dataset.i)];
    $$(".chip", tl).forEach((c) => c.classList.toggle("on", c === b));
    $("#ytlink").href = `https://www.youtube.com/watch?v=${cur.key}`;
    play();
  };
}

function wireRating(f) {
  const starsEl = $("#stars"), val = $("#rval"), verd = $("#verdicts");
  starsEl.innerHTML = Array.from({ length: 10 }, (_, i) => `<span class="star" data-i="${i}">
    <svg viewBox="0 0 24 24"><defs><linearGradient id="sg${i}"><stop offset="0" stop-color="var(--gold)"/><stop offset="0" stop-color="var(--gold)" class="s1"/><stop offset="0" stop-color="#3a3a42" class="s2"/></linearGradient></defs>
    <path fill="url(#sg${i})" d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"/></svg></span>`).join("");
  let shown = f.my.rating;
  const paint = (v) => {
    $$(".star", starsEl).forEach((s, i) => {
      const fill = v == null ? 0 : Math.max(0, Math.min(1, v - i));
      $(".s1", s).setAttribute("offset", fill); $(".s2", s).setAttribute("offset", fill);
    });
    val.innerHTML = v ? `${num(v, v % 1 ? 1 : 0)} <small>/ 10</small>` : '<small>Noch nicht bewertet</small>';
    starsEl.setAttribute("aria-valuenow", v || 0);
    $$("[data-v]", verd).forEach((b) => b.classList.toggle("on", b.dataset.v === f.my.verdict));
  };
  const valueAt = (x) => {
    const r = starsEl.getBoundingClientRect();
    const v = Math.ceil(((x - r.left) / r.width) * 20) / 2;
    return Math.max(1, Math.min(10, v));
  };
  const save = async (rating, verdict) => {
    const prev = { rating: f.my.rating, verdict: f.my.verdict };
    try {
      await API.put(`/api/movie/${f.id}/rating`, { rating, verdict });
      f.my.rating = rating; f.my.verdict = verdict; paint(rating);
      return prev;
    } catch (e) { fail(e); paint(f.my.rating); return null; }
  };
  let dragging = false;
  starsEl.addEventListener("pointerdown", (e) => { dragging = true; starsEl.setPointerCapture(e.pointerId); shown = valueAt(e.clientX); paint(shown); });
  starsEl.addEventListener("pointermove", (e) => { if (!dragging) return; shown = valueAt(e.clientX); paint(shown); });
  const end = async () => {
    if (!dragging) return; dragging = false;
    if (shown === f.my.rating) return;
    const prev = await save(shown, f.my.verdict);
    if (prev) toast(`Bewertet: ${num(shown, shown % 1 ? 1 : 0)} / 10`, { undo: async () => { await API.put(`/api/movie/${f.id}/rating`, prev); f.my.rating = prev.rating; f.my.verdict = prev.verdict; paint(prev.rating); } });
  };
  starsEl.addEventListener("pointerup", end);
  starsEl.addEventListener("pointercancel", () => { dragging = false; paint(f.my.rating); });
  starsEl.addEventListener("keydown", async (e) => {
    const step = { ArrowRight: .5, ArrowUp: .5, ArrowLeft: -.5, ArrowDown: -.5 }[e.key];
    if (!step) return; e.preventDefault();
    const v = Math.max(1, Math.min(10, (f.my.rating || 0) + step));
    await save(v, f.my.verdict);
  });
  verd.onclick = async (e) => {
    const b = e.target.closest("[data-v]"); if (!b) return;
    const v = f.my.verdict === b.dataset.v ? null : b.dataset.v;
    const prev = await save(f.my.rating, v);
    if (prev && v) toast(`Fazit: ${VERDICT[v]}`, { undo: async () => { await API.put(`/api/movie/${f.id}/rating`, prev); f.my.rating = prev.rating; f.my.verdict = prev.verdict; paint(prev.rating); } });
  };
  $("#r-clear").onclick = async () => {
    if (f.my.rating == null && !f.my.verdict) return;
    const prev = await save(null, null);
    if (prev) toast("Bewertung entfernt", { undo: async () => { await API.put(`/api/movie/${f.id}/rating`, prev); f.my.rating = prev.rating; f.my.verdict = prev.verdict; paint(prev.rating); } });
  };
  paint(f.my.rating);
}

function wireNote(f) {
  const ta = $("#note"), st = $("#nstate");
  let last = f.my.note, inflight = null;
  const grow = () => { ta.style.height = "auto"; ta.style.height = Math.max(120, ta.scrollHeight + 2) + "px"; };
  const save = async (keepalive = false) => {
    const text = ta.value;
    if (text === last) return;
    st.className = "save-state"; st.textContent = "Speichert …";
    try {
      if (keepalive) {
        fetch(`/api/movie/${f.id}/note`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }), keepalive: true, credentials: "same-origin" });
        last = text; return;
      }
      inflight = API.put(`/api/movie/${f.id}/note`, { text });
      const r = await inflight;
      last = text; f.my.note = text;
      if (ta.value === text) { st.className = "save-state ok"; st.textContent = "✓ Gespeichert " + fmtDateTime(r.updated_at); }
    } catch (e) {
      st.className = "save-state"; st.textContent = "Nicht gespeichert – " + e.message + " (wird erneut versucht)";
      setTimeout(() => save(), 4000);
    }
  };
  const deb = debounce(save, 700);
  ta.addEventListener("input", () => { grow(); st.className = "save-state"; st.textContent = "…"; deb(); });
  ta.addEventListener("blur", () => deb.flush());
  const vis = () => { if (document.visibilityState === "hidden") { deb.cancel(); save(true); } };
  document.addEventListener("visibilitychange", vis);
  window.addEventListener("pagehide", vis);
  onLeave(() => { deb.cancel(); save(true); document.removeEventListener("visibilitychange", vis); window.removeEventListener("pagehide", vis); });
  requestAnimationFrame(grow);
}

function wireGoofs(f) {
  const list = $("#goofs");
  const draw = () => {
    $("#gcount").textContent = f.my.goofs.length ? `(${f.my.goofs.length})` : "";
    list.innerHTML = f.my.goofs.length ? f.my.goofs.map((g) => `<div class="li" style="align-items:flex-start">
      <div class="grow" style="padding-top:6px"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${g.timecode ? `<span class="tc">${esc(g.timecode)}</span>` : ""}<span class="cat">${GOOF_CAT[g.category] || g.category}</span></div>
        <div class="goof-text">${esc(g.text)}</div></div>
      <button class="icon-btn" data-ed="${g.id}" aria-label="Bearbeiten">${I.edit}</button><button class="icon-btn" data-del="${g.id}" aria-label="Löschen">${I.trash}</button></div>`).join("")
      : '<p class="muted small" style="margin:0">Anschlussfehler, Logiklöcher, Mikro im Bild? Hier sammeln.</p>';
  };
  const sortG = () => f.my.goofs.sort((a, b) => (a.timecode ? 0 : 1) - (b.timecode ? 0 : 1) || String(a.timecode || "").localeCompare(String(b.timecode || "")) || a.id - b.id);
  const form = (g) => sheet(`<h2>${g ? "Fehler bearbeiten" : "Filmfehler hinzufügen"}</h2><div class="form-grid">
    <label class="field"><span>Was ist dir aufgefallen?</span><textarea class="input" id="gt" rows="3" style="min-height:96px" placeholder="z. B. Das Glas ist plötzlich wieder voll">${esc(g ? g.text : "")}</textarea></label>
    <label class="field"><span>Zeitstempel (optional)</span><input class="input" id="gtc" inputmode="numeric" placeholder="01:12:30" value="${esc(g && g.timecode ? g.timecode : "")}"></label>
    <div class="field"><span>Kategorie</span><div class="chips" id="gcat" style="flex-wrap:wrap">${Object.entries(GOOF_CAT).map(([k, l]) => `<button type="button" class="chip ${(g ? g.category : "anschluss") === k ? "on" : ""}" data-c="${k}">${l}</button>`).join("")}</div></div>
  </div><div class="sheet-actions"><button class="btn" data-close>Abbrechen</button><button class="btn primary" id="gsave">Speichern</button></div>`, (s, close) => {
    $("#gcat", s).onclick = (e) => { const b = e.target.closest("[data-c]"); if (!b) return; $$(".chip", $("#gcat", s)).forEach((c) => c.classList.toggle("on", c === b)); };
    const tc = $("#gtc", s);
    tc.addEventListener("input", () => {
      const d = tc.value.replace(/\D/g, "").slice(0, 6);
      if (/^\d+$/.test(tc.value.replace(/:/g, ""))) tc.value = d.length > 4 ? `${d.slice(0, d.length - 4)}:${d.slice(-4, -2)}:${d.slice(-2)}` : d.length > 2 ? `${d.slice(0, d.length - 2)}:${d.slice(-2)}` : d;
    });
    $("#gsave", s).onclick = async () => {
      const body = { text: $("#gt", s).value, timecode: tc.value, category: ($(".chip.on", $("#gcat", s)) || {}).dataset?.c || "sonstiges" };
      try {
        if (g) { const r = await API.put(`/api/goofs/${g.id}`, body); Object.assign(g, r.goof); toast("Gespeichert"); }
        else { const r = await API.post(`/api/movie/${f.id}/goofs`, body); f.my.goofs.push(r.goof); toast("Filmfehler gespeichert"); }
        sortG(); close(); draw();
      } catch (e) { fail(e); }
    };
  });
  $("#g-add").onclick = () => form(null);
  list.onclick = async (e) => {
    const ed = e.target.closest("[data-ed]"), del = e.target.closest("[data-del]");
    if (ed) form(f.my.goofs.find((g) => g.id === Number(ed.dataset.ed)));
    if (del) {
      try {
        const r = await API.del(`/api/goofs/${del.dataset.del}`);
        f.my.goofs = f.my.goofs.filter((g) => g.id !== Number(del.dataset.del)); draw();
        toast("Filmfehler gelöscht", { undo: async () => { const x = await API.post(`/api/movie/${f.id}/goofs`, r.previous); f.my.goofs.push(x.goof); sortG(); draw(); } });
      } catch (err) { fail(err); }
    }
  };
  draw();
}

/* ======================================================= Eigener Film */
route(/^\/eigener-film(?:\/(\d+))?$/, async ({ params, isCurrent }) => {
  const id = params[0] ? Number(params[0]) : null;
  const m = await meta();
  const f = id ? await API.get(`/api/movie/${id}`) : null;
  if (!isCurrent()) return;
  const sel = new Set((f ? f.genres.map((g) => g.id) : []).map(String));
  let coverData = null;
  setView(`<header class="page-head wrap"><div><button class="icon-btn" data-back aria-label="Zurück" style="margin-left:-12px">${I.back}</button>
    <h1>${f ? "Film bearbeiten" : "Eigener Film"}</h1><div class="sub">Für Filme, die es bei TMDB nicht gibt</div></div></header>
    <div class="wrap"><div class="form-grid" style="max-width:640px">
      <div style="display:grid;grid-template-columns:110px 1fr;gap:14px;align-items:end">
        <label style="cursor:pointer" aria-label="Cover wählen"><div id="cv">${posterHTML({ title: f ? f.title : "Cover wählen", poster: f && f.poster })}</div>
          <input type="file" id="cover" accept="image/*" class="sr"></label>
        <div class="muted small">Tipp aufs Cover, um ein eigenes Bild hochzuladen. Es wird automatisch verkleinert.</div></div>
      <label class="field"><span>Titel *</span><input class="input" id="t" value="${esc(f ? f.title : "")}" required></label>
      <div class="two"><label class="field"><span>Jahr</span><input class="input" id="y" inputmode="numeric" value="${esc(f && f.year ? f.year : "")}"></label>
        <label class="field"><span>Laufzeit (Min.)</span><input class="input" id="rt" inputmode="numeric" value="${esc(f && f.runtime ? f.runtime : "")}"></label></div>
      <label class="field"><span>Regie</span><input class="input" id="dir" value="${esc(f ? f.directors.join(", ") : "")}"></label>
      <div class="field"><span>Genres</span><div class="chips" id="gs" style="flex-wrap:wrap">${m.genres.map((g) => `<button type="button" class="chip ${sel.has(String(g.id)) ? "on" : ""}" data-g="${g.id}">${esc(g.name)}</button>`).join("")}</div></div>
      <label class="field"><span>Beschreibung</span><textarea class="input" id="ov" rows="4">${esc(f ? f.overview || "" : "")}</textarea></label>
      <button class="btn primary block" id="save">${f ? "Speichern" : "Film anlegen"}</button>
    </div></div>`);
  $("[data-back]").onclick = goBack;
  $("#gs").onclick = (e) => { const b = e.target.closest("[data-g]"); if (b) b.classList.toggle("on"); };
  $("#cover").onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      coverData = await resizeImage(file, 780);
      $("#cv").innerHTML = posterHTML({ title: "", poster: coverData });
    } catch (err) { fail(new Error("Bild konnte nicht gelesen werden")); }
  };
  $("#save").onclick = async () => {
    const body = {
      title: $("#t").value.trim(), year: $("#y").value.trim(), runtime: $("#rt").value.trim(), director: $("#dir").value.trim(),
      overview: $("#ov").value.trim(), genres: $$("#gs .chip.on").map((b) => Number(b.dataset.g)),
    };
    if (coverData) body.cover = coverData;
    if (!body.title) { toast("Bitte einen Titel eingeben", { error: true }); return; }
    $("#save").disabled = true;
    try {
      const r = f ? await API.put(`/api/manual/${f.id}`, body) : await API.post("/api/manual", body);
      toast(f ? "Gespeichert" : "Film angelegt");
      location.replace(`#/film/${r.id}`);
    } catch (e) { fail(e); $("#save").disabled = false; }
  };
}, "mehr");

function resizeImage(file, maxW) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.naturalWidth);
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.86));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Bild")); };
    img.src = url;
  });
}

/* ======================================================= Mehr */
route(/^\/mehr$/, async ({ isCurrent }) => {
  setView(`<header class="page-head wrap"><div><h1>Mehr</h1></div></header><div class="wrap"><div class="tiles">${'<div class="skel" style="height:86px"></div>'.repeat(4)}</div></div>`);
  const [s, m, u] = await Promise.all([API.get("/api/stats"), meta(true), API.get("/api/update")]);
  if (!isCurrent()) return;
  const maxM = Math.max(1, ...s.months.map((x) => x.n));
  const maxG = Math.max(1, ...s.genres.map((x) => x.n));
  const mine = new Set(m.my_services);
  const provs = m.providers.filter((p) => p.n > 0 || mine.has(p.id));
  const variant = /Amazon Channel|Apple TV Channel|with Ads|mit Werbung|Standard with|Basic with/i;
  const mainProvs = provs.filter((p) => !variant.test(p.name) || mine.has(p.id));
  setView(`<header class="page-head wrap"><div><h1>Mehr</h1><div class="sub">Statistik, Dienste & Einstellungen</div></div></header>
  <div class="wrap">
    <div class="tiles">
      <div class="tile"><b>${s.films_year}</b><span>Filme ${s.year}</span></div>
      <div class="tile"><b>${num(s.hours_year, s.hours_year % 1 ? 1 : 0)}</b><span>Stunden ${s.year}</span></div>
      <div class="tile"><b>${s.avg_rating ? num(s.avg_rating) : "–"}</b><span>Ø meine Bewertung</span></div>
      <div class="tile"><b>${s.watchlist}</b><span>auf der Merkliste</span></div>
    </div>
    <div class="panel" style="margin-top:12px"><div class="panel-h"><h3>Geschaut pro Monat</h3><span class="dim small">${s.views_all} gesamt · ${num(s.hours_all, 0)} Std.</span></div>
      <div class="bars">${s.months.map((x) => `<div class="bar" title="${x.n}"><i class="${x.n ? "" : "zero"}" style="height:${x.n ? Math.max(8, (x.n / maxM) * 100) : 3}%"></i><span>${esc(x.label)}</span></div>`).join("")}</div></div>
    ${s.genres.length ? `<div class="panel"><div class="panel-h"><h3>Lieblingsgenres</h3></div>${s.genres.map((g) => `<div class="hbar"><span>${esc(g.name)}</span><div><i style="width:${(g.n / maxG) * 100}%"></i></div><span class="dim small">${g.n}</span></div>`).join("")}</div>` : ""}
    ${s.best.length ? `</div><section class="row"><div class="row-head wrap"><h2>Deine Top-Filme</h2></div><div class="rail">${s.best.map((c) => cardHTML(c)).join("")}</div></section><div class="wrap">` : ""}

    <div class="section"><h2>Meine Streamingdienste</h2><p class="muted small" style="margin:-6px 0 12px">Für den Filter „Auf meinen Diensten“ und den Hinweis auf der Filmseite.</p>
      <div class="svc-grid" id="svc">${mainProvs.slice(0, 20).map((p) => svcHTML(p, mine)).join("")}</div>
      ${provs.length > 20 ? `<button class="link" id="svc-more">Alle ${provs.length} Anbieter zeigen</button>` : ""}</div>

    <div class="section"><h2>Katalog</h2><div class="panel menu">
      <a href="#/neu">${I.sparkle}<span class="grow">Neu dazugekommen</span><span class="chev">${I.chev}</span></a>
      <a href="#/eigener-film">${I.plus}<span class="grow">Eigenen Film anlegen</span><span class="chev">${I.chev}</span></a>
    </div></div>

    <div class="section"><h2>Update-Status</h2><div class="panel" id="upd"></div></div>

    <div class="section"><h2>Backup</h2><div class="panel menu">
      <button id="bk">${I.shield}<span class="grow">Backup jetzt anlegen</span><span class="dim small" id="bkinfo"></span></button>
      <a href="/api/export" download>${I.download}<span class="grow">Export als JSON</span><span class="chev">${I.chev}</span></a>
      <label style="display:flex;align-items:center;gap:14px;min-height:54px;border-top:1px solid var(--line);font-weight:550;cursor:pointer">${I.upload}<span class="grow">Import aus JSON</span><input type="file" id="imp" accept="application/json,.json" class="sr"></label>
    </div><p class="dim small">Automatisch: jede Nacht ein Backup, die letzten 14 bleiben erhalten.</p></div>

    <div class="section"><h2>Sicherheit</h2><div class="panel">
      <label class="toggle"><span style="display:flex;gap:12px;align-items:center">${I.lock} PIN beim Öffnen</span><span class="switch"><input type="checkbox" id="pin" ${m.pin_enabled ? "checked" : ""}><i></i></span></label>
      ${m.pin_enabled ? '<button class="link" id="pinchg">PIN ändern</button>' : ""}
    </div></div>
  </div>${footHTML()}`);

  // Dienste
  const svc = $("#svc");
  const saveSvc = debounce(async () => { try { await API.put("/api/settings", { my_services: [...mine] }); META = null; toast("Streamingdienste gespeichert"); } catch (e) { fail(e); } }, 600);
  svc.onclick = (e) => {
    const b = e.target.closest("[data-svc]"); if (!b) return;
    const id = Number(b.dataset.svc);
    if (mine.has(id)) mine.delete(id); else mine.add(id);
    b.classList.toggle("on", mine.has(id)); b.setAttribute("aria-pressed", mine.has(id));
    saveSvc();
  };
  const more = $("#svc-more");
  if (more) more.onclick = () => { svc.innerHTML = provs.map((p) => svcHTML(p, mine)).join(""); more.remove(); };

  // Update
  const drawUpd = (u) => {
    const last = u.runs.find((r) => r.kind === "update" || r.kind === "initial");
    $("#upd").innerHTML = `
      <div style="display:flex;align-items:center;gap:10px"><span class="dot ${u.running ? "run" : last && last.status === "error" ? "err" : ""}"></span>
        <div class="grow"><b>${u.running ? "Update läuft …" : last ? `Letztes Update ${fmtDateTime(last.finished_at || last.started_at)}` : "Noch kein Update"}</b>
        <div class="muted small">${u.counts.catalog} / ${u.limit} Katalogfilme · ${u.counts.mine} deine Filme${last ? ` · zuletzt +${last.added} neu, ${last.refreshed} aktualisiert` : ""}</div></div></div>
      <button class="btn block" id="upnow" style="margin-top:14px" ${u.running || !m.tmdb ? "disabled" : ""}>${I.refresh} Jetzt aktualisieren</button>
      ${m.tmdb ? "" : '<p class="muted small">Kein TMDB-Key eingerichtet (.env auf der Box).</p>'}
      <div class="list runs" style="margin-top:10px">${u.runs.slice(0, 5).map((r) => `<div class="li"><span class="dot ${r.status === "error" ? "err" : r.status === "running" ? "run" : ""}"></span>
        <div class="grow">${{ update: "Update", initial: "Erst-Import", import: "Import", add: "Hinzugefügt" }[r.kind] || r.kind} · ${fmtDateTime(r.started_at)}</div>
        <span class="muted small">+${r.added}${r.removed ? ` −${r.removed}` : ""}${r.errors ? ` · ${r.errors} Fehler` : ""}</span></div>`).join("")}</div>`;
    const b = $("#upnow");
    if (b) b.onclick = async () => {
      try { await API.post("/api/update"); toast("Update gestartet – das dauert ein paar Minuten"); poll(); } catch (e) { fail(e); }
    };
  };
  let timer = null;
  const poll = async () => {
    clearTimeout(timer);
    try { const x = await API.get("/api/update"); if (!isCurrent()) return; drawUpd(x); if (x.running) timer = setTimeout(poll, 4000); else if (u.running) toast("Update fertig"); u.running = x.running; }
    catch (e) { /* offline */ }
  };
  onLeave(() => clearTimeout(timer));
  drawUpd(u);
  if (u.running) poll();
  const lastBk = u.backups[0];
  $("#bkinfo").textContent = lastBk ? fmtDateTime(lastBk.time) : "";

  $("#bk").onclick = async () => {
    try { const r = await API.post("/api/backup"); $("#bkinfo").textContent = fmtDateTime(r.backups[0].time); toast("Backup angelegt"); } catch (e) { fail(e); }
  };
  $("#imp").onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const n = (data.movies || []).length;
      if (!(await confirmSheet("Sicherung importieren?", `${n} Filme mit deinen Einträgen werden zusammengeführt. Vorher wird automatisch ein Backup angelegt.`, "Importieren"))) return;
      const r = await API.post("/api/import", data);
      toast(`Importiert: ${r.movies} Filme, ${r.views} Gesehen-Einträge`);
      render();
    } catch (err) { fail(err instanceof SyntaxError ? new Error("Keine gültige JSON-Datei") : err); }
    e.target.value = "";
  };

  // PIN
  $("#pin").onchange = (e) => {
    const on = e.target.checked;
    e.target.checked = !on;
    if (on) pinSetup(false); else pinOff();
  };
  const chg = $("#pinchg");
  if (chg) chg.onclick = () => pinSetup(true);
}, "mehr");

function svcHTML(p, mine) {
  return `<button class="svc ${mine.has(p.id) ? "on" : ""}" data-svc="${p.id}" aria-pressed="${mine.has(p.id)}"><div class="logo">${p.logo ? `<img src="${esc(p.logo)}" alt="" loading="lazy">` : ""}</div><span>${esc(p.name)}</span></button>`;
}

function pinSetup(change) {
  sheet(`<h2>${change ? "PIN ändern" : "PIN einrichten"}</h2><div class="form-grid">
    ${change ? '<label class="field"><span>Aktuelle PIN</span><input class="input" id="pc" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off"></label>' : ""}
    <label class="field"><span>Neue PIN (4–8 Ziffern)</span><input class="input" id="p1" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="new-password"></label>
    <label class="field"><span>PIN wiederholen</span><input class="input" id="p2" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="new-password"></label>
  </div><div class="sheet-actions"><button class="btn" data-close>Abbrechen</button><button class="btn primary" id="psave">Speichern</button></div>`, (s, close) => {
    $("#psave", s).onclick = async () => {
      const p1 = $("#p1", s).value, p2 = $("#p2", s).value;
      if (!/^\d{4,8}$/.test(p1)) return toast("Die PIN muss 4–8 Ziffern haben", { error: true });
      if (p1 !== p2) return toast("Die PINs stimmen nicht überein", { error: true });
      try { await API.put("/api/pin", { pin: p1, current: change ? $("#pc", s).value : undefined }); close(); META = null; toast("PIN aktiv"); render(); }
      catch (e) { fail(e); }
    };
  });
}
function pinOff() {
  sheet(`<h2>PIN ausschalten</h2><label class="field"><span>Aktuelle PIN</span><input class="input" id="pc" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off"></label>
    <div class="sheet-actions"><button class="btn" data-close>Abbrechen</button><button class="btn primary" id="poff">Ausschalten</button></div>`, (s, close) => {
    $("#poff", s).onclick = async () => {
      try { await API.put("/api/pin", { enabled: false, current: $("#pc", s).value }); close(); META = null; toast("PIN ausgeschaltet"); render(); }
      catch (e) { fail(e); }
    };
  });
}

/* ======================================================= PIN-Sperre */
let lockShown = false;
function showLock() {
  if (lockShown) return;
  lockShown = true;
  let pin = "";
  const el = document.createElement("div");
  el.id = "lock";
  el.innerHTML = `<img src="/static/icons/icon-192.png" alt="" style="width:64px;height:64px;border-radius:16px">
    <div style="text-align:center"><h2>AURA KINO</h2><p class="muted" style="margin:6px 0 0" id="lmsg">PIN eingeben</p></div>
    <div class="pin-dots" id="dots"></div>
    <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join("")}<button class="txt" data-k="del">Löschen</button><button data-k="0">0</button><button class="txt" data-k="ok">OK</button></div>`;
  document.body.appendChild(el);
  $("#splash")?.classList.add("hide");
  const dots = () => { $("#dots").innerHTML = Array.from({ length: Math.max(4, pin.length) }, (_, i) => `<i class="${i < pin.length ? "f" : ""}"></i>`).join(""); };
  const submit = async () => {
    if (pin.length < 4) return;
    try {
      const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }), credentials: "same-origin" });
      if (r.ok) { el.remove(); lockShown = false; document.removeEventListener("keydown", onKey); render(); return; }
      const d = await r.json().catch(() => ({}));
      $("#lmsg").textContent = d.error || "Falsche PIN";
    } catch (e) { $("#lmsg").textContent = "Server nicht erreichbar"; }
    pin = ""; dots(); $("#dots").classList.add("shake"); setTimeout(() => $("#dots")?.classList.remove("shake"), 400);
  };
  const press = (k) => {
    if (k === "del") pin = pin.slice(0, -1);
    else if (k === "ok") return submit();
    else if (pin.length < 8) pin += k;
    dots();
  };
  const onKey = (e) => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === "Backspace") press("del"); else if (e.key === "Enter") press("ok"); };
  el.addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) press(b.dataset.k); });
  document.addEventListener("keydown", onKey);
  dots();
}

/* ======================================================= Start */
function offlinePill() {
  let p = $(".offline-pill");
  if (!navigator.onLine) { if (!p) { p = document.createElement("div"); p.className = "offline-pill"; p.textContent = "Offline – gespeicherte Ansicht"; document.body.appendChild(p); } }
  else if (p) p.remove();
}
window.addEventListener("online", offlinePill);
window.addEventListener("offline", offlinePill);

async function start() {
  offlinePill();
  try {
    const a = await fetch("/api/auth", { credentials: "same-origin" }).then((r) => r.json());
    if (a.pin_enabled && !a.authed) { showLock(); return; }
  } catch (e) { /* offline: Service Worker liefert gecachte Daten */ }
  await render();
  setTimeout(() => $("#splash")?.classList.add("hide"), 60);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {}));
}
start().finally(() => setTimeout(() => $("#splash")?.classList.add("hide"), 400));
