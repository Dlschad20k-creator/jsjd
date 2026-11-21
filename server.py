#!/usr/bin/env python3
"""AURA KINO – Webserver (nur Standardbibliothek): liefert App, Bilder und JSON-API aus."""
import base64
import gzip
import hashlib
import hmac
import ipaddress
import json
import mimetypes
import os
import re
import secrets
import subprocess
import sys
import threading
import time
import traceback
import urllib.parse
from datetime import date, datetime, timedelta, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from aura import backup, catalog, config, db
from aura.tmdb import TMDB, TMDBError

ALLOWED = [ipaddress.ip_network(n.strip(), strict=False) for n in config.ALLOWED_NETS.split(",") if n.strip()]
SESSION_DAYS = 180
MAX_BODY = 60 * 1024 * 1024
MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]
VERDICTS = {"lohnt", "geht", "zeit"}
GOOF_CATS = {"anschluss", "logik", "requisite", "ton", "sonstiges"}
WATCH_KINDS = ("flatrate", "free", "ads")
TMDB_IMG = "https://image.tmdb.org/t/p"

_fail = {"count": 0, "until": 0.0}
_fail_lock = threading.Lock()


class ApiError(Exception):
    def __init__(self, status, msg):
        super().__init__(msg)
        self.status, self.msg = status, msg


# =============================================================== Hilfsfunktionen
def poster_url(r, big=False):
    if r["poster_local"]:
        if r["source"] == "manual":
            return f"/uploads/{r['poster_local']}"
        name = r["poster_local"].split("/")[-1]
        return f"/img/{'w780' if big else 'w342'}/{name}"
    if r["poster_path"]:
        return f"{TMDB_IMG}/{'w780' if big else 'w342'}{r['poster_path']}"
    return None


CARD_SQL = """
SELECT m.id, m.tmdb_id, m.source, m.title, m.year, m.release_date, m.release_date_de, m.runtime, m.fsk,
       m.vote_average, m.vote_count, m.popularity, m.poster_local, m.poster_path, m.added_at,
       (SELECT priority FROM watchlist w WHERE w.movie_id = m.id) AS wl,
       (SELECT added_at FROM watchlist w WHERE w.movie_id = m.id) AS wl_at,
       (SELECT COUNT(*) FROM views v WHERE v.movie_id = m.id) AS seen,
       (SELECT rating FROM ratings r WHERE r.movie_id = m.id) AS my_rating,
       (SELECT g.name FROM movie_genres mg JOIN genres g ON g.id = mg.genre_id WHERE mg.movie_id = m.id
         ORDER BY g.id LIMIT 1) AS genre
FROM movies m
"""


def card(r):
    return {
        "id": r["id"], "tmdb_id": r["tmdb_id"], "title": r["title"], "year": r["year"],
        "date": r["release_date_de"] or r["release_date"], "runtime": r["runtime"], "fsk": r["fsk"],
        "vote": round(r["vote_average"], 1) if r["vote_average"] else None, "votes": r["vote_count"],
        "poster": poster_url(r), "wl": r["wl"], "seen": r["seen"], "my_rating": r["my_rating"],
        "genre": r["genre"], "manual": r["source"] == "manual",
    }


def cards(conn, where="1", params=(), order="m.popularity DESC", limit=20, offset=0):
    sql = f"{CARD_SQL} WHERE {where} ORDER BY {order} LIMIT ? OFFSET ?"
    return [card(r) for r in conn.execute(sql, (*params, limit, offset))]


def my_services(conn):
    try:
        return [int(x) for x in json.loads(db.get_setting(conn, "my_services", "[]") or "[]")]
    except (ValueError, TypeError):
        return []


def services_where(ids):
    if not ids:
        return "0", []
    q = ",".join("?" * len(ids))
    kinds = ",".join(f"'{k}'" for k in WATCH_KINDS)
    return (f"EXISTS (SELECT 1 FROM movie_providers mp WHERE mp.movie_id = m.id AND mp.kind IN ({kinds})"
            f" AND mp.provider_id IN ({q}))"), list(ids)


def hash_pin(pin, salt=None):
    salt = salt or secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(salt), 200_000).hex()
    return f"{salt}${h}"


def check_pin(stored, pin):
    try:
        salt, _ = stored.split("$", 1)
    except (ValueError, AttributeError):
        return False
    return hmac.compare_digest(hash_pin(pin, salt), stored)


def set_pin(conn, pin):
    if not pin or not re.fullmatch(r"\d{4,8}", str(pin)):
        raise ValueError("Die PIN muss aus 4 bis 8 Ziffern bestehen.")
    db.set_setting(conn, "pin_hash", hash_pin(str(pin)))
    db.set_setting(conn, "pin_enabled", "1")


def update_running():
    """True, wenn gerade ein Import/Update die Sperre hält (Timer, Knopf oder Befehl)."""
    import fcntl
    lock = config.DATA_DIR / "update.lock"
    if not lock.exists():
        return False
    try:
        with open(lock, "a+") as f:
            try:
                fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError:
                return True
            fcntl.flock(f, fcntl.LOCK_UN)
            return False
    except OSError:
        return False


