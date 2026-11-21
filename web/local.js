/* AURA KINO – GitHub-Modus: läuft komplett im Browser (GitHub Pages).
 * Katalog: data/katalog.json + data/film/<id>.json (öffentlich, täglich von GitHub Actions gebaut)
 * Meine Daten: IndexedDB auf dem Gerät + Sync in ein PRIVATES GitHub-Repo (jede Änderung = Version).
 * Bildet dieselben /api/...-Antworten wie server.py nach, damit app.js in beiden Modi gleich arbeitet. */
"use strict";
(function () {
  const modeMeta = document.querySelector('meta[name="aura-mode"]');
  const enabled = !!modeMeta && modeMeta.content === "static";
  const IMG = "https://image.tmdb.org/t/p/";
  const DATA_FILE = "aura-daten.json";
  const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const VERDICTS = ["lohnt", "geht", "zeit"];
  const GOOF_CATS = ["anschluss", "logik", "requisite", "ton", "sonstiges"];
  const WATCH = new Set(["flatrate", "free", "ads"]);

  class ApiErr extends Error { constructor(status, msg) { super(msg); this.status = status; } }
  const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const fold = (s) => String(s || "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/ß/g, "ss");
  let idc = 0;
  const newId = () => Date.now() * 100 + (idc++ % 100);

  /* ------------------------------------------------ IndexedDB (Schlüssel/Wert) */
  const idb = {
    db: null,
    open() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((res, rej) => {
        const r = indexedDB.open("aura-kino", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => rej(r.error);
      });
    },
    async get(k) {
      const db = await this.open();
      return new Promise((res, rej) => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    },
    async set(k, v) {
      const db = await this.open();
      return new Promise((res, rej) => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
    },
  };
  const ls = {
    get: (k, d = null) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* */ } },
  };

  /* ------------------------------------------------ Katalog laden */
  let CAT = null, META = null, BYID = new Map(), GENRES = new Map(), PROVS = new Map(), RUNKIND = new Map();
  async function loadCatalog(force = false) {
    if (CAT && !force) return;
    const opt = { cache: "no-cache" };
    const [k, m] = await Promise.all([
      fetch("data/katalog.json", opt).then((r) => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
      fetch("data/meta.json", opt).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);
    CAT = k.items || [];
    META = m || { genres: [], providers: [], themes: [], runs: [], limit: 1000, repo: "", workflow: "aura-kino.yml" };
    BYID = new Map(CAT.map((x) => [x.i, x]));
    GENRES = new Map(META.genres.map((g) => [g.id, g.name]));
    PROVS = new Map(META.providers.map((p) => [p.id, p]));
    RUNKIND = new Map(META.runs.map((r) => [r.id, r.kind]));
  }
  const detailCache = new Map();
  async function filmDetail(tmdbId) {
    if (detailCache.has(tmdbId)) return detailCache.get(tmdbId);
    try {
      const r = await fetch(`data/film/${tmdbId}.json`);
      if (!r.ok) return null;
      const d = await r.json();
      detailCache.set(tmdbId, d);
      return d;
    } catch (e) { return null; }
  }

  /* ------------------------------------------------ Meine Daten */
  let MY = null;      // { app, kind, version, updated_at, settings:{…,u}, movies:{key: entry} }
  let SYNC = { base_sha: null, dirty: false, last: null, error: null, busy: false, rev: 0 };
  const empty = () => ({ app: "AURA KINO", kind: "personal", version: 1, updated_at: now(), settings: { my_services: [], u: "" }, movies: {} });
  async function loadMy() {
    if (MY) return;
    const st = await idb.get("my").catch(() => null);
    MY = (st && st.data) || empty();
    SYNC.base_sha = (st && st.base_sha) || null;
    SYNC.dirty = !!(st && st.dirty);
  }
  async function persist() {
    MY.updated_at = now();
    SYNC.dirty = true;
    SYNC.rev++;
    await idb.set("my", { data: MY, base_sha: SYNC.base_sha, dirty: true });
    allCache = null;
    Sync.schedule();
  }
  const keyOf = (id) => (String(id).startsWith("m") ? String(id) : "t" + Number(id));
  function entry(id, create = false) {
    const k = keyOf(id);
    let e = MY.movies[k];
    if (!e && create) {
      e = MY.movies[k] = { key: k, views: [], goofs: [], u: now() };
      if (k[0] === "t") e.tmdb_id = Number(id);
    }
    return e;
  }
  const isMine = (e) => !!e && !e.deleted_manual && (!!e.manual || !!e.wl || (e.views && e.views.length) || !!e.rating || (e.note && e.note.text && e.note.text.trim()) || (e.goofs && e.goofs.length));
  function touch(e) { e.u = now(); }
  async function snapshot(e) {
    // Vollständige Kopie der Filmdaten, damit "meine" Filme auch nach dem Aufräumen des Katalogs bleiben
    if (!e.tmdb_id) return;
    const it = BYID.get(e.tmdb_id);
    const d = await filmDetail(e.tmdb_id);
    if (it || d) e.snap = { item: it || (e.snap && e.snap.item) || null, detail: d || (e.snap && e.snap.detail) || null, at: now() };
  }

  /* ------------------------------------------------ Karten */
  function itemOf(e) {
    if (e.manual) {
      const m = e.manual;
      return { i: e.key, t: m.title, y: m.year, d: m.year ? `${m.year}-01-01` : null, rt: m.runtime, f: null, v: null, n: 0, p: 0, pp: null,
        g: m.genres || [], k: [], dr: m.director, c: [], s: [], l: "", a: m.created_at, r: null, cover: m.cover, manual: true };
    }
    return BYID.get(e.tmdb_id) || (e.snap && e.snap.item) || (e.snap && e.snap.detail ? detailToItem(e.snap.detail) : null);
  }
  function detailToItem(d) {
    return { i: d.tmdb_id, t: d.title, y: d.year, d: d.release_date_de || d.release_date, rt: d.runtime, f: d.fsk, v: d.vote, n: d.votes || 0, p: 0,
      pp: d.poster_path, g: (d.genres || []).map((g) => g.id), k: [], dr: (d.directors || []).join(", "), c: (d.cast || []).map((c) => c.name),
      s: [].concat(...["flatrate", "free", "ads"].map((k) => (d.providers && d.providers[k] || []).map((p) => p.id))), l: "", a: null, r: null };
  }
  let allCache = null;
  function all() {
    if (allCache) return allCache;
    const list = CAT.slice();
    for (const e of Object.values(MY.movies)) {
      if (!isMine(e)) continue;
      if (e.manual || !BYID.has(e.tmdb_id)) { const it = itemOf(e); if (it) list.push(it); }
    }
    allCache = list;
    return list;
  }
  function card(it) {
    const e = MY.movies[typeof it.i === "string" ? it.i : "t" + it.i];
    const g = (it.g || []).map((x) => GENRES.get(x)).filter(Boolean);
    return {
      id: it.i, tmdb_id: typeof it.i === "number" ? it.i : null, title: it.t, year: it.y, date: it.d, runtime: it.rt, fsk: it.f,
      vote: it.v, votes: it.n, poster: it.cover || (it.pp ? IMG + "w342" + it.pp : null),
      wl: e && e.wl ? e.wl.priority : null, seen: e && e.views ? e.views.length : 0,
      my_rating: e && e.rating ? e.rating.rating : null, genre: g[0] || null, manual: !!it.manual,
    };
  }
  const by = (fn, dir = -1) => (a, b) => { const x = fn(a), y = fn(b); return x < y ? -dir : x > y ? dir : 0; };
  const top = (list, cmp, n) => list.slice().sort(cmp).slice(0, n).map(card);

  /* ------------------------------------------------ Lesen */
  const R = {};
  R.home = () => {
    const L = all(), rows = [], td = today();
    const cutoff = new Date(Date.now() - 21 * 864e5).toISOString();
    const nw = L.filter((x) => x.a && x.a >= cutoff && ["update", "import", "add"].includes(RUNKIND.get(x.r)));
    if (nw.length) rows.push({ key: "new", title: "Neu dazugekommen", link: "#/neu", items: top(nw, (a, b) => (b.a || "").localeCompare(a.a || "") || b.p - a.p, 24) });
    const mine = Object.values(MY.movies).filter((e) => e.wl && !(e.views && e.views.length)).sort((a, b) => (b.wl.priority - a.wl.priority) || b.wl.added_at.localeCompare(a.wl.added_at));
    const mi = mine.map(itemOf).filter(Boolean).slice(0, 20).map(card);
    if (mi.length) rows.push({ key: "watch", title: "Auf deiner Merkliste", link: "#/merkliste", items: mi });
    const svc = new Set(MY.settings.my_services || []);
    if (svc.size) {
      const it = L.filter((x) => (x.s || []).some((p) => svc.has(p)));
      if (it.length) rows.push({ key: "mine", title: "Auf deinen Streamingdiensten", items: top(it, (a, b) => ((b.v || 0) * (b.n > 100)) - ((a.v || 0) * (a.n > 100)) || b.p - a.p, 24) });
    }
    rows.push({ key: "now", title: "Gerade im Kino", items: top(L.filter((x) => (x.l || "").includes("n")), by((x) => x.p), 24) });
    rows.push({ key: "soon", title: "Demnächst", items: top(L.filter((x) => (x.l || "").includes("u") || (x.d && x.d > td && !x.manual)), by((x) => x.d || "", 1), 24) });
    (META.themes || []).forEach((t, i) => {
      rows.push({ key: "t" + i, title: t.label, link: `#/suche?thema=${i}`, items: top(L.filter((x) => (x.k || []).includes(i)), by((x) => (x.v || 0) * Math.min(x.n, 3000) / 3000 + x.p / 40), 24) });
    });
    rows.push({ key: "top", title: "Bestbewertet", items: top(L.filter((x) => x.n >= 500), by((x) => x.v || 0), 24) });
    rows.push({ key: "popular", title: "Gerade beliebt", items: top(L.filter((x) => x.d && x.d <= td), by((x) => x.p), 24) });
    const gc = new Map();
    L.forEach((x) => (x.g || []).forEach((g) => gc.set(g, (gc.get(g) || 0) + 1)));
    [...gc.entries()].filter(([, n]) => n >= 8).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([g]) => {
      rows.push({ key: "g" + g, title: GENRES.get(g) || "Genre", link: `#/suche?genre=${g}`,
        items: top(L.filter((x) => (x.g || []).includes(g)), by((x) => (x.v || 0) * Math.min(x.n, 2000) / 2000 + x.p / 50), 20) });
    });
    rows.push({ key: "classic", title: "Klassiker", items: top(L.filter((x) => x.y && x.y < 1990 && x.n >= 300), by((x) => x.v || 0), 20) });
    return { rows: rows.filter((r) => r.items.length) };
  };

  R.search = (q) => {
    let L = all();
    const text = (q.q || "").trim();
    const ft = fold(text);
    const people = (x) => fold([x.dr || "", ...(x.c || [])].join(" | "));
    if (ft) L = L.filter((x) => fold(x.t).includes(ft) || fold(x.o).includes(ft) || people(x).includes(ft));
    if (q.genre) L = L.filter((x) => (x.g || []).includes(Number(q.genre)));
    if (q.thema !== undefined && q.thema !== "") L = L.filter((x) => (x.k || []).includes(Number(q.thema)));
    if (q.year_from) L = L.filter((x) => x.y && x.y >= Number(q.year_from));
    if (q.year_to) L = L.filter((x) => x.y && x.y <= Number(q.year_to));
    if (q.rating_min) L = L.filter((x) => (x.v || 0) >= Number(q.rating_min));
    if (q.fsk) { const f = new Set(q.fsk.split(",")); L = L.filter((x) => f.has(x.f)); }
    if (q.runtime_max) L = L.filter((x) => x.rt > 0 && x.rt <= Number(q.runtime_max));
    if (q.provider) {
      const want = q.provider === "mine" ? new Set(MY.settings.my_services || []) : new Set([Number(q.provider)]);
      L = L.filter((x) => (x.s || []).some((p) => want.has(p)));
    }
    const sorts = {
      rating: (a, b) => ((b.n >= 50) - (a.n >= 50)) || (b.v || 0) - (a.v || 0),
      new: (a, b) => (b.d || "").localeCompare(a.d || ""),
      popular: (a, b) => b.p - a.p,
      az: (a, b) => fold(a.t).localeCompare(fold(b.t), "de"),
    };
    let cmp = sorts[q.sort] || sorts.popular;
    if (ft && !q.sort) cmp = (a, b) => (fold(b.t).startsWith(ft) - fold(a.t).startsWith(ft)) || (fold(b.t).includes(ft) - fold(a.t).includes(ft)) || b.p - a.p;
    L = L.slice().sort(cmp);
    const limit = Math.min(Number(q.limit || 40), 100), offset = Number(q.offset || 0);
    const items = L.slice(offset, offset + limit).map((x) => {
      const c = card(x);
      if (ft && !fold(x.t).includes(ft)) {
        if (fold(x.dr).includes(ft)) c.match = "Regie: " + x.dr;
        else { const p = (x.c || []).find((n) => fold(n).includes(ft)); if (p) c.match = "mit " + p; }
      }
      return c;
    });
    return { total: L.length, items, offset, limit };
  };

  R.meta = () => {
    const L = all();
    const gc = new Map(), pc = new Map(), fsk = new Set();
    let ymin = 9999, ymax = 0;
    L.forEach((x) => {
      (x.g || []).forEach((g) => gc.set(g, (gc.get(g) || 0) + 1));
      (x.s || []).forEach((p) => pc.set(p, (pc.get(p) || 0) + 1));
      if (x.f) fsk.add(x.f);
      if (x.y) { ymin = Math.min(ymin, x.y); ymax = Math.max(ymax, x.y); }
    });
    const mine = Object.values(MY.movies).filter(isMine).length;
    const last = (META.runs || []).find((r) => (r.kind === "update" || r.kind === "initial") && r.status !== "running");
    return {
      genres: META.genres.map((g) => ({ id: g.id, name: g.name, n: gc.get(g.id) || 0 })),
      providers: META.providers.map((p) => ({ id: p.id, name: p.name, n: pc.get(p.id) || 0, logo: p.logo_path ? IMG + "w92" + p.logo_path : null }))
        .sort((a, b) => b.n - a.n),
      fsk: [...fsk].sort((a, b) => (parseInt(a) || 99) - (parseInt(b) || 99)), years: [ymin === 9999 ? null : ymin, ymax || null],
      my_services: MY.settings.my_services || [], counts: { total: CAT.length + mine, mine, keep: 0, catalog: CAT.length },
      limit: META.limit, last_update: last || null, update_running: false,
      pin_enabled: !!MY.settings.pin_enabled, tmdb: false, static: true,
      can_request: Sync.configured(), themes: (META.themes || []).map((t) => t.label),
      generated_at: META.generated_at, repo: META.repo,
    };
  };

  function provList(d, svc) {
    const out = {};
    for (const [k, arr] of Object.entries(d.providers || {})) {
      out[k] = arr.map((p) => ({ id: p.id, name: p.name, mine: svc.has(p.id), logo: p.logo_path ? IMG + "w92" + p.logo_path : null }));
    }
    return out;
  }

  R.movie = async (q, id) => {
    const e = entry(id);
    const my = {
      wl: e && e.wl ? e.wl : null, rating: e && e.rating ? e.rating.rating : null, verdict: e && e.rating ? e.rating.verdict : null,
      note: e && e.note ? e.note.text : "", note_updated: e && e.note ? e.note.updated_at : null,
      views: e ? (e.views || []).slice().sort((a, b) => b.watched_on.localeCompare(a.watched_on) || b.id - a.id) : [],
      goofs: e ? (e.goofs || []).slice() : [],
    };
    if (String(id).startsWith("m")) {
      if (!e || !e.manual) throw new ApiErr(404, "Film nicht gefunden");
      const m = e.manual;
      return {
        id: e.key, tmdb_id: null, manual: true, title: m.title, original_title: null, year: m.year, release_date: m.year ? `${m.year}-01-01` : null,
        release_date_de: null, runtime: m.runtime, fsk: null, vote: null, votes: null, overview: m.overview, overview_lang: "de", tagline: null,
        poster: m.cover || null, poster_big: m.cover || null, backdrop: null,
        genres: (m.genres || []).map((g) => ({ id: g, name: GENRES.get(g) || "" })), directors: m.director ? [m.director] : [], cast: [],
        trailers: [], providers: {}, justwatch: null, tmdb_url: null, updated_at: m.created_at, my, similar: [],
      };
    }
    const tid = Number(id);
    let d = await filmDetail(tid);
    if (!d && e && e.snap) d = e.snap.detail;
    const it = BYID.get(tid) || (e && e.snap && e.snap.item);
    if (!d && !it) throw new ApiErr(404, "Film nicht gefunden (nicht mehr im Katalog)");
    if (!d) d = { tmdb_id: tid, title: it.t, year: it.y, release_date: it.d, runtime: it.rt, fsk: it.f, vote: it.v, votes: it.n, poster_path: it.pp, genres: (it.g || []).map((g) => ({ id: g, name: GENRES.get(g) })), directors: it.dr ? [it.dr] : [], cast: (it.c || []).map((n) => ({ name: n })), trailers: [], providers: {}, similar: [] };
    if (e && isMine(e)) { e.snap = { item: it || detailToItem(d), detail: d, at: now() }; idb.set("my", { data: MY, base_sha: SYNC.base_sha, dirty: SYNC.dirty }); }
    const svc = new Set(MY.settings.my_services || []);
    let similar = (d.similar || []).map((s) => BYID.get(s)).filter(Boolean).slice(0, 12).map(card);
    if (similar.length < 12 && d.genres && d.genres.length) {
      const gids = new Set(d.genres.map((g) => g.id)), have = new Set(similar.map((s) => s.id).concat([tid]));
      const extra = CAT.filter((x) => !have.has(x.i) && (x.g || []).some((g) => gids.has(g)))
        .sort((a, b) => ((b.g || []).filter((g) => gids.has(g)).length - (a.g || []).filter((g) => gids.has(g)).length) || ((b.v || 0) * Math.min(b.n, 1000) - (a.v || 0) * Math.min(a.n, 1000)))
        .slice(0, 12 - similar.length).map(card);
      similar = similar.concat(extra);
    }
    return {
      id: tid, tmdb_id: tid, manual: false, title: d.title, original_title: d.original_title, year: d.year, release_date: d.release_date,
      release_date_de: d.release_date_de, runtime: d.runtime, fsk: d.fsk, vote: d.vote, votes: d.votes, overview: d.overview,
      overview_lang: d.overview_lang, tagline: d.tagline,
      poster: d.poster_path ? IMG + "w342" + d.poster_path : null, poster_big: d.poster_path ? IMG + "w780" + d.poster_path : null,
      backdrop: d.backdrop_path ? IMG + "w1280" + d.backdrop_path : null, genres: d.genres || [], directors: d.directors || [],
      cast: d.cast || [], trailers: d.trailers || [], providers: provList(d, svc), justwatch: d.justwatch,
      tmdb_url: `https://www.themoviedb.org/movie/${tid}`, updated_at: d.updated_at, my, similar,
    };
  };

  R.watchlist = (q) => {
    let es = Object.values(MY.movies).filter((e) => e.wl);
    if (q.unseen === "1") es = es.filter((e) => !(e.views && e.views.length));
    let L = es.map((e) => ({ e, it: itemOf(e) })).filter((x) => x.it);
    if (q.mine === "1") { const svc = new Set(MY.settings.my_services || []); L = L.filter((x) => (x.it.s || []).some((p) => svc.has(p))); }
    const s = {
      priority: (a, b) => (b.e.wl.priority - a.e.wl.priority) || b.e.wl.added_at.localeCompare(a.e.wl.added_at),
      rating: (a, b) => (b.it.v || 0) - (a.it.v || 0),
      title: (a, b) => fold(a.it.t).localeCompare(fold(b.it.t), "de"),
    }[q.sort] || ((a, b) => b.e.wl.added_at.localeCompare(a.e.wl.added_at));
    const items = L.sort(s).map((x) => card(x.it));
    return { items, total: items.length };
  };

  R.diary = () => {
    const rows = [];
    for (const e of Object.values(MY.movies)) {
      const it = itemOf(e);
      if (!it || !e.views) continue;
      const sorted = e.views.slice().sort((a, b) => a.watched_on.localeCompare(b.watched_on) || a.id - b.id);
      sorted.forEach((v, idx) => rows.push({ v, e, it, nth: idx + 1 }));
    }
    rows.sort((a, b) => b.v.watched_on.localeCompare(a.v.watched_on) || b.v.id - a.v.id);
    const groups = [];
    for (const r of rows) {
      const ym = r.v.watched_on.slice(0, 7);
      if (!groups.length || groups[groups.length - 1].month !== ym) {
        const [y, mo] = ym.split("-");
        groups.push({ month: ym, label: `${MONTHS[Number(mo) - 1]} ${y}`, items: [] });
      }
      const note = ((r.e.note && r.e.note.text) || "").trim();
      groups[groups.length - 1].items.push({ ...card(r.it), view_id: r.v.id, watched_on: r.v.watched_on, nth: r.nth,
        verdict: r.e.rating ? r.e.rating.verdict : null, note: note.length > 140 ? note.slice(0, 140) + "…" : note });
    }
    return { groups, total: rows.length };
  };

  R.new = () => {
    const labels = { update: "Tägliches Update", import: "Import", add: "Hinzugefügt", initial: "Erst-Import" };
    const runs = [];
    for (const r of META.runs || []) {
      const its = CAT.filter((x) => x.r === r.id);
      if (!its.length) continue;
      runs.push({ run: r.id, kind: r.kind, label: labels[r.kind] || r.kind, date: r.started_at, count: its.length,
        items: its.sort((a, b) => b.p - a.p).slice(0, r.kind === "initial" ? 60 : 200).map(card) });
      if (runs.length >= 10) break;
    }
    return { runs };
  };

  R.stats = () => {
    const year = new Date().getFullYear();
    const views = [];
    for (const e of Object.values(MY.movies)) {
      const it = itemOf(e);
      (e.views || []).forEach((v) => views.push({ v, e, it }));
    }
    const yv = views.filter((x) => x.v.watched_on.startsWith(String(year)));
    const mins = (l) => l.reduce((s, x) => s + ((x.it && x.it.rt) || 0), 0);
    const gc = new Map(), seenMovies = new Set();
    views.forEach((x) => { if (seenMovies.has(x.e.key)) return; seenMovies.add(x.e.key); ((x.it && x.it.g) || []).forEach((g) => gc.set(g, (gc.get(g) || 0) + 1)); });
    const ratings = Object.values(MY.movies).filter((e) => e.rating && e.rating.rating != null);
    const months = [];
    const d0 = new Date(); d0.setDate(1);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ month: key, label: MONTHS[d.getMonth()].slice(0, 3), n: views.filter((x) => x.v.watched_on.startsWith(key)).length });
    }
    const verdicts = {};
    Object.values(MY.movies).forEach((e) => { if (e.rating && e.rating.verdict) verdicts[e.rating.verdict] = (verdicts[e.rating.verdict] || 0) + 1; });
    return {
      year, films_year: new Set(yv.map((x) => x.e.key)).size, views_year: yv.length, hours_year: Math.round(mins(yv) / 6) / 10,
      views_all: views.length, films_all: seenMovies.size, hours_all: Math.round(mins(views) / 6) / 10,
      genres: [...gc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g, n]) => ({ name: GENRES.get(g) || "?", n })),
      avg_rating: ratings.length ? Math.round(ratings.reduce((s, e) => s + e.rating.rating, 0) / ratings.length * 10) / 10 : null,
      rated: ratings.length, months,
      best: ratings.filter((e) => e.rating.rating >= 8).sort((a, b) => b.rating.rating - a.rating.rating).map(itemOf).filter(Boolean).slice(0, 12).map(card),
      watchlist: Object.values(MY.movies).filter((e) => e.wl).length,
      goofs: Object.values(MY.movies).reduce((s, e) => s + ((e.goofs || []).length), 0), verdicts,
    };
  };

  R.update = async () => {
    const st = await Actions.status().catch(() => null);
    const mine = Object.values(MY.movies).filter(isMine).length;
    return { running: !!(st && st.running), runs: META.runs || [], counts: { total: CAT.length + mine, mine, keep: 0, catalog: CAT.length },
      limit: META.limit, backups: [], github: st, sync: Sync.info() };
  };

  /* ------------------------------------------------ Schreiben */
  const W = {};
  const need = (id) => {
    if (String(id).startsWith("m")) { if (!MY.movies[id] || !MY.movies[id].manual) throw new ApiErr(404, "Film nicht gefunden"); return; }
    if (!BYID.has(Number(id)) && !(MY.movies["t" + Number(id)] && MY.movies["t" + Number(id)].snap)) throw new ApiErr(404, "Film nicht gefunden");
  };
  W.setWatchlist = async (b, id) => {
    need(id);
    const e = entry(id, true);
    const prio = [1, "1", true, "unbedingt"].includes(b.priority) ? 1 : 0;
    e.wl = { priority: prio, added_at: (e.wl && e.wl.added_at) || b.added_at || now() };
    touch(e); await snapshot(e); await persist();
    return { ok: true, wl: e.wl };
  };
  W.delWatchlist = async (b, id) => {
    const e = entry(id);
    const prev = e && e.wl ? { priority: e.wl.priority, added_at: e.wl.added_at } : null;
    if (e) { delete e.wl; touch(e); await persist(); }
    return { ok: true, previous: prev };
  };
  W.addView = async (b, id) => {
    need(id);
    const d = (b.date || today()).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new ApiErr(400, "Ungültiges Datum");
    const e = entry(id, true);
    const v = { id: newId(), watched_on: d, created_at: now() };
    e.views = (e.views || []).concat([v]);
    touch(e); await snapshot(e); await persist();
    return { ok: true, view: { id: v.id, watched_on: d } };
  };
  const findView = (vid) => { for (const e of Object.values(MY.movies)) { const v = (e.views || []).find((x) => x.id === Number(vid)); if (v) return { e, v }; } return null; };
  W.editView = async (b, vid) => {
    const d = (b.date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new ApiErr(400, "Ungültiges Datum");
    const f = findView(vid);
    if (f) { f.v.watched_on = d; touch(f.e); await persist(); }
    return { ok: true };
  };
  W.delView = async (b, vid) => {
    const f = findView(vid);
    if (!f) return { ok: true, previous: null };
    f.e.views = f.e.views.filter((x) => x !== f.v); touch(f.e); await persist();
    return { ok: true, previous: { ...f.v, movie_id: f.e.key } };
  };
  W.setRating = async (b, id) => {
    need(id);
    let r = b.rating, v = b.verdict;
    if (r != null) { r = Number(r); if (!(r >= 1 && r <= 10) || (r * 2) % 1) throw new ApiErr(400, "Bewertung 1–10 in halben Schritten"); }
    if (v != null && !VERDICTS.includes(v)) throw new ApiErr(400, "Ungültiges Fazit");
    const e = entry(id, true);
    if (r == null && v == null) delete e.rating; else e.rating = { rating: r ?? null, verdict: v ?? null, updated_at: now() };
    touch(e); await snapshot(e); await persist();
    return { ok: true, rating: r ?? null, verdict: v ?? null };
  };
  W.setNote = async (b, id) => {
    need(id);
    const e = entry(id, true);
    e.note = { text: String(b.text || "").slice(0, 20000), updated_at: now() };
    touch(e); if (!e.snap) await snapshot(e); await persist();
    return { ok: true, updated_at: e.note.updated_at };
  };
  function goofFields(b) {
    const text = String(b.text || "").trim().slice(0, 2000);
    if (!text) throw new ApiErr(400, "Bitte beschreibe den Fehler.");
    let tc = String(b.timecode || "").trim();
    if (tc) {
      const m = tc.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/);
      if (!m) throw new ApiErr(400, "Zeitstempel bitte als 01:12:30 oder 12:30");
      let h = Number(m[1] || 0), mi = Number(m[2]); const s = Number(m[3]);
      if (m[1] === undefined && mi > 59) { h = Math.floor(mi / 60); mi %= 60; }
      if (mi > 59 || s > 59) throw new ApiErr(400, "Ungültiger Zeitstempel");
      tc = [h, mi, s].map((x) => String(x).padStart(2, "0")).join(":");
    }
    const cat = b.category || "sonstiges";
    if (!GOOF_CATS.includes(cat)) throw new ApiErr(400, "Ungültige Kategorie");
    return { text, timecode: tc || null, category: cat };
  }
  W.addGoof = async (b, id) => {
    need(id);
    const f = goofFields(b);
    const e = entry(id, true);
    const g = { id: newId(), ...f, created_at: b.created_at || now(), updated_at: now() };
    e.goofs = (e.goofs || []).concat([g]);
    touch(e); await snapshot(e); await persist();
    return { ok: true, goof: { id: g.id, ...f } };
  };
  const findGoof = (gid) => { for (const e of Object.values(MY.movies)) { const g = (e.goofs || []).find((x) => x.id === Number(gid)); if (g) return { e, g }; } return null; };
  W.editGoof = async (b, gid) => {
    const f = goofFields(b), x = findGoof(gid);
    if (x) { Object.assign(x.g, f, { updated_at: now() }); touch(x.e); await persist(); }
    return { ok: true, goof: { id: Number(gid), ...f } };
  };
  W.delGoof = async (b, gid) => {
    const x = findGoof(gid);
    if (!x) return { ok: true, previous: null };
    x.e.goofs = x.e.goofs.filter((g) => g !== x.g); touch(x.e); await persist();
    return { ok: true, previous: { ...x.g } };
  };
  W.settings = async (b) => {
    if ("my_services" in b) { MY.settings.my_services = (b.my_services || []).map(Number); MY.settings.u = now(); await persist(); }
    return { ok: true, my_services: MY.settings.my_services };
  };
  async function hashPin(pin, salt) {
    salt = salt || [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, "0")).join("");
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin));
    return salt + "$" + [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  async function checkPin(pin) {
    const h = MY.settings.pin_hash;
    if (!h) return false;
    return (await hashPin(pin, h.split("$")[0])) === h;
  }
  W.pin = async (b) => {
    if (MY.settings.pin_enabled && !(await checkPin(String(b.current || "")))) throw new ApiErr(403, "Aktuelle PIN stimmt nicht.");
    if (b.enabled === false) { MY.settings.pin_enabled = false; MY.settings.u = now(); await persist(); return { ok: true, pin_enabled: false }; }
    if (!/^\d{4,8}$/.test(String(b.pin || ""))) throw new ApiErr(400, "Die PIN muss aus 4 bis 8 Ziffern bestehen.");
    MY.settings.pin_hash = await hashPin(String(b.pin));
    MY.settings.pin_enabled = true; MY.settings.u = now(); await persist();
    sessionStorage.setItem("aura.authed", "1");
    return { ok: true, pin_enabled: true };
  };
  W.manualAdd = async (b) => {
    const title = String(b.title || "").trim().slice(0, 300);
    if (!title) throw new ApiErr(400, "Titel fehlt");
    const key = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    MY.movies[key] = { key, views: [], goofs: [], u: now(), manual: {
      title, year: /^\d+$/.test(b.year || "") ? Number(b.year) : null, runtime: /^\d+$/.test(b.runtime || "") ? Number(b.runtime) : null,
      director: (b.director || "").trim() || null, overview: (b.overview || "").trim() || null, genres: (b.genres || []).map(Number),
      cover: b.cover || null, created_at: now() } };
    await persist();
    return { ok: true, id: key };
  };
  W.manualEdit = async (b, id) => {
    const e = MY.movies[id];
    if (!e || !e.manual) throw new ApiErr(404, "Nur eigene Filme können bearbeitet werden.");
    const m = e.manual;
    Object.assign(m, {
      title: String(b.title || m.title).trim().slice(0, 300), year: /^\d+$/.test(b.year || "") ? Number(b.year) : null,
      runtime: /^\d+$/.test(b.runtime || "") ? Number(b.runtime) : null, director: (b.director || "").trim() || null,
      overview: (b.overview || "").trim() || null,
    });
    if ("genres" in b) m.genres = (b.genres || []).map(Number);
    if (b.cover) m.cover = b.cover;
    touch(e); await persist();
    return { ok: true, id };
  };
  W.manualDelete = async (b, id) => {
    const e = MY.movies[id];
    if (!e || !e.manual) throw new ApiErr(404, "Nur eigene Filme können gelöscht werden.");
    // Kein echtes Löschen: als gelöscht markieren (Sync-sicher; frühere Versionen bleiben in der Git-Historie)
    MY.movies[id] = { key: id, deleted_manual: true, views: [], goofs: [], u: now() };
    await persist();
    return { ok: true };
  };

  /* ------------------------------------------------ Export / Import (kompatibel zur Box-Version) */
  function exportData() {
    const movies = [];
    for (const e of Object.values(MY.movies)) {
      if (!isMine(e)) continue;
      const it = itemOf(e) || {};
      const d = (e.snap && e.snap.detail) || {};
      const ref = e.manual
        ? { tmdb_id: null, source: "manual", title: e.manual.title, year: e.manual.year, release_date: e.manual.year ? `${e.manual.year}-01-01` : null,
          runtime: e.manual.runtime, overview: e.manual.overview, director: e.manual.director, genres: e.manual.genres,
          ...(e.manual.cover ? { cover_name: `cover-${e.key}.jpg`, cover_b64: e.manual.cover.split(",")[1] } : {}) }
        : { tmdb_id: e.tmdb_id, source: "tmdb", title: it.t || d.title, original_title: d.original_title || it.o || null, year: it.y,
          release_date: d.release_date || it.d, runtime: it.rt, overview: d.overview || null, director: it.dr || null, poster_path: it.pp || null };
      movies.push({
        movie: ref, ...(e.wl ? { watchlist: e.wl } : {}),
        views: (e.views || []).map((v) => ({ watched_on: v.watched_on, created_at: v.created_at })),
        ...(e.rating ? { rating: e.rating } : {}), ...(e.note && e.note.text.trim() ? { note: e.note } : {}),
        goofs: (e.goofs || []).map((g) => ({ text: g.text, timecode: g.timecode, category: g.category, created_at: g.created_at, updated_at: g.updated_at })),
      });
    }
    return { app: "AURA KINO", version: 1, exported_at: now(), count: movies.length,
      settings: { my_services: JSON.stringify(MY.settings.my_services || []) }, movies };
  }
  W.importJson = async (data) => {
    if (!data || data.app !== "AURA KINO") throw new ApiErr(400, "Das ist keine AURA-KINO-Sicherung.");
    if (data.kind === "personal" && data.movies && !Array.isArray(data.movies)) { // Rohdaten aus dem Daten-Repo
      MY = Sync.merge(MY, data); await persist(); return { ok: true, movies: Object.keys(data.movies).length, created: 0, views: 0, goofs: 0 };
    }
    const st = { movies: 0, created: 0, views: 0, goofs: 0 };
    if (data.settings && data.settings.my_services) { try { MY.settings.my_services = JSON.parse(data.settings.my_services).map(Number); MY.settings.u = now(); } catch (e) { /* */ } }
    for (const item of data.movies || []) {
      const ref = item.movie || {};
      let e;
      if (ref.source === "manual" || !ref.tmdb_id) {
        e = Object.values(MY.movies).find((x) => x.manual && x.manual.title === ref.title && (x.manual.year || 0) === (ref.year || 0));
        if (!e) {
          const key = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          e = MY.movies[key] = { key, views: [], goofs: [], u: now(), manual: { title: ref.title || "Ohne Titel", year: ref.year || null,
            runtime: ref.runtime || null, director: ref.director || null, overview: ref.overview || null, genres: ref.genres || [],
            cover: ref.cover_b64 ? "data:image/jpeg;base64," + ref.cover_b64 : null, created_at: now() } };
          st.created++;
        }
      } else {
        e = entry(ref.tmdb_id, true);
        if (!BYID.has(ref.tmdb_id) && !e.snap) {
          e.snap = { item: { i: ref.tmdb_id, t: ref.title, o: ref.original_title, y: ref.year, d: ref.release_date, rt: ref.runtime, f: null, v: null, n: 0, p: 0,
            pp: ref.poster_path, g: [], k: [], dr: ref.director, c: [], s: [], l: "", a: null, r: null }, detail: null, at: now() };
          st.created++;
        } else await snapshot(e);
      }
      if (item.watchlist) e.wl = { priority: Number(item.watchlist.priority || 0), added_at: item.watchlist.added_at || now() };
      const have = new Set((e.views || []).map((v) => v.watched_on));
      for (const v of item.views || []) if (!have.has(v.watched_on)) { e.views.push({ id: newId(), watched_on: v.watched_on, created_at: v.created_at || now() }); have.add(v.watched_on); st.views++; }
      if (item.rating) e.rating = { rating: item.rating.rating ?? null, verdict: item.rating.verdict ?? null, updated_at: item.rating.updated_at || now() };
      if (item.note && item.note.text) {
        const old = e.note && e.note.text.trim();
        e.note = { text: old && old !== item.note.text.trim() ? e.note.text.trimEnd() + "\n\n" + item.note.text : item.note.text, updated_at: item.note.updated_at || now() };
      }
      const hg = new Set((e.goofs || []).map((g) => g.text + "|" + (g.timecode || "")));
      for (const g of item.goofs || []) if (!hg.has(g.text + "|" + (g.timecode || ""))) { e.goofs.push({ id: newId(), text: g.text, timecode: g.timecode || null, category: g.category || "sonstiges", created_at: g.created_at || now(), updated_at: g.updated_at || now() }); st.goofs++; }
      touch(e); st.movies++;
    }
    await persist();
    return { ok: true, ...st };
  };

  /* ------------------------------------------------ GitHub: Sync meiner Daten */
  const ghApi = () => ls.get("aura.gh_api", "https://api.github.com");
  const ghToken = () => ls.get("aura.gh_token", "");
  const ghRepo = () => ls.get("aura.gh_repo", "") || ((META && META.repo ? META.repo.split("/")[0] : "") + "/aura-kino-daten");
  async function gh(method, path, body, accept = "application/vnd.github+json") {
    const headers = { Accept: accept, "X-GitHub-Api-Version": "2022-11-28" };
    if (ghToken()) headers.Authorization = "Bearer " + ghToken();
    if (body) headers["Content-Type"] = "application/json";
    const r = await fetch(ghApi() + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    return r;
  }
  const b64enc = (str) => { const bytes = new TextEncoder().encode(str); let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
  const b64dec = (b64) => { const bin = atob(b64.replace(/\s/g, "")); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); };

  const Sync = {
    timer: null,
    configured: () => !!ghToken(),
    info: () => ({ configured: !!ghToken(), repo: ghRepo(), last: SYNC.last, error: SYNC.error, dirty: SYNC.dirty, busy: SYNC.busy }),
    schedule(ms = 1500) { if (!ghToken()) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.run().catch(() => {}), ms); },
    merge(local, remote) {
      const out = JSON.parse(JSON.stringify(local));
      for (const [k, re] of Object.entries(remote.movies || {})) {
        const le = out.movies[k];
        if (!le || (re.u || "") > (le.u || "")) out.movies[k] = re;
      }
      if ((remote.settings && remote.settings.u || "") > (out.settings.u || "")) out.settings = remote.settings;
      return out;
    },
    async pull() {
      const r = await gh("GET", `/repos/${ghRepo()}/contents/${DATA_FILE}`);
      if (r.status === 404) {
        const repo = await gh("GET", `/repos/${ghRepo()}`);
        if (repo.status === 404) throw new Error(`Repo ${ghRepo()} nicht gefunden – bitte privat anlegen (oder Token-Zugriff prüfen).`);
        return { data: null, sha: null };
      }
      if (r.status === 401) throw new Error("GitHub-Token ungültig oder abgelaufen.");
      if (!r.ok) throw new Error(`GitHub-Fehler ${r.status}`);
      const j = await r.json();
      let text;
      if (j.content) text = b64dec(j.content);
      else { const raw = await gh("GET", `/repos/${ghRepo()}/contents/${DATA_FILE}`, null, "application/vnd.github.raw+json"); text = await raw.text(); }
      return { data: JSON.parse(text), sha: j.sha };
    },
    async push(sha) {
      this.pushedRev = SYNC.rev;
      const body = { message: `AURA KINO: Daten ${new Date().toLocaleString("de-DE")}`, content: b64enc(JSON.stringify(MY, null, 1)) };
      if (sha) body.sha = sha;
      const r = await gh("PUT", `/repos/${ghRepo()}/contents/${DATA_FILE}`, body);
      if (r.status === 409 || r.status === 422) return null; // jemand war schneller → neu holen
      if (r.status === 401 || r.status === 403) throw new Error("Kein Schreibrecht: Token braucht „Contents: Read and write“ für " + ghRepo());
      if (!r.ok) throw new Error(`GitHub-Fehler ${r.status} beim Speichern`);
      return (await r.json()).content.sha;
    },
    async run() {
      if (!ghToken() || SYNC.busy) return;
      SYNC.busy = true;
      let changed = false;
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          const remote = await this.pull();
          if (remote.sha && remote.sha !== SYNC.base_sha && remote.data) {
            const before = JSON.stringify(MY.movies) + JSON.stringify(MY.settings);
            MY = SYNC.dirty || SYNC.base_sha === null ? this.merge(MY, remote.data) : remote.data;
            allCache = null;
            changed = changed || before !== JSON.stringify(MY.movies) + JSON.stringify(MY.settings);
            if (!SYNC.dirty && SYNC.base_sha !== null) { SYNC.base_sha = remote.sha; break; }
            SYNC.dirty = true;
          }
          if (!SYNC.dirty && remote.sha) { SYNC.base_sha = remote.sha; break; }
          const sha = await this.push(remote.sha);
          if (sha) { SYNC.base_sha = sha; SYNC.dirty = SYNC.rev !== this.pushedRev; break; }
        }
        SYNC.last = now(); SYNC.error = null;
        await idb.set("my", { data: MY, base_sha: SYNC.base_sha, dirty: SYNC.dirty });
        window.dispatchEvent(new CustomEvent("aura-sync", { detail: { ...Sync.info(), changed } }));
      } catch (e) {
        SYNC.error = e.message;
        window.dispatchEvent(new CustomEvent("aura-sync", { detail: Sync.info() }));
        throw e;
      } finally {
        SYNC.busy = false;
        if (SYNC.dirty && !SYNC.error) this.schedule(800);   // Änderungen während des Syncs nachschieben
      }
    },
  };

  /* ------------------------------------------------ GitHub Actions: Update/Anfragen */
  const Actions = {
    async status() {
      if (!META || !META.repo) return null;
      const r = await gh("GET", `/repos/${META.repo}/actions/workflows/${META.workflow}/runs?per_page=1`);
      if (!r.ok) return null;
      const run = ((await r.json()).workflow_runs || [])[0];
      if (!run) return { running: false };
      return { running: run.status !== "completed", status: run.status, conclusion: run.conclusion, started_at: run.run_started_at, url: run.html_url, event: run.event };
    },
    async dispatch(inputs) {
      if (!ghToken()) throw new ApiErr(403, "Für diese Funktion in „Mehr → GitHub-Sync“ einen Token eintragen.");
      const r = await gh("POST", `/repos/${META.repo}/actions/workflows/${META.workflow}/dispatches`, { ref: "main", inputs });
      if (r.status === 403 || r.status === 404) throw new ApiErr(403, "Token braucht „Actions: Read and write“ für " + META.repo);
      if (!r.ok) throw new ApiErr(r.status, `GitHub-Fehler ${r.status}`);
      return { ok: true, running: true };
    },
  };

  /* ------------------------------------------------ Router für /api/... */
  let ready = null;
  async function init() {
    if (!ready) ready = (async () => { await Promise.all([loadCatalog(), loadMy()]); Sync.run().catch(() => {}); })();
    return ready;
  }
  async function handle(method, path, body) {
    await init();
    const u = new URL(path, location.href);
    const p = u.pathname.replace(/^.*?\/api\//, "/api/");
    const q = Object.fromEntries(u.searchParams);
    let m;
    if (p === "/api/auth") {
      if (method === "GET") return { pin_enabled: !!MY.settings.pin_enabled, authed: !MY.settings.pin_enabled || sessionStorage.getItem("aura.authed") === "1" };
      if (method === "POST") { if (await checkPin(String(body.pin || ""))) { sessionStorage.setItem("aura.authed", "1"); return { ok: true }; } throw new ApiErr(403, "Falsche PIN"); }
    }
    if (MY.settings.pin_enabled && sessionStorage.getItem("aura.authed") !== "1") throw new ApiErr(401, "PIN erforderlich");
    if (method === "GET") {
      if (p === "/api/home") return R.home();
      if (p === "/api/search") return R.search(q);
      if (p === "/api/meta") return R.meta();
      if ((m = p.match(/^\/api\/movie\/([\w-]+)$/))) return R.movie(q, m[1]);
      if (p === "/api/watchlist") return R.watchlist(q);
      if (p === "/api/diary") return R.diary();
      if (p === "/api/new") return R.new();
      if (p === "/api/stats") return R.stats();
      if (p === "/api/update") return R.update();
      if (p === "/api/export") return exportData();
      if (p === "/api/tmdb/search") return { items: [], request: true };
    } else {
      if ((m = p.match(/^\/api\/movie\/([\w-]+)\/watchlist$/))) return method === "POST" ? W.setWatchlist(body, m[1]) : W.delWatchlist(body, m[1]);
      if ((m = p.match(/^\/api\/movie\/([\w-]+)\/views$/))) return W.addView(body, m[1]);
      if ((m = p.match(/^\/api\/views\/(\d+)$/))) return method === "PUT" ? W.editView(body, m[1]) : W.delView(body, m[1]);
      if ((m = p.match(/^\/api\/movie\/([\w-]+)\/rating$/))) return W.setRating(body, m[1]);
      if ((m = p.match(/^\/api\/movie\/([\w-]+)\/note$/))) return W.setNote(body, m[1]);
      if ((m = p.match(/^\/api\/movie\/([\w-]+)\/goofs$/))) return W.addGoof(body, m[1]);
      if ((m = p.match(/^\/api\/goofs\/(\d+)$/))) return method === "PUT" ? W.editGoof(body, m[1]) : W.delGoof(body, m[1]);
      if (p === "/api/settings") return W.settings(body);
      if (p === "/api/pin") return W.pin(body);
      if (p === "/api/manual") return W.manualAdd(body);
      if ((m = p.match(/^\/api\/manual\/([\w-]+)$/))) return method === "PUT" ? W.manualEdit(body, m[1]) : W.manualDelete(body, m[1]);
      if (p === "/api/import") return W.importJson(body);
      if (p === "/api/backup") { await Sync.run(); return { ok: true, backups: [] }; }
      if (p === "/api/update") return Actions.dispatch({ aktion: "update" });
      if (p === "/api/request") {
        const t = String(body.title || "").trim();
        if (!t) throw new ApiErr(400, "Titel fehlt");
        return Actions.dispatch({ aktion: "add", titel: t });
      }
    }
    throw new ApiErr(404, "Unbekannter Pfad: " + p);
  }

  window.AuraLocal = {
    enabled, handle, init, ApiErr,
    sync: () => Sync.run(), syncInfo: () => Sync.info(),
    setGitHub(token, repo) { ls.set("aura.gh_token", token || null); ls.set("aura.gh_repo", repo || null); SYNC.base_sha = SYNC.base_sha || null; },
    exportData: () => exportData(),
    reloadCatalog: () => loadCatalog(true).then(() => { allCache = null; }),
  };
  if (enabled) {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && SYNC.dirty) Sync.run().catch(() => {});
      if (document.visibilityState === "visible" && ready) Sync.schedule(300);
    });
  }
})();
