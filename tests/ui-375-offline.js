// 375-px-Ansicht aller Seiten, Sperrbildschirm und Offline-Test. Aufruf: node tests/ui-375-offline.js <url> <ordner> [pin-url]
const { chromium, devices } = require("playwright");
const B = process.argv[2], SHOTS = process.argv[3], PIN_URL = process.argv[4];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone SE"], viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  console.log("Viewport:", JSON.stringify(page.viewportSize()));
  const pages = [["/#/", "entdecken"], ["/#/suche?genre=53&sort=rating", "suche"], ["/#/merkliste", "merkliste"], ["/#/geschaut", "geschaut"], ["/#/mehr", "mehr"], ["/#/neu", "neu"]];
  for (const [p, n] of pages) {
    await page.goto(B + p); await page.waitForTimeout(1500);
    const o = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    console.log(`${n}: Breite ${o[0]}/${o[1]} ${o[0] > o[1] ? "ÜBERLAUF!" : "ok"}`);
    await page.screenshot({ path: `${SHOTS}/375-${n}.png` });
  }
  // Detailseite des ersten Films
  await page.goto(B + "/#/"); await page.waitForSelector(".rail .card"); await page.click(".rail .card"); await page.waitForSelector(".d-title"); await page.waitForTimeout(1200);
  let o = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  console.log(`detail: Breite ${o[0]}/${o[1]} ${o[0] > o[1] ? "ÜBERLAUF!" : "ok"}`);
  await page.screenshot({ path: `${SHOTS}/375-detail.png` });
  await page.screenshot({ path: `${SHOTS}/375-detail-full.png`, fullPage: true });
  const detailHash = new URL(page.url()).hash;
  // Trailer: erst beim Antippen laden
  const before = await page.$$eval("iframe", (f) => f.length);
  await page.click("#trailer .play"); await page.waitForTimeout(500);
  const src = await page.$eval("#trailer iframe", (f) => f.src).catch(() => "kein iframe");
  console.log(`Trailer: iframes vorher ${before}, nach Tippen: ${src.slice(0, 60)}`);

  // Offline: Service Worker aktiv? Dann Netz kappen und neu laden
  await page.goto(B + "/#/merkliste"); await page.waitForTimeout(1500);
  await page.goto(B + "/" + detailHash); await page.waitForTimeout(1500);
  const sw = await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()) && !!navigator.serviceWorker.controller);
  console.log("Service Worker aktiv:", sw);
  await ctx.setOffline(true);
  await page.reload(); await page.waitForTimeout(1500);
  const off = await page.evaluate(() => ({ title: document.querySelector(".d-title")?.textContent, poster: [...document.querySelectorAll(".poster img.ok")].length, pill: document.querySelector(".offline-pill")?.textContent }));
  console.log("Offline neu geladen:", JSON.stringify(off));
  await page.screenshot({ path: `${SHOTS}/375-offline.png` });
  await ctx.setOffline(false);

  if (PIN_URL) {
    const p2 = await (await browser.newContext({ ...devices["iPhone SE"], deviceScaleFactor: 2 })).newPage();
    await p2.goto(PIN_URL + "/#/"); await p2.waitForSelector("#lock"); await p2.waitForTimeout(400);
    await p2.screenshot({ path: `${SHOTS}/375-pin.png` });
    for (const k of ["2", "5", "8", "0"]) await p2.click(`[data-k="${k}"]`);
    await p2.click('[data-k="ok"]'); await p2.waitForTimeout(1500);
    console.log("Nach PIN-Eingabe entsperrt:", !(await p2.$("#lock")), "| Reihen:", (await p2.$$(".row")).length);
  }
  console.log("JS-FEHLER:", errors.length ? errors : "keine");
  await browser.close();
})();