# ======================================================================= API
class Api:
    def __init__(self, conn, handler):
        self.conn = conn
        self.h = handler

    # ------------------------------------------------------------ Lesen
    def home(self, q):
        c = self.conn
        rows = []
        cutoff = (datetime.now(timezone.utc) - timedelta(days=21)).isoformat()
        new = cards(c, "m.added_at >= ? AND m.source='tmdb' AND m.added_run_id IN (SELECT id FROM update_runs WHERE kind IN ('update','import','add'))",
                    (cutoff,), "m.added_at DESC, m.popularity DESC", 24)
        if new:
            rows.append({"key": "new", "title": "Neu dazugekommen", "link": "#/neu", "items": new})
        must = cards(c, "EXISTS (SELECT 1 FROM watchlist w WHERE w.movie_id=m.id) AND NOT EXISTS (SELECT 1 FROM views v WHERE v.movie_id=m.id)",
                     (), "(SELECT priority FROM watchlist w WHERE w.movie_id=m.id) DESC, (SELECT added_at FROM watchlist w WHERE w.movie_id=m.id) DESC", 20)
        if must:
            rows.append({"key": "watch", "title": "Auf deiner Merkliste", "link": "#/merkliste", "items": must})
        services = my_services(c)
        if services:
            w, p = services_where(services)
            items = cards(c, w, p, "(m.vote_average * (m.vote_count > 100)) DESC, m.popularity DESC", 24)
            if items:
                rows.append({"key": "mine", "title": "Auf deinen Streamingdiensten", "items": items})
        rows.append({"key": "now", "title": "Gerade im Kino",
                     "items": cards(c, "m.lists LIKE '%,now_playing,%'", (), "m.popularity DESC", 24)})
        rows.append({"key": "soon", "title": "Demnächst",
                     "items": cards(c, "m.lists LIKE '%,upcoming,%' OR (m.release_date > date('now') AND m.source='tmdb')", (),
                                    "COALESCE(m.release_date_de, m.release_date) ASC", 24)})
        focus = catalog.stored_focus(c) or {}
        for i, t in enumerate(focus.get("themes", [])):
            ids = t.get("ids") or []
            if not ids:
                continue
            q_ = ",".join("?" * len(ids))
            rows.append({"key": f"t{i}", "title": t["label"], "link": f"#/suche?thema={i}",
                         "items": cards(c, f"EXISTS (SELECT 1 FROM keywords k WHERE k.movie_id=m.id AND k.keyword_id IN ({q_}))",
                                        ids, "(m.vote_average * min(m.vote_count, 3000) / 3000.0 + m.popularity / 40.0) DESC", 24)})
        rows.append({"key": "top", "title": "Bestbewertet",
                     "items": cards(c, "m.vote_count >= 500", (), "m.vote_average DESC", 24)})
        rows.append({"key": "popular", "title": "Gerade beliebt",
                     "items": cards(c, "m.release_date <= date('now')", (), "m.popularity DESC", 24)})
        genres = c.execute(
            "SELECT g.id, g.name, COUNT(*) n FROM movie_genres mg JOIN genres g ON g.id=mg.genre_id"
            " GROUP BY g.id HAVING n >= 8 ORDER BY n DESC LIMIT 8"
        ).fetchall()
        for g in genres:
            rows.append({"key": f"g{g['id']}", "title": g["name"], "link": f"#/suche?genre={g['id']}",
                         "items": cards(c, "EXISTS (SELECT 1 FROM movie_genres mg WHERE mg.movie_id=m.id AND mg.genre_id=?)",
                                        (g["id"],), "(m.vote_average * min(m.vote_count, 2000) / 2000.0 + m.popularity / 50.0) DESC", 20)})
        rows.append({"key": "classic", "title": "Klassiker",
                     "items": cards(c, "m.year < 1990 AND m.vote_count >= 300", (), "m.vote_average DESC", 20)})
        return {"rows": [r for r in rows if r["items"]]}

    def search(self, q):
        c = self.conn
        where, params = ["1"], []
        text = (q.get("q") or "").strip()
        if text:
            f = f"%{db.fold(text)}%"
            where.append("(fold(m.title) LIKE ? OR fold(IFNULL(m.original_title,'')) LIKE ?"
                         " OR EXISTS (SELECT 1 FROM people p WHERE p.movie_id=m.id AND fold(p.name) LIKE ?))")
            params += [f, f, f]
        if q.get("genre"):
            where.append("EXISTS (SELECT 1 FROM movie_genres mg WHERE mg.movie_id=m.id AND mg.genre_id=?)")
            params.append(int(q["genre"]))
        if q.get("thema") not in (None, ""):
            themes = (catalog.stored_focus(c) or {}).get("themes", [])
            ti = int(q["thema"])
            if 0 <= ti < len(themes) and themes[ti].get("ids"):
                ids = themes[ti]["ids"]
                where.append(f"EXISTS (SELECT 1 FROM keywords k WHERE k.movie_id=m.id AND k.keyword_id IN ({','.join('?' * len(ids))}))")
                params += ids
        if q.get("year_from"):
            where.append("m.year >= ?"); params.append(int(q["year_from"]))
        if q.get("year_to"):
            where.append("m.year <= ?"); params.append(int(q["year_to"]))
        if q.get("rating_min"):
            where.append("m.vote_average >= ?"); params.append(float(q["rating_min"]))
        if q.get("fsk"):
            vals = [v for v in q["fsk"].split(",") if v]
            where.append(f"m.fsk IN ({','.join('?' * len(vals))})"); params += vals
        if q.get("runtime_max"):
            where.append("m.runtime > 0 AND m.runtime <= ?"); params.append(int(q["runtime_max"]))
        prov = q.get("provider")
        if prov == "mine":
            w, p = services_where(my_services(c))
            where.append(w); params += p
        elif prov:
            w, p = services_where([int(prov)])
            where.append(w); params += p
        order = {
            "rating": "(m.vote_count >= 50) DESC, m.vote_average DESC",
            "new": "COALESCE(m.release_date, '0000') DESC",
            "popular": "m.popularity DESC",
            "az": "fold(m.title) ASC",
        }.get(q.get("sort") or "", "m.popularity DESC")
        if text and not q.get("sort"):
            order = f"(fold(m.title) LIKE ?) DESC, (fold(m.title) LIKE ?) DESC, m.popularity DESC"
            params_order = [f"{db.fold(text)}%", f"%{db.fold(text)}%"]
        else:
            params_order = []
        w = " AND ".join(where)
        total = c.execute(f"SELECT COUNT(*) FROM movies m WHERE {w}", params).fetchone()[0]
        limit = min(int(q.get("limit") or 40), 100)
        offset = int(q.get("offset") or 0)
        sql = f"{CARD_SQL} WHERE {w} ORDER BY {order} LIMIT ? OFFSET ?"
        items = [card(r) for r in c.execute(sql, (*params, *params_order, limit, offset))]
        if text:
            # Hinweis, warum ein Film passt (Schauspieler/Regie)
            ft = db.fold(text)
            for it in items:
                if ft not in db.fold(it["title"]):
                    p = c.execute("SELECT name, role FROM people WHERE movie_id=? AND fold(name) LIKE ? LIMIT 1",
                                  (it["id"], f"%{ft}%")).fetchone()
                    if p:
                        it["match"] = ("Regie: " if p["role"] == "director" else "mit ") + p["name"]
        return {"total": total, "items": items, "offset": offset, "limit": limit}

    def meta(self, q):
        c = self.conn
        genres = [dict(r) for r in c.execute(
            "SELECT g.id, g.name, COUNT(mg.movie_id) AS n FROM genres g LEFT JOIN movie_genres mg ON mg.genre_id=g.id"
            " GROUP BY g.id ORDER BY g.name")]
        providers = []
        kinds = ",".join(f"'{k}'" for k in WATCH_KINDS)
        for r in c.execute(
            f"SELECT p.*, (SELECT COUNT(DISTINCT movie_id) FROM movie_providers mp WHERE mp.provider_id=p.id AND mp.kind IN ({kinds})) AS n"
            " FROM providers p ORDER BY n DESC, IFNULL(p.priority, 999) ASC"
        ):
            providers.append({"id": r["id"], "name": r["name"], "n": r["n"],
                              "logo": f"/img/{r['logo_local']}" if r["logo_local"] else (f"{TMDB_IMG}/w92{r['logo_path']}" if r["logo_path"] else None)})
        fsk = [r[0] for r in c.execute("SELECT DISTINCT fsk FROM movies WHERE fsk IS NOT NULL AND fsk <> ''")]
        fsk.sort(key=lambda x: int(x) if x.isdigit() else 99)
        yr = c.execute("SELECT MIN(year), MAX(year) FROM movies").fetchone()
        last = c.execute("SELECT * FROM update_runs WHERE kind IN ('update','initial') AND status <> 'running' ORDER BY id DESC LIMIT 1").fetchone()
        counts = catalog.catalog_counts(c)
        return {
            "genres": genres, "providers": providers, "fsk": fsk, "years": [yr[0], yr[1]],
            "my_services": my_services(c), "counts": counts, "limit": config.CATALOG_LIMIT,
            "last_update": dict(last) if last else None, "update_running": update_running(),
            "pin_enabled": db.get_setting(c, "pin_enabled") == "1", "tmdb": config.has_tmdb_credentials(),
            "themes": [t["label"] for t in (catalog.stored_focus(c) or {}).get("themes", [])],
        }

    def movie(self, q, mid):
        c = self.conn
        m = c.execute("SELECT * FROM movies WHERE id=?", (mid,)).fetchone()
        if not m:
            raise ApiError(404, "Film nicht gefunden")
        genres = [dict(r) for r in c.execute(
            "SELECT g.id, g.name FROM movie_genres mg JOIN genres g ON g.id=mg.genre_id WHERE mg.movie_id=? ORDER BY g.name", (mid,))]
        cast = [dict(r) for r in c.execute(
            "SELECT name, character, profile_path FROM people WHERE movie_id=? AND role='cast' ORDER BY ord", (mid,))]
        directors = [r["name"] for r in c.execute("SELECT name FROM people WHERE movie_id=? AND role='director' ORDER BY ord", (mid,))]
        trailers = [dict(r) for r in c.execute(
            "SELECT youtube_key AS key, name, lang, type, official, is_main FROM trailers WHERE movie_id=? ORDER BY is_main DESC, id", (mid,))]
        prov = {}
        mine = set(my_services(c))
        for r in c.execute(
            "SELECT mp.kind, p.id, p.name, p.logo_local, p.logo_path, p.priority FROM movie_providers mp"
            " JOIN providers p ON p.id=mp.provider_id WHERE mp.movie_id=? ORDER BY IFNULL(p.priority,999)", (mid,)
        ):
            prov.setdefault(r["kind"], []).append({
                "id": r["id"], "name": r["name"], "mine": r["id"] in mine,
                "logo": f"/img/{r['logo_local']}" if r["logo_local"] else (f"{TMDB_IMG}/w92{r['logo_path']}" if r["logo_path"] else None)})
        backdrop = None
        if m["backdrop_local"]:
            backdrop = f"/img/w1280/{m['backdrop_local'].split('/')[-1]}"
        elif m["backdrop_path"]:
            backdrop = f"{TMDB_IMG}/w1280{m['backdrop_path']}"
        wl = c.execute("SELECT * FROM watchlist WHERE movie_id=?", (mid,)).fetchone()
        rating = c.execute("SELECT * FROM ratings WHERE movie_id=?", (mid,)).fetchone()
        note = c.execute("SELECT * FROM notes WHERE movie_id=?", (mid,)).fetchone()
        views = [dict(r) for r in c.execute("SELECT id, watched_on FROM views WHERE movie_id=? ORDER BY watched_on DESC, id DESC", (mid,))]
        goofs = [dict(r) for r in c.execute("SELECT id, text, timecode, category, created_at FROM goofs WHERE movie_id=? ORDER BY "
                                            "CASE WHEN timecode IS NULL OR timecode='' THEN 1 ELSE 0 END, timecode, id", (mid,))]
        # Ähnliche: TMDB-Empfehlungen im Katalog, aufgefüllt mit Genre-Nachbarn
        similar = [card(r) for r in c.execute(
            f"{CARD_SQL} WHERE m.tmdb_id IN (SELECT tmdb_id FROM similar WHERE movie_id=?) "
            f"ORDER BY (SELECT ord FROM similar s WHERE s.movie_id=? AND s.tmdb_id=m.tmdb_id) LIMIT 12", (mid, mid))]
        if len(similar) < 12 and genres:
            have = {s["id"] for s in similar} | {mid}
            gids = [g["id"] for g in genres]
            extra = [card(r) for r in c.execute(
                f"{CARD_SQL} WHERE m.id <> ? AND (SELECT COUNT(*) FROM movie_genres mg WHERE mg.movie_id=m.id AND mg.genre_id IN ({','.join('?' * len(gids))})) > 0"
                f" ORDER BY (SELECT COUNT(*) FROM movie_genres mg WHERE mg.movie_id=m.id AND mg.genre_id IN ({','.join('?' * len(gids))})) DESC,"
                f" m.vote_average * min(m.vote_count, 1000) DESC LIMIT 30", (mid, *gids, *gids))]
            similar += [e for e in extra if e["id"] not in have][: 12 - len(similar)]
        return {
            "id": m["id"], "tmdb_id": m["tmdb_id"], "manual": m["source"] == "manual", "title": m["title"],
            "original_title": m["original_title"], "year": m["year"], "release_date": m["release_date"],
            "release_date_de": m["release_date_de"], "runtime": m["runtime"], "fsk": m["fsk"],
            "vote": round(m["vote_average"], 1) if m["vote_average"] else None, "votes": m["vote_count"],
            "overview": m["overview"], "overview_lang": m["overview_lang"], "tagline": m["tagline"],
            "poster": poster_url(m), "poster_big": poster_url(m, big=True), "backdrop": backdrop,
            "genres": genres, "directors": directors or ([m["director"]] if m["director"] else []), "cast": cast,
            "trailers": trailers, "providers": prov, "justwatch": m["justwatch_link"],
            "tmdb_url": f"https://www.themoviedb.org/movie/{m['tmdb_id']}" if m["tmdb_id"] else None,
            "updated_at": m["updated_at"],
            "my": {
                "wl": {"priority": wl["priority"], "added_at": wl["added_at"]} if wl else None,
                "rating": rating["rating"] if rating else None, "verdict": rating["verdict"] if rating else None,
                "note": note["text"] if note else "", "note_updated": note["updated_at"] if note else None,
                "views": views, "goofs": goofs,
            },
            "similar": similar,
        }

    def watchlist(self, q):
        c = self.conn
        where = ["EXISTS (SELECT 1 FROM watchlist w WHERE w.movie_id=m.id)"]
        params = []
        if q.get("mine") == "1":
            w, p = services_where(my_services(c))
            where.append(w); params += p
        if q.get("unseen") == "1":
            where.append("NOT EXISTS (SELECT 1 FROM views v WHERE v.movie_id=m.id)")
        order = {
            "priority": "wl DESC, wl_at DESC",
            "rating": "m.vote_average DESC",
            "title": "fold(m.title) ASC",
        }.get(q.get("sort") or "", "wl_at DESC")
        items = cards(c, " AND ".join(where), params, order, 1000)
        return {"items": items, "total": len(items)}

    def diary(self, q):
        c = self.conn
        rows = c.execute(
            f"SELECT v.id AS view_id, v.watched_on, x.*, "
            f" (SELECT verdict FROM ratings r WHERE r.movie_id=x.id) AS verdict,"
            f" (SELECT text FROM notes n WHERE n.movie_id=x.id) AS note,"
            f" (SELECT COUNT(*) FROM views v2 WHERE v2.movie_id=v.movie_id AND (v2.watched_on < v.watched_on OR (v2.watched_on = v.watched_on AND v2.id < v.id))) + 1 AS nth"
            f" FROM views v JOIN ({CARD_SQL}) x ON x.id = v.movie_id ORDER BY v.watched_on DESC, v.id DESC"
        ).fetchall()
        groups = []
        for r in rows:
            ym = r["watched_on"][:7]
            if not groups or groups[-1]["month"] != ym:
                y, mo = ym.split("-")
                groups.append({"month": ym, "label": f"{MONTHS[int(mo) - 1]} {y}", "items": []})
            item = card(r)
            note = (r["note"] or "").strip()
            item.update({"view_id": r["view_id"], "watched_on": r["watched_on"], "nth": r["nth"],
                         "verdict": r["verdict"], "note": (note[:140] + "…") if len(note) > 140 else note})
            groups[-1]["items"].append(item)
        return {"groups": groups, "total": len(rows)}

    def new(self, q):
        c = self.conn
        runs = c.execute(
            "SELECT * FROM update_runs WHERE kind IN ('update','import','add','initial') AND"
            " EXISTS (SELECT 1 FROM movies m WHERE m.added_run_id = update_runs.id) ORDER BY id DESC LIMIT 10"
        ).fetchall()
        out = []
        labels = {"update": "Tägliches Update", "import": "Import", "add": "Hinzugefügt", "initial": "Erst-Import"}
        for r in runs:
            items = cards(c, "m.added_run_id=?", (r["id"],), "m.popularity DESC", 200 if r["kind"] != "initial" else 60)
            out.append({"run": r["id"], "kind": r["kind"], "label": labels.get(r["kind"], r["kind"]),
                        "date": r["started_at"], "count": c.execute("SELECT COUNT(*) FROM movies WHERE added_run_id=?", (r["id"],)).fetchone()[0],
                        "items": items})
        return {"runs": out}

    def stats(self, q):
        c = self.conn
        year = str(date.today().year)
        views = c.execute("SELECT v.watched_on, m.runtime, m.id FROM views v JOIN movies m ON m.id=v.movie_id").fetchall()
        y_views = [v for v in views if v["watched_on"].startswith(year)]
        minutes_year = sum(v["runtime"] or 0 for v in y_views)
        minutes_all = sum(v["runtime"] or 0 for v in views)
        genres = [dict(r) for r in c.execute(
            "SELECT g.name, COUNT(DISTINCT mg.movie_id) AS n FROM movie_genres mg JOIN genres g ON g.id=mg.genre_id"
            " WHERE mg.movie_id IN (SELECT movie_id FROM views) GROUP BY g.id ORDER BY n DESC LIMIT 6")]
        avg = c.execute("SELECT AVG(rating), COUNT(*) FROM ratings WHERE rating IS NOT NULL").fetchone()
        months = []
        for i in range(11, -1, -1):
            d = date.today().replace(day=1)
            y, mo = d.year, d.month - i
            while mo <= 0:
                mo += 12; y -= 1
            key = f"{y}-{mo:02d}"
            months.append({"month": key, "label": MONTHS[mo - 1][:3], "n": sum(1 for v in views if v["watched_on"].startswith(key))})
        best = cards(c, "EXISTS (SELECT 1 FROM ratings r WHERE r.movie_id=m.id AND r.rating >= 8)", (), "my_rating DESC", 12)
        verdicts = {r["verdict"]: r["n"] for r in c.execute("SELECT verdict, COUNT(*) n FROM ratings WHERE verdict IS NOT NULL GROUP BY verdict")}
        return {
            "year": int(year), "films_year": len({v["id"] for v in y_views}), "views_year": len(y_views),
            "hours_year": round(minutes_year / 60, 1), "views_all": len(views), "films_all": len({v["id"] for v in views}),
            "hours_all": round(minutes_all / 60, 1), "genres": genres,
            "avg_rating": round(avg[0], 1) if avg[0] else None, "rated": avg[1], "months": months, "best": best,
            "watchlist": c.execute("SELECT COUNT(*) FROM watchlist").fetchone()[0],
            "goofs": c.execute("SELECT COUNT(*) FROM goofs").fetchone()[0], "verdicts": verdicts,
        }

    def update_status(self, q):
        c = self.conn
        runs = [dict(r) for r in c.execute("SELECT * FROM update_runs ORDER BY id DESC LIMIT 8")]
        return {"running": update_running(), "runs": runs, "counts": catalog.catalog_counts(c),
                "limit": config.CATALOG_LIMIT, "backups": backup.list_backups()[:14]}

    # ------------------------------------------------------------ Schreiben
    def _movie_exists(self, mid):
        if not self.conn.execute("SELECT 1 FROM movies WHERE id=?", (mid,)).fetchone():
            raise ApiError(404, "Film nicht gefunden")

    def set_watchlist(self, body, mid):
        self._movie_exists(mid)
        prio = 1 if body.get("priority") in (1, "1", True, "unbedingt") else 0
        added_at = body.get("added_at") or db.now_iso()
        self.conn.execute(
            "INSERT INTO watchlist(movie_id, priority, added_at) VALUES(?,?,?)"
            " ON CONFLICT(movie_id) DO UPDATE SET priority=excluded.priority", (mid, prio, added_at))
        return {"ok": True, "wl": {"priority": prio, "added_at": added_at}}

    def del_watchlist(self, body, mid):
        row = self.conn.execute("SELECT * FROM watchlist WHERE movie_id=?", (mid,)).fetchone()
        self.conn.execute("DELETE FROM watchlist WHERE movie_id=?", (mid,))
        return {"ok": True, "previous": dict(row) if row else None}

    def add_view(self, body, mid):
        self._movie_exists(mid)
        d = (body.get("date") or date.today().isoformat())[:10]
        try:
            date.fromisoformat(d)
        except ValueError:
            raise ApiError(400, "Ungültiges Datum")
        cur = self.conn.execute("INSERT INTO views(movie_id, watched_on, created_at) VALUES(?,?,?)", (mid, d, db.now_iso()))
        return {"ok": True, "view": {"id": cur.lastrowid, "watched_on": d}}

    def edit_view(self, body, vid):
        d = (body.get("date") or "")[:10]
        try:
            date.fromisoformat(d)
        except ValueError:
            raise ApiError(400, "Ungültiges Datum")
        self.conn.execute("UPDATE views SET watched_on=? WHERE id=?", (d, vid))
        return {"ok": True}

    def del_view(self, body, vid):
        row = self.conn.execute("SELECT * FROM views WHERE id=?", (vid,)).fetchone()
        self.conn.execute("DELETE FROM views WHERE id=?", (vid,))
        return {"ok": True, "previous": dict(row) if row else None}

    def set_rating(self, body, mid):
        self._movie_exists(mid)
        rating = body.get("rating")
        verdict = body.get("verdict")
        if rating is not None:
            rating = float(rating)
            if not (1 <= rating <= 10) or (rating * 2) % 1:
                raise ApiError(400, "Bewertung 1–10 in halben Schritten")
        if verdict is not None and verdict not in VERDICTS:
            raise ApiError(400, "Ungültiges Fazit")
        if rating is None and verdict is None:
            self.conn.execute("DELETE FROM ratings WHERE movie_id=?", (mid,))
        else:
            self.conn.execute(
                "INSERT INTO ratings(movie_id, rating, verdict, updated_at) VALUES(?,?,?,?)"
                " ON CONFLICT(movie_id) DO UPDATE SET rating=excluded.rating, verdict=excluded.verdict, updated_at=excluded.updated_at",
                (mid, rating, verdict, db.now_iso()))
        return {"ok": True, "rating": rating, "verdict": verdict}

    def set_note(self, body, mid):
        self._movie_exists(mid)
        text = str(body.get("text") or "")[:20000]
        now = db.now_iso()
        self.conn.execute(
            "INSERT INTO notes(movie_id, text, updated_at) VALUES(?,?,?)"
            " ON CONFLICT(movie_id) DO UPDATE SET text=excluded.text, updated_at=excluded.updated_at", (mid, text, now))
        return {"ok": True, "updated_at": now}

    def _goof_fields(self, body):
        text = str(body.get("text") or "").strip()[:2000]
        if not text:
            raise ApiError(400, "Bitte beschreibe den Fehler.")
        tc = str(body.get("timecode") or "").strip()
        if tc:
            m = re.fullmatch(r"(?:(\d{1,2}):)?(\d{1,2}):(\d{2})", tc)
            if not m:
                raise ApiError(400, "Zeitstempel bitte als 01:12:30 oder 12:30")
            h, mi, s = int(m.group(1) or 0), int(m.group(2)), int(m.group(3))
            if m.group(1) is None and mi > 59:   # "72:30" = 72 Minuten
                h, mi = divmod(mi, 60)
            if mi > 59 or s > 59:
                raise ApiError(400, "Ungültiger Zeitstempel")
            tc = f"{h:02d}:{mi:02d}:{s:02d}"
        cat = body.get("category") or "sonstiges"
        if cat not in GOOF_CATS:
            raise ApiError(400, "Ungültige Kategorie")
        return text, tc or None, cat

    def add_goof(self, body, mid):
        self._movie_exists(mid)
        text, tc, cat = self._goof_fields(body)
        now = db.now_iso()
        cur = self.conn.execute(
            "INSERT INTO goofs(movie_id, text, timecode, category, created_at, updated_at) VALUES(?,?,?,?,?,?)",
            (mid, text, tc, cat, body.get("created_at") or now, now))
        return {"ok": True, "goof": {"id": cur.lastrowid, "text": text, "timecode": tc, "category": cat}}

    def edit_goof(self, body, gid):
        text, tc, cat = self._goof_fields(body)
        self.conn.execute("UPDATE goofs SET text=?, timecode=?, category=?, updated_at=? WHERE id=?",
                          (text, tc, cat, db.now_iso(), gid))
        return {"ok": True, "goof": {"id": gid, "text": text, "timecode": tc, "category": cat}}

    def del_goof(self, body, gid):
        row = self.conn.execute("SELECT * FROM goofs WHERE id=?", (gid,)).fetchone()
        self.conn.execute("DELETE FROM goofs WHERE id=?", (gid,))
        return {"ok": True, "previous": dict(row) if row else None}

    def settings_put(self, body):
        if "my_services" in body:
            ids = [int(x) for x in body["my_services"] or []]
            db.set_setting(self.conn, "my_services", json.dumps(ids))
        return {"ok": True, "my_services": my_services(self.conn)}

    def pin_put(self, body):
        c = self.conn
        if body.get("enabled") is False:
            if db.get_setting(c, "pin_enabled") == "1":
                if not check_pin(db.get_setting(c, "pin_hash"), str(body.get("current") or "")):
                    raise ApiError(403, "Aktuelle PIN stimmt nicht.")
            db.set_setting(c, "pin_enabled", "0")
            return {"ok": True, "pin_enabled": False}
        if db.get_setting(c, "pin_enabled") == "1":
            if not check_pin(db.get_setting(c, "pin_hash"), str(body.get("current") or "")):
                raise ApiError(403, "Aktuelle PIN stimmt nicht.")
        try:
            set_pin(c, str(body.get("pin") or ""))
        except ValueError as e:
            raise ApiError(400, str(e))
        token = self.h.new_session()
        return {"ok": True, "pin_enabled": True, "_cookie": token}

    def tmdb_search(self, q):
        api = TMDB()
        if not api.configured:
            raise ApiError(503, "Kein TMDB-Key eingerichtet (.env).")
        text = (q.get("q") or "").strip()
        if not text:
            return {"items": []}
        try:
            res = api.search(text, year=q.get("year") or None).get("results", [])[:20]
        except TMDBError as e:
            raise ApiError(502, str(e))
        out = []
        for r in res:
            have = self.conn.execute("SELECT id FROM movies WHERE tmdb_id=?", (r["id"],)).fetchone()
            out.append({"tmdb_id": r["id"], "title": r.get("title"), "year": (r.get("release_date") or "")[:4] or None,
                        "vote": round(r.get("vote_average") or 0, 1), "overview": (r.get("overview") or "")[:200],
                        "poster": f"{TMDB_IMG}/w185{r['poster_path']}" if r.get("poster_path") else None,
                        "id": have["id"] if have else None})
        return {"items": out}

    def tmdb_add(self, body):
        api = TMDB()
        if not api.configured:
            raise ApiError(503, "Kein TMDB-Key eingerichtet (.env).")
        tid = int(body.get("tmdb_id") or 0)
        if not tid:
            raise ApiError(400, "tmdb_id fehlt")
        run_id = catalog.start_run(self.conn, "add")
        try:
            mid, is_new = catalog.fetch_and_save(self.conn, api, tid, run_id=run_id, keep=True)
        except TMDBError as e:
            catalog.finish_run(self.conn, run_id, errors=1, status="error", message=str(e))
            raise ApiError(502, str(e))
        catalog.finish_run(self.conn, run_id, added=int(is_new))
        return {"ok": True, "id": mid, "new": is_new}

    def _save_cover(self, data_url):
        m = re.match(r"data:image/(jpeg|jpg|png|webp);base64,(.+)$", data_url or "", re.S)
        if not m:
            raise ApiError(400, "Cover muss ein Bild (JPG/PNG/WebP) sein.")
        raw = base64.b64decode(m.group(2))
        if len(raw) > 8 * 1024 * 1024:
            raise ApiError(413, "Bild zu groß (max. 8 MB).")
        ext = "jpg" if m.group(1) in ("jpeg", "jpg") else m.group(1)
        name = f"cover-{secrets.token_hex(8)}.{ext}"
        config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        (config.UPLOAD_DIR / name).write_bytes(raw)
        return name

    def manual_add(self, body):
        title = str(body.get("title") or "").strip()[:300]
        if not title:
            raise ApiError(400, "Titel fehlt")
        year = int(body["year"]) if str(body.get("year") or "").isdigit() else None
        runtime = int(body["runtime"]) if str(body.get("runtime") or "").isdigit() else None
        cover = self._save_cover(body["cover"]) if body.get("cover") else None
        genres = [int(g) for g in body.get("genres") or []]
        mid = catalog.add_manual(self.conn, title, year, (body.get("overview") or "").strip() or None, runtime,
                                 (body.get("director") or "").strip() or None, cover, genres)
        return {"ok": True, "id": mid}

    def manual_edit(self, body, mid):
        row = self.conn.execute("SELECT * FROM movies WHERE id=? AND source='manual'", (mid,)).fetchone()
        if not row:
            raise ApiError(404, "Nur eigene Filme können bearbeitet werden.")
        title = str(body.get("title") or row["title"]).strip()[:300]
        year = int(body["year"]) if str(body.get("year") or "").isdigit() else None
        runtime = int(body["runtime"]) if str(body.get("runtime") or "").isdigit() else None
        cover = row["poster_local"]
        if body.get("cover"):
            cover = self._save_cover(body["cover"])
            if row["poster_local"]:
                (config.UPLOAD_DIR / row["poster_local"]).unlink(missing_ok=True)
        with db.tx(self.conn):
            self.conn.execute(
                "UPDATE movies SET title=?, year=?, release_date=?, runtime=?, overview=?, director=?, poster_local=?, updated_at=? WHERE id=?",
                (title, year, f"{year}-01-01" if year else None, runtime, (body.get("overview") or "").strip() or None,
                 (body.get("director") or "").strip() or None, cover, db.now_iso(), mid))
            if "genres" in body:
                self.conn.execute("DELETE FROM movie_genres WHERE movie_id=?", (mid,))
                for g in body["genres"] or []:
                    self.conn.execute("INSERT OR IGNORE INTO movie_genres(movie_id, genre_id) VALUES(?,?)", (mid, int(g)))
        return {"ok": True, "id": mid}

    def manual_delete(self, body, mid):
        row = self.conn.execute("SELECT * FROM movies WHERE id=? AND source='manual'", (mid,)).fetchone()
        if not row:
            raise ApiError(404, "Nur eigene Filme können gelöscht werden.")
        backup.backup_db(self.conn)  # sicher ist sicher
        self.conn.execute("DELETE FROM movies WHERE id=?", (mid,))
        if row["poster_local"]:
            (config.UPLOAD_DIR / row["poster_local"]).unlink(missing_ok=True)
        return {"ok": True}

    def run_update(self, body):
        if update_running():
            return {"ok": True, "running": True, "already": True}
        if not config.has_tmdb_credentials():
            raise ApiError(503, "Kein TMDB-Key eingerichtet (.env).")
        log = open(config.LOG_DIR / "update-web.log", "ab")
        subprocess.Popen([sys.executable, str(config.APP_DIR / "kino.py"), "update", "--leise"],
                         cwd=str(config.APP_DIR), stdout=log, stderr=log, start_new_session=True)
        time.sleep(0.3)
        return {"ok": True, "running": True}

    def make_backup(self, body):
        p = backup.backup_db(self.conn)
        return {"ok": True, "file": p.name, "backups": backup.list_backups()[:14]}

    def import_json(self, body):
        if not isinstance(body, dict):
            raise ApiError(400, "Ungültige Datei")
        backup.backup_db(self.conn)  # vor dem Import sichern
        api = TMDB()
        try:
            res = backup.import_data(self.conn, body, api=api if api.configured else None,
                                     replace=bool(self.h.query.get("replace") == "1"))
        except ValueError as e:
            raise ApiError(400, str(e))
        return {"ok": True, **res}


