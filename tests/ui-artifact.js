// Test der Artifact-Version mit simulierter Artifact-Datenbank (window.claude.use("db")).
// Aufruf: node tests/ui-artifact.js <url-zur-test.html> <screenshot-ordner>
const { chromium, devices } = require("playwright");
const [URL_, SHOTS] = process.argv.slice(2);

const MOCK = () => {
  // Minimaler Nachbau der db-Schnittstelle; Inhalt bleibt in localStorage (überlebt Neuladen)
  const KEY = "mockdb";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } };
  const save = (s) => localStorage.setItem(KEY, JSON.stringify(s));
  const listeners = [];
  const notify = () => listeners.forEach((l) => l());
  const snapDoc = (path) => { const s = load(); const d = s[path]; return { id: path.split("/").pop(), exists: !!d, data: () => d, metadata: { fromCache: false, hasPendingWrites: false } }; };
  const docRef = (path) => ({
    id: path.split("/").pop(), path,
    get: async () => snapDoc(path),
    set: async (data) => { await new Promise((r) => setTimeout(r, 40)); const s = load(); s[path] = JSON.parse(JSON.stringify(data)); save(s); window.__writes = (window.__writes || 0) + 1; notify(); },
    onSnapshot: (next) => { const fn = () => next(snapDoc(path)); listeners.push(fn); setTimeout(fn, 60); return () => {}; },
  });
  const collRef = (path) => ({
    path,
    doc: (id) => docRef(path + "/" + id),
    onSnapshot: (next) => {
      const fn = () => {
        const s = load();
        const docs = Object.keys(s).filter((k) => k.startsWith(path + "/") && k.split("/").length === path.split("/").length + 1).map(snapDoc);
        next({ docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } });
      };
      listeners.push(fn); setTimeout(fn, 80); return () => {};
    },
  });
  const db = { doc: docRef, collection: collRef };
  window.__saved = [];
  window.claude = { use: async (n) => n === "db" ? db : n === "downloads" ? { save: async (x) => { window.__saved.push(x.filename); } } : null };
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 375, height: 760 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(MOCK);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("requestfailed", (r) => errors.push("REQ " + r.url().slice(0, 90)));
  const external = [];
  page.on("request", (r) => { const u = r.url(); if (!u.startsWith("http://127.0.0.1") && !u.startsWith("data:") && !u.includes("fonts.g")) external.push(u.slice(0, 80)); });
  const overflow = async (n) => { const o = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (o[0] > o[1]) errors.push(`ÜBERLAUF ${n}`); };

  await page.goto(URL_); await page.waitForSelector(".rail .card"); await page.waitForTimeout(1500);
  console.log("Reihen:", (await page.$$eval(".row h2", (h) => h.map((x) => x.textContent))).length, "| Sammelbild-Poster:", await page.$$eval(".poster .spr", (x) => x.length));
  await page.screenshot({ path: `${SHOTS}/art-1-entdecken.png` }); await overflow("entdecken");
  console.log("URL-Hash bleibt einfach:", JSON.stringify(await page.evaluate(() => location.hash)));

  await page.locator(".rail .card").nth(2).click(); await page.waitForSelector(".d-title"); await page.waitForTimeout(800);
  console.log("Detail:", await page.textContent(".d-title"), "| Hash:", JSON.stringify(await page.evaluate(() => location.hash)), "| Trailer-Link:", await page.getAttribute("#ytplay", "href").catch(() => "–"));
  await page.screenshot({ path: `${SHOTS}/art-2-detail.png` }); await overflow("detail");
  await page.click("#a-wl"); await page.waitForTimeout(200);
  await page.click("#a-seen"); await page.waitForSelector("#vsave"); await page.click("#vsave"); await page.waitForTimeout(300);
  await page.locator("#stars").scrollIntoViewIfNeeded();
  const b = await page.locator("#stars").boundingBox(); await page.mouse.click(b.x + b.width * 0.68, b.y + b.height / 2); await page.waitForTimeout(300);
  await page.fill("#note", "Als Artifact getestet."); await page.waitForTimeout(1300);
  await page.click("#g-add"); await page.fill("#gt", "Uhr springt"); await page.fill("#gtc", "1:02:03"); await page.click("#gsave"); await page.waitForTimeout(600);
  console.log("Schreibvorgänge in der Datenbank:", await page.evaluate(() => window.__writes));
  // Zurück-Knopf (interne Navigation)
  await page.click("[data-back]"); await page.waitForTimeout(700);
  console.log("Zurück auf Entdecken:", !!(await page.$(".rail")));
  // Tabs
  await page.click('nav.tabs a[data-tab="geschaut"]'); await page.waitForTimeout(700);
  console.log("Tagebuch:", (await page.$$eval(".entry-t", (e) => e.map((x) => x.textContent))).join(", "));
  await overflow("geschaut");
  await page.click('nav.tabs a[data-tab="suche"]'); await page.fill("#q", "gyllenhaal"); await page.waitForTimeout(700);
  console.log("Suche:", await page.textContent("#count"));
  await page.fill("#q", "Paddington"); await page.waitForTimeout(700);
  console.log("Nicht im Katalog:", (await page.textContent("#tmdb")).replace(/\s+/g, " ").slice(0, 90));
  await page.click('nav.tabs a[data-tab="mehr"]'); await page.waitForTimeout(900);
  console.log("Speicher:", (await page.textContent("#store")).replace(/\s+/g, " ").trim());
  await page.click("#exp"); await page.waitForTimeout(500);
  console.log("Export gespeichert:", await page.evaluate(() => window.__saved));
  await page.screenshot({ path: `${SHOTS}/art-3-mehr.png`, fullPage: true }); await overflow("mehr");

  // Neu laden → Daten aus der Datenbank
  await page.reload(); await page.waitForSelector(".rail .card"); await page.waitForTimeout(1500);
  await page.click('nav.tabs a[data-tab="merkliste"]'); await page.waitForTimeout(800);
  const wl = await page.$$eval(".card-t", (e) => e.map((x) => x.textContent));
  await page.click('nav.tabs a[data-tab="geschaut"]'); await page.waitForTimeout(800);
  await page.locator(".entry").first().click(); await page.waitForSelector("#note"); await page.waitForTimeout(700);
  console.log("Nach Neuladen:", JSON.stringify({ merkliste: wl.length, bewertung: await page.textContent("#rval"), notiz: await page.inputValue("#note"), fehler: (await page.$$("#goofs .li")).length }));
  console.log("Externe Anfragen (sollten keine sein):", external.length ? external.slice(0, 5) : "keine");
  console.log("FEHLER:", errors.length ? errors : "keine");
  await browser.close();
})();
