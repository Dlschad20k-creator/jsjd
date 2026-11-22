"""Baut AURA KINO als claude.ai-Artifact: eine Seite (CSS/JS eingebettet) + Daten + Poster-Sammelbilder.

Artifacts dürfen keine Bilder von fremden Servern laden. Deshalb werden die Poster hier in wenige
Sammelbilder (10×10 Poster je Bild) gepackt und Anbieter-Logos als data:-URIs eingebettet.
Benötigt Pillow (nur für diesen Export).
"""
import base64
import io
import json
import re
import shutil
from pathlib import Path

from . import config, db, images, static_export

COLS, ROWS = 10, 10
PW, PH = 154, 231


def _poster_image(poster_path):
    from PIL import Image
    if not poster_path:
        return None
    for size in ("w342", "w780"):
        p = images.local_path(size, poster_path)
        if p.is_file():
            break
    else:
        rel = images.download("w342", poster_path)
        if not rel:
            return None
        p = images.local_path("w342", poster_path)
    try:
        return Image.open(p).convert("RGB").resize((PW, PH), Image.LANCZOS)
    except OSError:
        return None


def _logo_data_uri(logo_path):
    if not logo_path:
        return None
    p = images.local_path(images.LOGO_SIZE, logo_path)
    if not p.is_file() and not images.download(images.LOGO_SIZE, logo_path):
        return None
    from PIL import Image
    im = Image.open(p).convert("RGB").resize((64, 64), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=82)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def _page(web: Path):
    html = (web / "index.html").read_text(encoding="utf-8")
    body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
    body = re.sub(r"<noscript>.*?</noscript>", "", body, flags=re.S)
    css = (web / "app.css").read_text(encoding="utf-8")
    css = re.sub(r"@font-face\s*{[^}]*}", "", css)       # Inter kommt von Google Fonts
    local_js = (web / "local.js").read_text(encoding="utf-8")
    app_js = (web / "app.js").read_text(encoding="utf-8")
    for js in (local_js, app_js):
        assert "</script" not in js
    return (
        "<title>AURA KINO</title>\n"
        '<meta name="claude:viewport-fit-sides" content="cover">\n'
        '<meta name="aura-mode" content="artifact">\n'
        '<meta name="theme-color" content="#0b0b0d">\n'
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">\n'
        f"<style>\n{css}\n</style>\n{body.strip()}\n"
        f"<script>\n{local_js}\n</script>\n<script>\n{app_js}\n</script>\n"
    )


def export(conn, out_dir):
    from PIL import Image

    out = Path(out_dir)
    tmp = out.parent / (out.name + ".static")
    static_export.export(conn, tmp, repo="")
    if out.exists():
        shutil.rmtree(out)
    (out / "data").mkdir(parents=True)
    (out / "img").mkdir()
    (out / "static" / "icons").mkdir(parents=True)

    kat = json.loads((tmp / "data" / "katalog.json").read_text(encoding="utf-8"))
    meta = json.loads((tmp / "data" / "meta.json").read_text(encoding="utf-8"))

    # ---- Poster-Sammelbilder (Reihenfolge = Beliebtheit, die bekanntesten liegen in den ersten Bildern)
    per = COLS * ROWS
    sheet = None
    n_sheet, slot, missing = 0, 0, 0
    for it in kat["items"]:
        im = _poster_image(it.get("pp"))
        if im is None:
            missing += 1
            continue
        if sheet is None:
            sheet = Image.new("RGB", (PW * COLS, PH * ROWS), (23, 23, 27))
        sheet.paste(im, ((slot % COLS) * PW, (slot // COLS) * PH))
        it["ps"] = [n_sheet, slot]
        slot += 1
        if slot == per:
            sheet.save(out / "img" / f"poster-{n_sheet}.jpg", "JPEG", quality=74, optimize=True, progressive=True)
            n_sheet, slot, sheet = n_sheet + 1, 0, None
    if sheet is not None:
        sheet.save(out / "img" / f"poster-{n_sheet}.jpg", "JPEG", quality=74, optimize=True, progressive=True)
        n_sheet += 1

    # ---- Details in einer Datei (ohne Backdrop – im Artifact nicht ladbar)
    details = {}
    for f in (tmp / "data" / "film").glob("*.json"):
        d = json.loads(f.read_text(encoding="utf-8"))
        d.pop("backdrop_path", None)
        details[str(d["tmdb_id"])] = d

    # ---- Logos nur für Anbieter, die im Katalog vorkommen
    used = {p for it in kat["items"] for p in it.get("s", [])}
    for d in details.values():
        for arr in (d.get("providers") or {}).values():
            used.update(p["id"] for p in arr)
    meta["providers"] = [p for p in meta["providers"] if p["id"] in used]
    for p in meta["providers"]:
        p["logo"] = _logo_data_uri(p.get("logo_path"))

    def dump(path, obj):
        path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    dump(out / "data" / "katalog.json", kat)
    dump(out / "data" / "details.json", details)
    dump(out / "data" / "meta.json", meta)
    shutil.copy2(config.WEB_DIR / "icons" / "icon-192.png", out / "static" / "icons" / "icon-192.png")
    shutil.copy2(config.WEB_DIR / "icons" / "tmdb.svg", out / "static" / "icons" / "tmdb.svg")
    (out / "aura-kino.html").write_text(_page(config.WEB_DIR), encoding="utf-8")
    shutil.rmtree(tmp)
    return {"movies": len(kat["items"]), "sheets": n_sheet, "missing_posters": missing, "dir": str(out)}