# ================================================================ Routing
ROUTES = [
    ("GET", r"/api/home", "home"),
    ("GET", r"/api/search", "search"),
    ("GET", r"/api/meta", "meta"),
    ("GET", r"/api/movie/(\d+)", "movie"),
    ("GET", r"/api/watchlist", "watchlist"),
    ("GET", r"/api/diary", "diary"),
    ("GET", r"/api/new", "new"),
    ("GET", r"/api/stats", "stats"),
    ("GET", r"/api/update", "update_status"),
    ("GET", r"/api/tmdb/search", "tmdb_search"),
    ("POST", r"/api/movie/(\d+)/watchlist", "set_watchlist"),
    ("DELETE", r"/api/movie/(\d+)/watchlist", "del_watchlist"),
    ("POST", r"/api/movie/(\d+)/views", "add_view"),
    ("PUT", r"/api/views/(\d+)", "edit_view"),
    ("DELETE", r"/api/views/(\d+)", "del_view"),
    ("PUT", r"/api/movie/(\d+)/rating", "set_rating"),
    ("PUT", r"/api/movie/(\d+)/note", "set_note"),
    ("POST", r"/api/movie/(\d+)/goofs", "add_goof"),
    ("PUT", r"/api/goofs/(\d+)", "edit_goof"),
    ("DELETE", r"/api/goofs/(\d+)", "del_goof"),
    ("PUT", r"/api/settings", "settings_put"),
    ("PUT", r"/api/pin", "pin_put"),
    ("POST", r"/api/tmdb/add", "tmdb_add"),
    ("POST", r"/api/manual", "manual_add"),
    ("PUT", r"/api/manual/(\d+)", "manual_edit"),
    ("DELETE", r"/api/manual/(\d+)", "manual_delete"),
    ("POST", r"/api/update", "run_update"),
    ("POST", r"/api/backup", "make_backup"),
    ("POST", r"/api/import", "import_json"),
]
ROUTES = [(m, re.compile(f"^{p}$"), fn) for m, p, fn in ROUTES]


