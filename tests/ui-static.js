// Test der GitHub-Pages-Version: node tests/ui-static.js <pages-url> <mock-github-url> <screenshot-ordner>
const { chromium, devices } = require("playwright");
const [URL_, GH, SHOTS] = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const mkCtx = async (withToken) => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 375, height: 760 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(([gh, tok]) => {
      localStorage.setItem("aura.gh_api", gh);
      if (tok) { localStorage.setItem("aura.gh_token", "test-token"); localStorage.setItem("aura.gh_repo", "Dlschad20k-creator/aura-kino-daten"); }
    }, [GH, withToken]);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    return { ctx, page };
  };
  const overflow = async (page, name) => {
    const o = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    if (o[0] > o[1]) errors.push(`ÜBERLAUF ${name}: ${o[0]}>${o[1]}`);
  };
  const state = async () => (await fetch(GH + "/_state")).json();

  // ---------- Gerät 1 (iPhone): ohne Token starten
  const { ctx, page } = await mkCtx(false);
  await page.goto(URL_ + "#/"); await page.waitForSelector(".rail .card"); await page.waitForTimeout(1500);
  console.log("Reihen:", (await page.$$eval(".row h2", (h) => h.map((x) => x.textContent))).join(" | "));
  console.log("Poster geladen:", await page.$$eval(".poster img.ok", (i) => i.length));
  await page.screenshot({ path: `${SHOTS}/gh-1-entdecken.png` }); await overflow(page, "entdecken");

  await page.goto(URL_ + "#/suche"); await page.fill("#q", "gyllenhaal"); await page.waitForTimeout(700);
  console.log("Suche gyllenhaal:", await page.textContent("#count"));
  await page.locator("#res .card").first().click(); await page.waitForSelector(".d-title"); await page.waitForTimeout(800);
  const title = await page.textContent(".d-title");
  console.log("Detail:", title, "| Trailer:", !!(await page.$("#trailer")), "| Anbieter-Gruppen:", (await page.$$(".provider-group")).length);
  await overflow(page, "detail");
  await page.click("#a-wl"); await page.waitForTimeout(300);
  await page.click("#a-seen"); await page.waitForSelector("#vsave"); await page.click("#vwl"); await page.click("#vsave"); await page.waitForTimeout(300);
  await page.locator("#stars").scrollIntoViewIfNeeded();
  const b = await page.locator("#stars").boundingBox();
  await page.mouse.click(b.x + b.width * 0.85, b.y + b.height / 2); await page.waitForTimeout(300);
  await page.click('[data-v="lohnt"]');
  await page.fill("#note", "Im GitHub-Modus geschrieben. Sehr spannend!"); await page.waitForTimeout(1200);
  await page.click("#g-add"); await page.fill("#gt", "Spiegelbild fehlt"); await page.fill("#gtc", "4512"); await page.click("#gsave"); await page.waitForTimeout(400);
  console.log("Lokal gespeichert:", await page.textContent("#rval"), "|", await page.textContent("#nstate"));
  const detailUrl = page.url();

  // Neu laden → bleibt (IndexedDB)
  await page.reload(); await page.waitForSelector("#rval"); await page.waitForTimeout(500);
  console.log("Nach Neuladen:", JSON.stringify(await page.evaluate(() => ({ wl: document.querySelector("#a-wl").textContent.trim(), r: document.querySelector("#rval").textContent, note: document.querySelector("#note").value.slice(0, 20), goofs: document.querySelectorAll("#goofs .li").length }))));

  // Mit GitHub verbinden
  await page.goto(URL_ + "#/mehr"); await page.waitForSelector("#ghsync"); await page.waitForTimeout(500);
  await page.fill("#ghrepo", "Dlschad20k-creator/aura-kino-daten"); await page.fill("#ghtok", "test-token");
  await page.click("#ghsave"); await page.waitForTimeout(1500);
  console.log("Sync-Status:", (await page.textContent("#ghsync b")).trim());
  await page.screenshot({ path: `${SHOTS}/gh-2-mehr.png`, fullPage: true }); await overflow(page, "mehr");
  let st = await state();
  const file = st.files["Dlschad20k-creator/aura-kino-daten:aura-daten.json"];
  console.log("Im privaten Repo:", file ? Object.keys(file.movies).length + " Film(e), Commits: " + st.commits.length : "NICHTS");

  // Update-Knopf → Workflow-Dispatch
  await page.click("#upnow"); await page.waitForTimeout(800);
  // Film anfordern
  await page.goto(URL_ + "#/suche"); await page.fill("#q", "Paddington"); await page.waitForTimeout(900);
  await page.click("#req"); await page.waitForTimeout(800);
  st = await state();
  console.log("Dispatches:", JSON.stringify(st.dispatches.map((d) => d[2].inputs)));

  // ---------- Gerät 2 (z. B. PC): mit Token → holt Daten
  const d2 = await mkCtx(true);
  await d2.page.goto(URL_ + "#/geschaut"); await d2.page.waitForTimeout(2500);
  await d2.page.goto(URL_ + "#/geschaut"); await d2.page.waitForTimeout(1200);
  console.log("Gerät 2 Tagebuch:", (await d2.page.$$eval(".entry-t", (e) => e.map((x) => x.textContent))).join(", ") || "leer");
  await d2.page.goto(detailUrl.replace(/^.*#/, URL_ + "#")); await d2.page.waitForSelector("#note"); await d2.page.waitForTimeout(500);
  await d2.page.fill("#note", "Auf dem PC ergänzt."); await d2.page.waitForTimeout(3500);
  // Gerät 1 holt Änderung
  await page.goto(detailUrl); await page.waitForTimeout(500);
  await page.evaluate(() => window.AuraLocal.sync()); await page.reload(); await page.waitForSelector("#note"); await page.waitForTimeout(500);
  console.log("Gerät 1 sieht Notiz von Gerät 2:", await page.inputValue("#note"));

  // Offline
  await page.goto(URL_ + "#/merkliste"); await page.waitForTimeout(800);
  await page.goto(detailUrl); await page.waitForTimeout(1000);
  await ctx.setOffline(true); await page.reload(); await page.waitForTimeout(1500);
  console.log("Offline:", JSON.stringify(await page.evaluate(() => ({ t: document.querySelector(".d-title")?.textContent, posters: document.querySelectorAll("img.ok").length, pill: !!document.querySelector(".offline-pill") }))));
  await ctx.setOffline(false);

  // PIN im GitHub-Modus
  await page.goto(URL_ + "#/mehr"); await page.waitForSelector("#pin");
  await page.click(".switch:has(#pin)"); await page.waitForSelector("#p1"); await page.fill("#p1", "1234"); await page.fill("#p2", "1234"); await page.click("#psave"); await page.waitForTimeout(500);
  const p3 = await ctx.newPage(); await p3.goto(URL_ + "#/"); await p3.waitForTimeout(1200);
  console.log("PIN-Sperre bei neuem Tab:", !!(await p3.$("#lock")));
  for (const k of ["1", "2", "3", "4"]) await p3.click(`[data-k="${k}"]`); await p3.click('[data-k="ok"]'); await p3.waitForTimeout(1200);
  console.log("Entsperrt:", !(await p3.$("#lock")), "| Reihen:", (await p3.$$(".row")).length);

  for (const [p, n] of [["#/merkliste", "merkliste"], ["#/geschaut", "geschaut"], ["#/neu", "neu"]]) {
    await p3.goto(URL_ + p); await p3.waitForTimeout(900); await overflow(p3, n);
  }
  await p3.screenshot({ path: `${SHOTS}/gh-3-geschaut.png` });
  console.log("FEHLER:", errors.length ? errors : "keine");
  await browser.close();
})();
