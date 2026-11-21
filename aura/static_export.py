"""Erzeugt die statische Webseite für GitHub Pages: App-Dateien + Katalog als JSON.

Persönliche Daten kommen hier NIE hinein – nur TMDB-Katalogdaten (öffentlich).
"""
import json
import os
import shutil
from pathlib import Path

from . import catalog, config, db

KIND_ORDER = ("flatrate", "free", "ads", "rent", "buy")


def _write(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def export(conn, out_dir, repo=None, workflow="aura-kino.yml"):
    out = Path(out_dir)
    if out.exists():
        shutil.rmtree(out)
    (out / "static").mkdir(parents=True)

    # ---- App-Dateien (gleiche relative Struktur wie beim Server)
    web = config.WEB_DIR
    for item in web.iterdir():
        if item.name in ("index.html", "manifest.json", "sw.js"):
            continue
        dest = out / "static" / item.name
        if item.is_dir():
            shutil.copytree(item, dest)
        else:
            shutil.copy2(item, dest)
    html = (web / "index.html").read_text(encoding="utf-8")
    html = html.replace('<meta name="aura-mode" content="server">', '<meta name="aura-mode" content="static">')
    (out / "index.html").write_text(html, encoding="utf-8")
    shutil.copy2(web / "manifest.json", out / "manifest.json")
    shutil.copy2(web / "sw.js", out / "sw.js")
    (out / ".nojekyll").write_text("")
    (out / "404.html").write_text(html, encoding="utf-8")

    # ---- Katalog
    focus = catalog.stored_focus(conn) or {}
    themes = focus.get("themes", [])
    theme_of = {}
    for i, t in enumerate(themes):
        if not t.get("ids"):
            continue
        q = ",".join("?" * len(t["ids"]))
        for r in conn.execute(f"SELECT DISTINCT movie_id FROM keywords WHERE keyword_id IN ({q})", t["ids"]):
            theme_of.setdefault(r[0], []).append(i)

    genres_of, cast_of, prov_of = {}, {}, {}
    for r in conn.execute("SELECT movie_id, genre_id FROM movie_genres"):
        genres_of.setdefault(r[0], []).append(r[1])
    for r in conn.execute("SELECT movie_id, name FROM people WHERE role='cast' ORDER BY ord"):
        cast_of.setdefault(r[0], []).append(r[1])
    for r in conn.execute("SELECT DISTINCT movie_id, provider_id FROM movie_providers WHERE kind IN ('flatrate','free','ads')"):
        prov_of.setdefault(r[0], []).append(r[1])

    items = []
    film_dir = out / "data" / "film"
    for m in conn.execute("SELECT * FROM movies WHERE source='tmdb' ORDER BY popularity DESC"):
        mid = m["id"]
        lists = m["lists"] or ""
        items.append({
            "i": m["tmdb_id"], "t": m["title"],
            **({"o": m["original_title"]} if m["original_title"] and m["original_title"] != m["title"] else {}),
            "y": m["year"], "d": m["release_date_de"] or m["release_date"], "rt": m["runtime"], "f": m["fsk"],
            "v": round(m["vote_average"], 1) if m["vote_average"] else None, "n": m["vote_count"] or 0,
            "p": round(m["popularity"] or 0, 1), "pp": m["poster_path"],
            "g": genres_of.get(mid, []), "k": theme_of.get(mid, []), "dr": m["director"],
            "c": cast_of.get(mid, []), "s": prov_of.get(mid, []),
            "l": ("n" if ",now_playing," in lists else "") + ("u" if ",upcoming," in lists else ""),
            "a": m["added_at"], "r": m["added_run_id"],
        })
        _write(film_dir / f"{m['tmdb_id']}.json", film_detail(conn, m))

    meta = {
        "generated_at": db.now_iso(),
        "genres": [dict(r) for r in conn.execute("SELECT id, name FROM genres ORDER BY name")],
        "providers": [{"id": r["id"], "name": r["name"], "logo_path": r["logo_path"], "priority": r["priority"]}
                      for r in conn.execute("SELECT * FROM providers ORDER BY IFNULL(priority, 999)")],
        "themes": [{"label": t["label"]} for t in themes],
        "runs": [dict(r) for r in conn.execute(
            "SELECT id, kind, started_at, finished_at, added, refreshed, removed, errors, status, message"
            " FROM update_runs ORDER BY id DESC LIMIT 20")],
        "limit": config.CATALOG_LIMIT,
        "count": len(items),
        "repo": repo or os.environ.get("GITHUB_REPOSITORY", ""),
        "workflow": workflow,
    }
    _write(out / "data" / "katalog.json", {"generated_at": meta["generated_at"], "items": items})
    _write(out / "data" / "meta.json", meta)
    return {"movies": len(items), "dir": str(out)}


def film_detail(conn, m):
    mid = m["id"]
    prov = {}
    for r in conn.execute(
        "SELECT mp.kind, p.id, p.name, p.logo_path FROM movie_providers mp JOIN providers p ON p.id=mp.provider_id"
        " WHERE mp.movie_id=? ORDER BY IFNULL(p.priority, 999)", (mid,)
    ):
        prov.setdefault(r["kind"], []).append({"id": r["id"], "name": r["name"], "logo_path": r["logo_path"]})
    return {
        "tmdb_id": m["tmdb_id"], "title": m["title"], "original_title": m["original_title"], "year": m["year"],
        "release_date": m["release_date"], "release_date_de": m["release_date_de"], "runtime": m["runtime"],
        "fsk": m["fsk"], "vote": round(m["vote_average"], 1) if m["vote_average"] else None, "votes": m["vote_count"],
        "overview": m["overview"], "overview_lang": m["overview_lang"], "tagline": m["tagline"],
        "poster_path": m["poster_path"], "backdrop_path": m["backdrop_path"],
        "genres": [dict(r) for r in conn.execute(
            "SELECT g.id, g.name FROM movie_genres mg JOIN genres g ON g.id=mg.genre_id WHERE mg.movie_id=? ORDER BY g.name", (mid,))],
        "directors": [r["name"] for r in conn.execute("SELECT name FROM people WHERE movie_id=? AND role='director' ORDER BY ord", (mid,))],
        "cast": [{"name": r["name"], "character": r["character"]} for r in conn.execute(
            "SELECT name, character FROM people WHERE movie_id=? AND role='cast' ORDER BY ord", (mid,))],
        "trailers": [dict(r) for r in conn.execute(
            "SELECT youtube_key AS key, name, lang, type, official, is_main FROM trailers WHERE movie_id=? ORDER BY is_main DESC, id", (mid,))],
        "providers": {k: prov[k] for k in KIND_ORDER if k in prov},
        "justwatch": m["justwatch_link"],
        "similar": [r["tmdb_id"] for r in conn.execute("SELECT tmdb_id FROM similar WHERE movie_id=? ORDER BY ord", (mid,))],
        "updated_at": m["updated_at"],
    }