class Handler(BaseHTTPRequestHandler):
    server_version = "AuraKino"
    sys_version = ""
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        if os.environ.get("AURA_ACCESS_LOG"):
            sys.stderr.write("%s - %s\n" % (self.client_address[0], fmt % args))

    # ------------------------------------------------------------ Antworten
    def _send(self, status, body=b"", ctype="application/json; charset=utf-8", headers=None, compress=True):
        if compress and len(body) > 1024 and "gzip" in (self.headers.get("Accept-Encoding") or "") \
                and ctype.split(";")[0] in ("application/json", "text/html", "text/css", "application/javascript",
                                            "image/svg+xml", "application/manifest+json"):
            body = gzip.compress(body, 6)
            headers = dict(headers or {}, **{"Content-Encoding": "gzip", "Vary": "Accept-Encoding"})
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, obj, status=200, headers=None):
        self._send(status, json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
                   headers=dict({"Cache-Control": "no-store"}, **(headers or {})))

    def _error(self, status, msg):
        self._json({"error": msg}, status)

    # ------------------------------------------------------------ Sicherheit
    def _client_allowed(self):
        try:
            ip = ipaddress.ip_address(self.client_address[0])
        except ValueError:
            return False
        if getattr(ip, "ipv4_mapped", None):
            ip = ip.ipv4_mapped
        return any(ip in n for n in ALLOWED)

    def _session(self):
        c = SimpleCookie(self.headers.get("Cookie") or "")
        return c["aura_s"].value if "aura_s" in c else None

    def new_session(self):
        token = secrets.token_urlsafe(32)
        exp = (datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)).isoformat()
        self.conn.execute("INSERT INTO sessions(token, created_at, expires_at) VALUES(?,?,?)", (token, db.now_iso(), exp))
        self.conn.execute("DELETE FROM sessions WHERE expires_at < ?", (db.now_iso(),))
        return token

    def _cookie_header(self, token):
        return f"aura_s={token}; Path=/; Max-Age={SESSION_DAYS * 86400}; HttpOnly; SameSite=Strict"

    def _authed(self):
        if db.get_setting(self.conn, "pin_enabled") != "1":
            return True
        tok = self._session()
        if not tok:
            return False
        row = self.conn.execute("SELECT expires_at FROM sessions WHERE token=?", (tok,)).fetchone()
        return bool(row and row["expires_at"] > db.now_iso())

    # ------------------------------------------------------------ Dispatch
    def do_GET(self):
        self._handle()

    def do_HEAD(self):
        self._handle()

    def do_POST(self):
        self._handle()

    def do_PUT(self):
        self._handle()

    def do_DELETE(self):
        self._handle()

    def _handle(self):
        if not self._client_allowed():
            return self._send(403, b"Nur im Heimnetz/Tailscale erreichbar.", "text/plain; charset=utf-8")
        u = urllib.parse.urlsplit(self.path)
        self.query = {k: v[-1] for k, v in urllib.parse.parse_qs(u.query).items()}
        path = urllib.parse.unquote(u.path)
        self.conn = None
        try:
            if path.startswith("/api/"):
                self.conn = db.connect()
                return self._api(path)
            if self.command not in ("GET", "HEAD"):
                return self._error(405, "Methode nicht erlaubt")
            return self._static(path)
        except ApiError as e:
            self._error(e.status, e.msg)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:  # noqa
            traceback.print_exc()
            try:
                self._error(500, f"Serverfehler: {e}")
            except Exception:
                pass
        finally:
            if self.conn is not None:
                self.conn.close()

    def _read_body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            raise ApiError(413, "Zu groß")
        if not n:
            return {}
        raw = self.rfile.read(n)
        try:
            return json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            raise ApiError(400, "Ungültiges JSON")

    def _api(self, path):
        c = self.conn
        # ---- Anmeldung (immer erlaubt)
        if path == "/api/auth":
            if self.command == "GET":
                return self._json({"pin_enabled": db.get_setting(c, "pin_enabled") == "1", "authed": self._authed()})
            if self.command == "POST":
                body = self._read_body()
                with _fail_lock:
                    if time.time() < _fail["until"]:
                        raise ApiError(429, f"Zu viele Versuche. Bitte {int(_fail['until'] - time.time()) + 1} s warten.")
                if check_pin(db.get_setting(c, "pin_hash"), str(body.get("pin") or "")):
                    with _fail_lock:
                        _fail["count"] = 0
                    tok = self.new_session()
                    return self._json({"ok": True}, headers={"Set-Cookie": self._cookie_header(tok)})
                with _fail_lock:
                    _fail["count"] += 1
                    if _fail["count"] >= 5:
                        _fail["until"] = time.time() + 30 * (2 ** min(_fail["count"] - 5, 6))
                time.sleep(0.6)
                raise ApiError(403, "Falsche PIN")
            if self.command == "DELETE":
                tok = self._session()
                if tok:
                    c.execute("DELETE FROM sessions WHERE token=?", (tok,))
                return self._json({"ok": True}, headers={"Set-Cookie": "aura_s=; Path=/; Max-Age=0"})
        if not self._authed():
            raise ApiError(401, "PIN erforderlich")
        if path == "/api/export" and self.command == "GET":
            data = backup.export_data(c)
            body = json.dumps(data, ensure_ascii=False, indent=1).encode("utf-8")
            name = f"aura-kino-{date.today().isoformat()}.json"
            return self._send(200, body, "application/json; charset=utf-8",
                              {"Content-Disposition": f'attachment; filename="{name}"', "Cache-Control": "no-store"})
        api = Api(c, self)
        for method, rx, fn in ROUTES:
            if method != (self.command if self.command != "HEAD" else "GET"):
                continue
            m = rx.match(path)
            if not m:
                continue
            args = [int(x) for x in m.groups()]
            if method == "GET":
                res = getattr(api, fn)(self.query, *args)
            else:
                res = getattr(api, fn)(self._read_body(), *args)
            headers = {}
            if isinstance(res, dict) and "_cookie" in res:
                headers["Set-Cookie"] = self._cookie_header(res.pop("_cookie"))
            return self._json(res, headers=headers)
        raise ApiError(404, "Unbekannter API-Pfad")

    # ------------------------------------------------------------ Dateien
    def _file(self, base: Path, rel: str, cache: str):
        base = base.resolve()
        target = (base / rel.lstrip("/")).resolve()
        if base not in target.parents and target != base:
            return self._send(404, b"", "text/plain")
        if not target.is_file():
            return self._send(404, b"Nicht gefunden", "text/plain; charset=utf-8")
        st = target.stat()
        etag = f'"{int(st.st_mtime)}-{st.st_size}"'
        if self.headers.get("If-None-Match") == etag:
            self.send_response(304)
            self.send_header("ETag", etag)
            self.send_header("Cache-Control", cache)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if target.suffix == ".js":
            ctype = "application/javascript"
        elif target.suffix == ".webmanifest" or target.name == "manifest.json":
            ctype = "application/manifest+json"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/manifest+json", "image/svg+xml"):
            ctype += "; charset=utf-8"
        headers = {"Cache-Control": cache, "ETag": etag}
        if target.name == "index.html":
            headers["Content-Security-Policy"] = (
                "default-src 'self'; img-src 'self' data: blob: https://image.tmdb.org https://i.ytimg.com; "
                "frame-src https://www.youtube-nocookie.com; style-src 'self' 'unsafe-inline'; script-src 'self'; "
                "connect-src 'self'; font-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'")
        if target.name == "sw.js":
            headers["Service-Worker-Allowed"] = "/"
        self._send(200, target.read_bytes(), ctype, headers)

    def _static(self, path):
        if path.startswith("/img/"):
            return self._file(config.IMAGE_DIR, path[5:], "public, max-age=2592000, immutable")
        if path.startswith("/uploads/"):
            return self._file(config.UPLOAD_DIR, path[9:], "public, max-age=2592000, immutable")
        if path in ("/", "/index.html"):
            return self._file(config.WEB_DIR, "index.html", "no-cache")
        if path in ("/sw.js", "/manifest.json"):
            return self._file(config.WEB_DIR, path, "no-cache")
        if path.startswith("/static/"):
            return self._file(config.WEB_DIR, path[8:], "no-cache")
        # SPA-Fallback
        return self._file(config.WEB_DIR, "index.html", "no-cache")


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class DualStackServer(Server):
    address_family = __import__("socket").AF_INET6

    def server_bind(self):
        import socket
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except OSError:
            pass
        super().server_bind()


def main(host=None, port=None):
    host = host or config.HOST
    port = port or config.PORT
    config.ensure_dirs()
    db.init(db.connect()).close()
    if host in ("0.0.0.0", "::"):
        try:
            httpd = DualStackServer(("::", port), Handler)
        except OSError:
            httpd = Server(("0.0.0.0", port), Handler)
    else:
        httpd = Server((host, port), Handler)
    print(f"AURA KINO läuft auf http://{host}:{port}  (Daten: {config.DATA_DIR})", flush=True)
    if not config.has_tmdb_credentials():
        print("Hinweis: Kein TMDB-Key in der .env – Suche bei TMDB und Updates sind deaktiviert.", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
