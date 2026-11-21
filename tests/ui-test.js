// UI-Test mit Playwright (iPhone-Ansicht). Aufruf: node tests/ui-test.js <basis-url> <screenshot-ordner> [breite]
const { chromium, devices } = require("playwright");
const B = process.argv[2] || "http://127.0.0.1:8420";
const SHOTS = process.argv[3] || ".";
const WIDTH = Number(process.argv[4] || 0);

(async () => {
  const browser = await chromium.launch();
  const dev = { ...devices["iPhone 13"], deviceScaleFactor: 1 };
  if (WIDTH) dev.viewport = { width: WIDTH, height: 812 };
  const ctx = await browser.newContext(dev);
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
  const overflow = async (name) => {
    const o = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    if (o[0] > o[1]) errors.push(`OVERFLOW auf ${name}: ${o[0]} > ${o[1]}`);
  };
  const small = async (name) => {
    const bad = await page.evaluate(() => [...document.querySelectorAll("button, a.btn, a.icon-btn, nav.tabs a, .chip")]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 36 || r.width < 36); })
      .map((el) => `${el.className || el.tagName}:${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`));
    if (bad.length) console.log(`  kleine Ziele auf ${name}:`, bad.slice(0, 6).join(", "));
  };

  await page.goto(B + "/#/"); await page.waitForSelector(".rail .card"); await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/1-entdecken.png` }); await overflow("entdecken"); await small("entdecken");
  console.log("Reihen:", (await page.$$eval(".row h2", (h) => h.map((x) => x.textContent))).join(" | "));

  await page.click(".rail .card"); await page.waitForSelector(".d-title"); await page.waitForTimeout(900);
  console.log("Detail:", await page.textContent(".d-title"));
  await page.screenshot({ path: `${SHOTS}/2-detail.png` }); await overflow("detail"); await small("detail");
  await page.click("#a-wl"); await page.waitForSelector(".toast"); console.log("Toast:", await page.textContent(".toast .grow"));
  await page.click('[data-p="1"]'); await page.waitForTimeout(300);
  await page.click("#a-seen"); await page.waitForSelector("#vsave"); await page.screenshot({ path: `${SHOTS}/3-gesehen-sheet.png` });
  await page.click("#vsave"); await page.waitForTimeout(500); console.log("Toast:", await page.locator(".toast .grow").last().textContent());
  await page.locator("#stars").scrollIntoViewIfNeeded();
  const box = await page.locator("#stars").boundingBox();
  await page.mouse.click(box.x + box.width * 0.74, box.y + box.height / 2); await page.waitForTimeout(400);
  console.log("Bewertung:", await page.textContent("#rval"));
  await page.click('[data-v="lohnt"]'); await page.waitForTimeout(300);
  await page.fill("#note", "Mit Lisa im Kino geschaut. Lieblingsszene: das Finale im Regen."); await page.waitForTimeout(1300);
  console.log("Notiz:", await page.textContent("#nstate"));
  await page.click("#g-add"); await page.fill("#gt", "Kaffeebecher wechselt die Hand"); await page.fill("#gtc", "011230");
  console.log("Zeitstempel-Eingabe:", await page.inputValue("#gtc"));
  await page.click("#gsave"); await page.waitForTimeout(500); console.log("Fehlerliste:", (await page.textContent("#goofs")).replace(/\s+/g, " ").trim());
  await page.locator("#goofs [data-del]").first().click(); await page.waitForTimeout(700);
  await page.locator("[data-undo]").last().click(); await page.waitForTimeout(600);
  console.log("Nach Rückgängig:", (await page.$$("#goofs .li")).length, "Fehler");
  await page.evaluate(() => document.querySelector("#stars").scrollIntoView({ block: "start" })); await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/4-mein-film.png` });

  await page.reload(); await page.waitForSelector("#rval"); await page.waitForTimeout(600);
  const my = await page.evaluate(() => ({
    merken: document.querySelector("#a-wl").textContent.trim(), gesehen: document.querySelector("#a-seen").textContent.trim(),
    bewertung: document.querySelector("#rval").textContent, notiz: document.querySelector("#note").value.slice(0, 25),
    fehler: document.querySelectorAll("#goofs .li").length,
  }));
  console.log("Nach Neuladen:", JSON.stringify(my));

  await page.goto(B + "/#/suche"); await page.waitForSelector("#q");
  await page.fill("#q", "gyllenhaal"); await page.waitForTimeout(1000);
  console.log("Suche 'gyllenhaal':", await page.textContent("#count"), "|", (await page.$$eval("#res .card-m", (e) => e.slice(0, 2).map((x) => x.textContent))).join(" / "));
  await page.screenshot({ path: `${SHOTS}/5-suche.png` }); await overflow("suche"); await small("suche");
  await page.fill("#q", "xyzunbekannt123"); await page.waitForTimeout(2500);
  console.log("TMDB-Ersatz:", (await page.textContent("#tmdb")).slice(0, 80).replace(/\s+/g, " "));
  await page.fill("#q", "Paddington"); await page.waitForTimeout(3000);
  console.log("Paddington:", await page.textContent("#count") || "(nicht im Katalog)", "| TMDB-Treffer:", (await page.$$("#tmdb .li")).length);
  await page.screenshot({ path: `${SHOTS}/5b-tmdb.png` });
  await page.fill("#q", ""); await page.waitForTimeout(700);
  await page.click("#flt"); await page.waitForSelector("[data-apply]");
  await page.selectOption("select[name=genre]", { label: "Horror" });
  await page.fill("input[name=year_from]", "2018"); await page.selectOption("select[name=rating_min]", "7");
  await page.screenshot({ path: `${SHOTS}/6-filter.png` });
  await page.click("[data-apply]"); await page.waitForTimeout(900);
  console.log("Filter Horror ab 2018 ★7:", await page.textContent("#count"), "| Chips:", (await page.textContent("#active")).replace(/\s+/g, " "), "| URL:", page.url().split("#")[1]);

  for (const [p, name] of [["/#/merkliste", "merkliste"], ["/#/geschaut", "geschaut"], ["/#/mehr", "mehr"], ["/#/neu", "neu"], ["/#/eigener-film", "eigener"]]) {
    await page.goto(B + p); await page.waitForTimeout(1300); await overflow(name); await small(name);
    await page.screenshot({ path: `${SHOTS}/7-${name}.png` });
  }
  await page.goto(B + "/#/mehr"); await page.waitForSelector(".svc");
  await page.locator(".svc").first().click(); await page.waitForTimeout(1000);
  console.log("Dienst gewählt:", await page.locator(".svc.on span").first().textContent());
  await page.screenshot({ path: `${SHOTS}/8-mehr-full.png`, fullPage: true });

  console.log("FEHLER:", errors.length ? errors : "keine");
  await browser.close();
})();
