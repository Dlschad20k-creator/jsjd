"""Backups: SQLite-Kopie (täglich, 14 behalten) und JSON-Export/-Import meiner Daten."""
import base64
import json
import sqlite3
from datetime import datetime
from pathlib import Path

from . import config, db

EXPORT_VERSION = 1


def backup_db(conn=None, keep=None):
    """Konsistente Kopie per SQLite-Backup-API. Gibt den Pfad zurück."""
    config.ensure_dirs()
    keep = config.BACKUP_KEEP if keep is None else keep
    conn = conn or db.connect()
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = config.BACKUP_DIR / f"aura-{stamp}.db"
    target = sqlite3.connect(str(dest))
    try:
        conn.backup(target)
    finally:
        target.close()
    # zusätzlich JSON meiner Daten (klein, lesbar, unabhängig von der Datenbank)
    (config.BACKUP_DIR / f"aura-{stamp}.json").write_text(
        json.dumps(export_data(conn), ensure_ascii=False, indent=1), encoding="utf-8"
    )
    rotate(keep)
    return dest


def rotate(keep):
    for pattern in ("aura-*.db", "aura-*.json"):
        files = sorted(config.BACKUP_DIR.glob(pattern))
        for old in files[:-keep] if keep > 0 else []:
            old.unlink(missing_ok=True)


def list_backups():
    out = []
    for f in sorted(config.BACKUP_DIR.glob("aura-*.db"), reverse=True):
        out.append({"name": f.name, "size": f.stat().st_size,
                    "time": datetime.fromtimestamp(f.stat().st_mtime).isoformat(timespec="seconds")})
    return out


def _movie_ref(row):
    return {
        "tmdb_id": row["tmdb_id"], "source": row["source"], "title": row["title"],
        "original_title": row["original_title"], "year": row["year"], "release_date": row["release_date"],
        "runtime": row["runtime"], "overview": row["overview"], "director": row["director"],
        "poster_path": row["poster_path"],
    }


def export_data(conn):
    """Alle meine Eingaben + genug Filminfos, um sie ohne TMDB wiederherzustellen."""
    mine_ids = [r["id"] for r in conn.execute(f"SELECT m.id FROM movies m WHERE {db.MINE_SQL}")]
    movies = []
    for mid in mine_ids:
        m = conn.execute("SELECT * FROM movies WHERE id=?", (mid,)).fetchone()
        item = {"movie": _movie_ref(m)}
        if m["source"] == "manual":
            item["movie"]["genres"] = [r["genre_id"] for r in conn.execute("SELECT genre_id FROM movie_genres WHERE movie_id=?", (mid,))]
            if m["poster_local"]:
                p = config.UPLOAD_DIR / Path(m["poster_local"]).name
                if p.is_file():
                    item["movie"]["cover_name"] = p.name
                    item["movie"]["cover_b64"] = base64.b64encode(p.read_bytes()).decode("ascii")
        w = conn.execute("SELECT * FROM watchlist WHERE movie_id=?", (mid,)).fetchone()
        if w:
            item["watchlist"] = {"priority": w["priority"], "added_at": w["added_at"]}
        item["views"] = [{"watched_on": v["watched_on"], "created_at": v["created_at"]}
                         for v in conn.execute("SELECT * FROM views WHERE movie_id=? ORDER BY watched_on", (mid,))]
        r = conn.execute("SELECT * FROM ratings WHERE movie_id=?", (mid,)).fetchone()
        if r:
            item["rating"] = {"rating": r["rating"], "verdict": r["verdict"], "updated_at": r["updated_at"]}
        n = conn.execute("SELECT * FROM notes WHERE movie_id=?", (mid,)).fetchone()
        if n and n["text"].strip():
            item["note"] = {"text": n["text"], "updated_at": n["updated_at"]}
        item["goofs"] = [{"text": g["text"], "timecode": g["timecode"], "category": g["category"],
                          "created_at": g["created_at"], "updated_at": g["updated_at"]}
                         for g in conn.execute("SELECT * FROM goofs WHERE movie_id=? ORDER BY id", (mid,))]
        movies.append(item)
    settings = {}
    for key in ("my_services", "pin_enabled", "pin_hash"):
        v = db.get_setting(conn, key)
        if v is not None:
            settings[key] = v
    return {
        "app": "AURA KINO", "version": EXPORT_VERSION, "exported_at": db.now_iso(),
        "count": len(movies), "settings": settings, "movies": movies,
    }


def import_data(conn, data, api=None, replace=False):
    """Stellt meine Daten wieder her. Bestehende Einträge werden zusammengeführt (oder ersetzt).

    Filme, die im Katalog fehlen, werden – wenn möglich – von TMDB geladen, sonst als
    einfacher Eintrag mit den gesicherten Infos angelegt.
    """
    from . import catalog  # spät importieren (Zyklus vermeiden)

    if not isinstance(data, dict) or data.get("app") != "AURA KINO":
        raise ValueError("Das ist keine AURA-KINO-Sicherung.")
    stats = {"movies": 0, "created": 0, "views": 0, "goofs": 0}
    now = db.now_iso()
    for key, value in (data.get("settings") or {}).items():
        if key in ("my_services", "pin_enabled", "pin_hash"):
            db.set_setting(conn, key, value)
    for item in data.get("movies", []):
        ref = item.get("movie") or {}
        mid = None
        if ref.get("source") == "manual" or not ref.get("tmdb_id"):
            row = conn.execute(
                "SELECT id FROM movies WHERE source='manual' AND title=? AND IFNULL(year,0)=IFNULL(?,0)",
                (ref.get("title"), ref.get("year")),
            ).fetchone()
            if row:
                mid = row["id"]
            else:
                cover_rel = None
                if ref.get("cover_b64") and ref.get("cover_name"):
                    name = Path(ref["cover_name"]).name
                    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
                    (config.UPLOAD_DIR / name).write_bytes(base64.b64decode(ref["cover_b64"]))
                    cover_rel = name
                mid = catalog.add_manual(conn, ref.get("title") or "Ohne Titel", ref.get("year"),
                                         ref.get("overview"), ref.get("runtime"), ref.get("director"),
                                         cover_rel, ref.get("genres") or [])
                stats["created"] += 1
        else:
            row = conn.execute("SELECT id FROM movies WHERE tmdb_id=?", (ref["tmdb_id"],)).fetchone()
            if row:
                mid = row["id"]
            else:
                if api is not None and api.configured:
                    try:
                        mid, _ = catalog.fetch_and_save(conn, api, ref["tmdb_id"], keep=True)
                    except Exception:
                        mid = None
                if mid is None:
                    cur = conn.execute(
                        "INSERT INTO movies(tmdb_id, source, title, original_title, year, release_date, runtime, overview,"
                        " director, poster_path, keep, added_at, updated_at) VALUES(?, 'tmdb', ?,?,?,?,?,?,?,?,1,?,NULL)",
                        (ref["tmdb_id"], ref.get("title") or "Ohne Titel", ref.get("original_title"), ref.get("year"),
                         ref.get("release_date"), ref.get("runtime"), ref.get("overview"), ref.get("director"),
                         ref.get("poster_path"), now),
                    )
                    mid = cur.lastrowid
                stats["created"] += 1
        with db.tx(conn):
            if replace:
                for t in ("watchlist", "views", "ratings", "notes", "goofs"):
                    conn.execute(f"DELETE FROM {t} WHERE movie_id=?", (mid,))
            if item.get("watchlist"):
                w = item["watchlist"]
                conn.execute("INSERT INTO watchlist(movie_id, priority, added_at) VALUES(?,?,?)"
                             " ON CONFLICT(movie_id) DO UPDATE SET priority=excluded.priority",
                             (mid, int(w.get("priority") or 0), w.get("added_at") or now))
            existing_views = {r["watched_on"] for r in conn.execute("SELECT watched_on FROM views WHERE movie_id=?", (mid,))}
            for v in item.get("views", []):
                if v["watched_on"] in existing_views:
                    continue
                conn.execute("INSERT INTO views(movie_id, watched_on, created_at) VALUES(?,?,?)",
                             (mid, v["watched_on"], v.get("created_at") or now))
                existing_views.add(v["watched_on"])
                stats["views"] += 1
            if item.get("rating"):
                r = item["rating"]
                conn.execute("INSERT INTO ratings(movie_id, rating, verdict, updated_at) VALUES(?,?,?,?)"
                             " ON CONFLICT(movie_id) DO UPDATE SET rating=excluded.rating, verdict=excluded.verdict,"
                             " updated_at=excluded.updated_at",
                             (mid, r.get("rating"), r.get("verdict"), r.get("updated_at") or now))
            if item.get("note"):
                n = item["note"]
                old = conn.execute("SELECT text FROM notes WHERE movie_id=?", (mid,)).fetchone()
                text = n["text"]
                if old and old["text"].strip() and old["text"].strip() != text.strip() and not replace:
                    text = old["text"].rstrip() + "\n\n" + text  # nichts überschreiben
                conn.execute("INSERT INTO notes(movie_id, text, updated_at) VALUES(?,?,?)"
                             " ON CONFLICT(movie_id) DO UPDATE SET text=excluded.text, updated_at=excluded.updated_at",
                             (mid, text, n.get("updated_at") or now))
            existing_goofs = {(r["text"], r["timecode"]) for r in conn.execute("SELECT text, timecode FROM goofs WHERE movie_id=?", (mid,))}
            for g in item.get("goofs", []):
                if (g["text"], g.get("timecode")) in existing_goofs:
                    continue
                conn.execute("INSERT INTO goofs(movie_id, text, timecode, category, created_at, updated_at) VALUES(?,?,?,?,?,?)",
                             (mid, g["text"], g.get("timecode"), g.get("category") or "sonstiges",
                              g.get("created_at") or now, g.get("updated_at") or now))
                stats["goofs"] += 1
        stats["movies"] += 1
    return stats
