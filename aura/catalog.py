"""Katalog-Logik: Film speichern, Erst-Import, tägliches Update, Obergrenze."""
import json
import logging
import math
import sys
from datetime import date, datetime, timedelta, timezone

from . import config, db, images
from .tmdb import TMDB, TMDBError

log = logging.getLogger("aura")

PROVIDER_KINDS = ("flatrate", "free", "ads", "rent", "buy")
IMPORT_PROTECT_DAYS = 90


def setup_logging(verbose=True):
    config.ensure_dirs()
    if log.handlers:
        return
    log.setLevel(logging.INFO)
    logfile = config.LOG_DIR / "update.log"
    try:  # einfache Rotation bei > 5 MB
        if logfile.exists() and logfile.stat().st_size > 5 * 1024 * 1024:
            logfile.replace(logfile.with_suffix(".log.1"))
    except OSError:
        pass
    fh = logging.FileHandler(logfile, encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s", "%Y-%m-%d %H:%M:%S"))
    log.addHandler(fh)
    if verbose:
        sh = logging.StreamHandler(sys.stderr)
        sh.setLevel(logging.WARNING)
        sh.setFormatter(logging.Formatter("%(levelname)s %(message)s"))
        log.addHandler(sh)


# ====================================================================== Parsing
def _pick_fsk(release_dates):
    for country in (release_dates or {}).get("results", []):
        if country.get("iso_3166_1") != config.REGION:
            continue
        entries = country.get("release_dates", [])
        # Kino (3) bevorzugt, dann limitiert (2), digital (4), physisch (5), TV (6), Premiere (1)
        order = {3: 0, 2: 1, 4: 2, 5: 3, 6: 4, 1: 5}
        best_cert, best_date = None, None
        for e in sorted(entries, key=lambda x: order.get(x.get("type"), 9)):
            cert = (e.get("certification") or "").strip()
            if cert and best_cert is None:
                best_cert = cert
            if e.get("type") in (2, 3) and best_date is None and e.get("release_date"):
                best_date = e["release_date"][:10]
        return best_cert, best_date
    return None, None


def _trailer_score(v):
    lang = (v.get("iso_639_1") or "").lower()
    score = 0
    score += {"de": 300, "en": 100}.get(lang, 0)
    score += {"Trailer": 50, "Teaser": 20}.get(v.get("type"), 0)
    score += 25 if v.get("official") else 0
    score += min(int(v.get("size") or 0), 2160) / 1000.0
    pub = v.get("published_at") or ""
    score += (int(pub[:4]) - 2000) / 100.0 if pub[:4].isdigit() else 0
    return score


def pick_trailers(videos):
    items = [
        v for v in (videos or {}).get("results", [])
        if v.get("site") == "YouTube" and v.get("key") and v.get("type") in ("Trailer", "Teaser")
        and (v.get("iso_639_1") or "").lower() in ("de", "en", "")
    ]
    items.sort(key=_trailer_score, reverse=True)
    seen, out = set(), []
    for v in items:
        if v["key"] in seen:
            continue
        seen.add(v["key"])
        out.append(v)
    return out[:8]


def _english_overview(data):
    for t in (data.get("translations") or {}).get("translations", []):
        if t.get("iso_639_1") == "en":
            ov = (t.get("data") or {}).get("overview") or ""
            if ov.strip():
                return ov.strip()
    return ""


def _english_title(data):
    for t in (data.get("translations") or {}).get("translations", []):
        if t.get("iso_639_1") == "en" and t.get("iso_3166_1") == "US":
            return ((t.get("data") or {}).get("title") or "").strip()
    return ""


def parse_movie(data):
    """TMDB-Antwort -> flaches dict + Unterlisten."""
    rd = data.get("release_date") or ""
    fsk, rd_de = _pick_fsk(data.get("release_dates"))
    overview = (data.get("overview") or "").strip()
    overview_lang = "de"
    if not overview:
        overview = _english_overview(data)
        overview_lang = "en" if overview else None
    credits = data.get("credits") or {}
    directors = [c for c in credits.get("crew", []) if c.get("job") == "Director"]
    cast = sorted(credits.get("cast", []), key=lambda c: c.get("order", 999))[:5]
    wp = ((data.get("watch/providers") or {}).get("results") or {}).get(config.REGION) or {}
    providers = []
    for kind in PROVIDER_KINDS:
        for p in wp.get(kind, []) or []:
            providers.append((kind, p))
    return {
        "tmdb_id": data["id"],
        "title": (data.get("title") or _english_title(data) or data.get("original_title") or "Ohne Titel").strip(),
        "original_title": data.get("original_title"),
        "year": int(rd[:4]) if rd[:4].isdigit() else None,
        "release_date": rd or None,
        "release_date_de": rd_de,
        "runtime": data.get("runtime") or None,
        "fsk": fsk,
        "vote_average": data.get("vote_average"),
        "vote_count": data.get("vote_count"),
        "popularity": data.get("popularity"),
        "overview": overview,
        "overview_lang": overview_lang,
        "tagline": (data.get("tagline") or "").strip() or None,
        "director": ", ".join(d["name"] for d in directors) or None,
        "poster_path": data.get("poster_path"),
        "backdrop_path": data.get("backdrop_path"),
        "justwatch_link": wp.get("link"),
        "_genres": data.get("genres") or [],
        "_directors": directors,
        "_cast": cast,
        "_trailers": pick_trailers(data.get("videos")),
        "_providers": providers,
        "_keywords": (data.get("keywords") or {}).get("keywords", []),
        "_similar": [r["id"] for r in (data.get("recommendations") or {}).get("results", [])][:20],
    }


# ======================================================================= Speichern
MOVIE_FIELDS = (
    "title", "original_title", "year", "release_date", "release_date_de", "runtime", "fsk",
    "vote_average", "vote_count", "popularity", "overview", "overview_lang", "tagline", "director",
    "poster_path", "backdrop_path", "justwatch_link",
)


def save_movie(conn, m, run_id=None, keep=False, download_images=None):
    """Legt einen Film an oder aktualisiert ihn. Gibt (movie_id, neu?) zurück."""
    if download_images is None:
        download_images = config.DOWNLOAD_IMAGES
    poster_local = backdrop_local = None
    if download_images:
        poster_local, backdrop_local = images.cache_movie_images(m["poster_path"], m["backdrop_path"])
        logo_paths = {p.get("provider_id"): p.get("logo_path") for _, p in m["_providers"]}
    else:
        logo_paths = {}
    logos = {pid: images.download(images.LOGO_SIZE, lp) for pid, lp in logo_paths.items() if lp}

    now = db.now_iso()
    with db.tx(conn):
        row = conn.execute("SELECT id, poster_path, backdrop_path FROM movies WHERE tmdb_id=?", (m["tmdb_id"],)).fetchone()
        values = [m[f] for f in MOVIE_FIELDS]
        if row:
            movie_id, is_new = row["id"], False
            sets = ", ".join(f"{f}=?" for f in MOVIE_FIELDS)
            conn.execute(
                f"UPDATE movies SET {sets}, updated_at=?, poster_local=COALESCE(?, poster_local),"
                f" backdrop_local=COALESCE(?, backdrop_local), keep=MAX(keep, ?) WHERE id=?",
                values + [now, poster_local, backdrop_local, 1 if keep else 0, movie_id],
            )
            # Alte Bilddateien aufräumen, wenn TMDB ein neues Poster liefert
            if row["poster_path"] and row["poster_path"] != m["poster_path"]:
                images.delete_movie_images(row["poster_path"], None)
            if row["backdrop_path"] and row["backdrop_path"] != m["backdrop_path"]:
                images.delete_movie_images(None, row["backdrop_path"])
        else:
            is_new = True
            cols = ", ".join(MOVIE_FIELDS)
            qs = ", ".join("?" for _ in MOVIE_FIELDS)
            cur = conn.execute(
                f"INSERT INTO movies (tmdb_id, source, {cols}, poster_local, backdrop_local, keep, added_at, added_run_id, updated_at)"
                f" VALUES (?, 'tmdb', {qs}, ?, ?, ?, ?, ?, ?)",
                [m["tmdb_id"]] + values + [poster_local, backdrop_local, 1 if keep else 0, now, run_id, now],
            )
            movie_id = cur.lastrowid

        # Genres
        conn.execute("DELETE FROM movie_genres WHERE movie_id=?", (movie_id,))
        for g in m["_genres"]:
            conn.execute("INSERT INTO genres(id, name) VALUES(?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name", (g["id"], g["name"]))
            conn.execute("INSERT OR IGNORE INTO movie_genres(movie_id, genre_id) VALUES(?, ?)", (movie_id, g["id"]))
        # Personen
        conn.execute("DELETE FROM people WHERE movie_id=?", (movie_id,))
        for i, d in enumerate(m["_directors"]):
            conn.execute("INSERT INTO people(movie_id, tmdb_person_id, name, role, ord, profile_path) VALUES(?,?,?,?,?,?)",
                         (movie_id, d.get("id"), d["name"], "director", i, d.get("profile_path")))
        for i, c in enumerate(m["_cast"]):
            conn.execute("INSERT INTO people(movie_id, tmdb_person_id, name, role, character, ord, profile_path) VALUES(?,?,?,?,?,?,?)",
                         (movie_id, c.get("id"), c["name"], "cast", c.get("character"), i, c.get("profile_path")))
        # Keywords
        conn.execute("DELETE FROM keywords WHERE movie_id=?", (movie_id,))
        for k in m["_keywords"]:
            conn.execute("INSERT OR IGNORE INTO keywords(movie_id, keyword_id, name) VALUES(?,?,?)", (movie_id, k["id"], k["name"]))
        # Trailer: bekannte behalten, neue ergänzen, besten markieren
        if m["_trailers"]:
            conn.execute("UPDATE trailers SET is_main=0 WHERE movie_id=?", (movie_id,))
            for i, v in enumerate(m["_trailers"]):
                conn.execute(
                    "INSERT INTO trailers(movie_id, youtube_key, name, lang, type, official, published_at, is_main)"
                    " VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(movie_id, youtube_key) DO UPDATE SET"
                    " name=excluded.name, is_main=excluded.is_main, official=excluded.official",
                    (movie_id, v["key"], v.get("name"), v.get("iso_639_1"), v.get("type"),
                     1 if v.get("official") else 0, v.get("published_at"), 1 if i == 0 else 0),
                )
            valid = [v["key"] for v in m["_trailers"]]
            conn.execute(
                f"DELETE FROM trailers WHERE movie_id=? AND youtube_key NOT IN ({','.join('?' * len(valid))})",
                [movie_id] + valid,
            )
        # Streaming-Anbieter
        conn.execute("DELETE FROM movie_providers WHERE movie_id=?", (movie_id,))
        for kind, p in m["_providers"]:
            pid = p.get("provider_id")
            if pid is None:
                continue
            conn.execute(
                "INSERT INTO providers(id, name, logo_path, logo_local, priority) VALUES(?,?,?,?,?)"
                " ON CONFLICT(id) DO UPDATE SET name=excluded.name, logo_path=excluded.logo_path,"
                " logo_local=COALESCE(excluded.logo_local, providers.logo_local),"
                " priority=COALESCE(excluded.priority, providers.priority)",
                (pid, p.get("provider_name") or f"Anbieter {pid}", p.get("logo_path"), logos.get(pid), p.get("display_priority")),
            )
            conn.execute("INSERT OR IGNORE INTO movie_providers(movie_id, provider_id, kind) VALUES(?,?,?)", (movie_id, pid, kind))
        # Ähnliche Filme
        conn.execute("DELETE FROM similar WHERE movie_id=?", (movie_id,))
        for i, sid in enumerate(m["_similar"]):
            conn.execute("INSERT OR IGNORE INTO similar(movie_id, tmdb_id, ord) VALUES(?,?,?)", (movie_id, sid, i))
    return movie_id, is_new


def fetch_and_save(conn, api, tmdb_id, run_id=None, keep=False):
    data = api.movie(tmdb_id)
    if data.get("adult"):
        raise TMDBError(f"Film {tmdb_id} ist als 'adult' markiert und wird nicht übernommen.")
    return save_movie(conn, parse_movie(data), run_id=run_id, keep=keep)


# ==================================================================== Läufe/Log
def start_run(conn, kind):
    cur = conn.execute("INSERT INTO update_runs(kind, started_at) VALUES(?, ?)", (kind, db.now_iso()))
    log.info("Lauf #%s (%s) gestartet", cur.lastrowid, kind)
    return cur.lastrowid


def finish_run(conn, run_id, added=0, refreshed=0, removed=0, errors=0, status="ok", message=None):
    conn.execute(
        "UPDATE update_runs SET finished_at=?, added=?, refreshed=?, removed=?, errors=?, status=?, message=? WHERE id=?",
        (db.now_iso(), added, refreshed, removed, errors, status, message, run_id),
    )
    log.info("Lauf #%s beendet: %s neu, %s aktualisiert, %s entfernt, %s Fehler, Status %s%s",
             run_id, added, refreshed, removed, errors, status, f" – {message}" if message else "")


class Progress:
    """Fortschrittsanzeige fürs Terminal (eine Zeile, die sich überschreibt)."""

    def __init__(self, total, label, quiet=False):
        self.total, self.label, self.quiet = max(total, 1), label, quiet
        self.tty = sys.stdout.isatty()
        self.n = 0

    def step(self, text=""):
        self.n += 1
        if self.quiet:
            return
        pct = 100 * self.n / self.total
        bar = "█" * int(pct / 4) + "░" * (25 - int(pct / 4))
        line = f"{self.label} {bar} {self.n}/{self.total} ({pct:4.1f}%) {text[:40]}"
        if self.tty:
            print("\r" + line.ljust(110), end="", flush=True)
        elif self.n % 25 == 0 or self.n == self.total:
            print(line, flush=True)

    def done(self):
        if not self.quiet and self.tty:
            print()


# ============================================================ Warteschlange/Jobs
def create_job(conn, kind, params, candidates):
    """candidates: Liste (tmdb_id, tag) in gewünschter Reihenfolge."""
    with db.tx(conn):
        cur = conn.execute("INSERT INTO import_jobs(kind, params, created_at) VALUES(?,?,?)",
                           (kind, json.dumps(params, ensure_ascii=False), db.now_iso()))
        job_id = cur.lastrowid
        for i, (tid, tag) in enumerate(candidates):
            conn.execute("INSERT OR IGNORE INTO import_queue(job_id, tmdb_id, ord, tag) VALUES(?,?,?,?)", (job_id, tid, i, tag))
    return job_id


def open_job(conn, kind):
    return conn.execute("SELECT * FROM import_jobs WHERE kind=? AND status='running' ORDER BY id DESC LIMIT 1", (kind,)).fetchone()


def run_job(conn, api, job_id, run_id, limit_new=None, keep=False, quiet=False, label="Import"):
    """Arbeitet die Warteschlange ab. Abbruch jederzeit möglich -> beim nächsten Start geht es weiter."""
    pending = conn.execute(
        "SELECT tmdb_id, tag FROM import_queue WHERE job_id=? AND status='pending' ORDER BY ord", (job_id,)
    ).fetchall()
    already = conn.execute("SELECT COUNT(*) FROM import_queue WHERE job_id=? AND status='done'", (job_id,)).fetchone()[0]
    added = errors = 0
    if limit_new is not None:
        remaining_new = max(0, limit_new - already)
    else:
        remaining_new = None
    total = len(pending) if remaining_new is None else min(len(pending), remaining_new)
    prog = Progress(total, label, quiet=quiet)
    for row in pending:
        if remaining_new is not None and added >= remaining_new:
            break
        tid = row["tmdb_id"]
        exists = conn.execute("SELECT 1 FROM movies WHERE tmdb_id=?", (tid,)).fetchone()
        if exists:
            conn.execute("UPDATE import_queue SET status='skipped' WHERE job_id=? AND tmdb_id=?", (job_id, tid))
            continue
        try:
            movie_id, is_new = fetch_and_save(conn, api, tid, run_id=run_id, keep=keep)
            conn.execute("UPDATE import_queue SET status='done' WHERE job_id=? AND tmdb_id=?", (job_id, tid))
            if is_new:
                added += 1
            title = conn.execute("SELECT title FROM movies WHERE id=?", (movie_id,)).fetchone()["title"]
            prog.step(title)
        except TMDBError as e:
            if e.status == 401:
                prog.done()
                raise
            errors += 1
            log.warning("Film %s übersprungen: %s", tid, e)
            conn.execute("UPDATE import_queue SET status='failed' WHERE job_id=? AND tmdb_id=?", (job_id, tid))
            prog.step(f"Fehler bei {tid}")
    prog.done()
    conn.execute("UPDATE import_jobs SET status='done', finished_at=? WHERE id=?", (db.now_iso(), job_id))
    return added, errors


# ============================================================ Kandidaten sammeln
def _collect(api, fetch_page, max_items, tag, seen, out, max_pages=60, min_votes=0):
    page = 1
    got = 0
    while got < max_items and page <= max_pages:
        try:
            data = fetch_page(page)
        except TMDBError as e:
            log.warning("Liste '%s' Seite %s: %s", tag, page, e)
            break
        results = data.get("results", [])
        if not results:
            break
        for r in results:
            if r.get("adult") or r["id"] in seen:
                continue
            if min_votes and (r.get("vote_count") or 0) < min_votes:
                continue
            seen.add(r["id"])
            out.append((r["id"], tag))
            got += 1
            if got >= max_items:
                break
        if page >= (data.get("total_pages") or 1):
            break
        page += 1
    return got


# ============================================================ Geschmacksprofil
def resolve_focus(conn, api):
    """Löst Genres/Themen aus der .env zu TMDB-IDs auf (wird in settings gemerkt)."""
    if not config.FOCUS_GENRES and not config.focus_themes():
        db.set_setting(conn, "focus", "")
        return None
    genre_ids = []
    for name in config.FOCUS_GENRES:
        try:
            genre_ids.append(resolve_genre(conn, api, name)["id"])
        except ValueError as e:
            log.warning("Profil: %s", e)
    themes = []
    for label, terms in config.focus_themes():
        ids = []
        for term in terms:
            try:
                res = api.search_keyword(term).get("results", [])
            except TMDBError:
                res = []
            ids += [k["id"] for k in res if k["name"].strip().lower() == term.lower() and k["id"] not in ids]
        if ids:
            themes.append({"label": label, "ids": ids})
    focus = {
        "genre_ids": genre_ids,
        "genres": "|".join(map(str, genre_ids)),
        "themes": themes,
        "gte": f"{config.FOCUS_YEAR_FROM}-01-01" if config.FOCUS_YEAR_FROM else None,
        "lte": f"{config.FOCUS_YEAR_TO}-12-31" if config.FOCUS_YEAR_TO else None,
    }
    db.set_setting(conn, "focus", json.dumps(focus))
    return focus


def stored_focus(conn):
    try:
        return json.loads(db.get_setting(conn, "focus") or "null")
    except ValueError:
        return None


def _years(focus):
    f = {}
    if focus.get("gte"):
        f["primary_release_date__gte"] = focus["gte"]
    if focus.get("lte"):
        f["primary_release_date__lte"] = focus["lte"]
    return f


def _interleave(groups):
    """Verzahnt mehrere Kandidatenlisten, damit auch ein abgebrochener Import gut gemischt ist."""
    out, seen = [], set()
    iters = [iter(g) for g in groups if g]
    while iters:
        nxt = []
        for it in iters:
            for tid, tag in it:
                if tid not in seen:
                    seen.add(tid)
                    out.append((tid, tag))
                    nxt.append(it)
                    break
        iters = nxt
    return out


def _cinema_filters(focus, upcoming=False):
    today = date.today()
    f = {"region": config.REGION, "with_release_type": "2|3", "sort_by": "popularity.desc"}
    if upcoming:
        f["release_date__gte"] = (today + timedelta(days=1)).isoformat()
        f["release_date__lte"] = (today + timedelta(days=180)).isoformat()
    else:
        f["release_date__gte"] = (today - timedelta(days=60)).isoformat()
        f["release_date__lte"] = today.isoformat()
    if focus and focus.get("genres"):
        f["with_genres"] = focus["genres"]
    return f


def focus_candidates(api, focus, total):
    """Mischung nach deinem Profil (Genres, Themen, Jahre)."""
    years = _years(focus)
    G = focus.get("genres")
    seen = set()
    groups = []

    def grab(fetch, n, tag, **kw):
        lst = []
        _collect(api, fetch, n, tag, seen, lst, **kw)
        groups.append(lst)

    grab(lambda p: api.discover(p, **_cinema_filters(focus)), int(total * .06), "now_playing", max_pages=5)
    grab(lambda p: api.discover(p, **_cinema_filters(focus, upcoming=True)), int(total * .06), "upcoming", max_pages=5)
    for t in focus.get("themes", []):
        kw = "|".join(map(str, t["ids"]))
        extra = {"with_genres": G} if G else {}
        grab(lambda p, kw=kw, extra=extra: api.discover(p, with_keywords=kw, sort_by="vote_count.desc",
                                                      vote_count__gte=80, **extra, **years),
             int(total * .14), f"theme:{t['label']}")
    weights = [.18, .14, .14, .07, .05, .05, .05]
    for i, gid in enumerate(focus.get("genre_ids", [])):
        grab(lambda p, gid=gid: api.discover(p, with_genres=gid, sort_by="vote_count.desc", vote_count__gte=150, **years),
             int(total * weights[min(i, len(weights) - 1)]), f"genre:{gid}")
    if G:
        grab(lambda p: api.discover(p, with_genres=G, sort_by="vote_average.desc", vote_count__gte=1000, **years),
             int(total * .06), "top")
    out = _interleave(groups)
    if len(out) < total and G:
        fill = []
        _collect(api, lambda p: api.discover(p, with_genres=G, sort_by="popularity.desc", vote_count__gte=60, **years),
                 total - len(out), "fill", seen, fill, max_pages=100)
        out += fill
    return out[:total]


def initial_candidates(api, total=1000, focus=None):
    if focus and (focus.get("genre_ids") or focus.get("themes")):
        return focus_candidates(api, focus, total)
    """Mischung: beliebt, bestbewertet (letzte Jahre), Kino, demnächst, Klassiker."""
    this_year = date.today().year
    seen, out = set(), []
    share = {
        "kino": 0.08, "demnaechst": 0.07, "beliebt": 0.25, "top_neu": 0.25, "klassiker": 0.15, "top_alle": 0.20,
    }
    n = {k: max(1, int(total * v)) for k, v in share.items()}
    _collect(api, lambda p: api.movie_list("now_playing", p), n["kino"], "now_playing", seen, out)
    _collect(api, lambda p: api.movie_list("upcoming", p), n["demnaechst"], "upcoming", seen, out)
    _collect(api, lambda p: api.movie_list("popular", p), n["beliebt"], "popular", seen, out, min_votes=50)
    _collect(api, lambda p: api.discover(p, sort_by="vote_average.desc", vote_count__gte=800,
                                         primary_release_date__gte=f"{this_year - 8}-01-01"),
             n["top_neu"], "top_recent", seen, out)
    _collect(api, lambda p: api.discover(p, sort_by="vote_count.desc", vote_count__gte=1500,
                                         primary_release_date__lte="1989-12-31"),
             n["klassiker"], "classic", seen, out)
    _collect(api, lambda p: api.movie_list("top_rated", p), n["top_alle"], "top_rated", seen, out)
    # Auffüllen, falls Listen überlappen
    if len(out) < total:
        _collect(api, lambda p: api.discover(p, sort_by="vote_count.desc", vote_count__gte=300),
                 total - len(out), "fill", seen, out, max_pages=100)
    return out[:total]


def resolve_genre(conn, api, name):
    name_l = name.strip().lower()
    aliases = {
        "horror": "horror", "thriller": "thriller", "action": "action", "komödie": "komödie", "komoedie": "komödie",
        "comedy": "komödie", "drama": "drama", "scifi": "science fiction", "sci-fi": "science fiction",
        "science-fiction": "science fiction", "krimi": "krimi", "crime": "krimi", "animation": "animation",
        "doku": "dokumentarfilm", "dokumentation": "dokumentarfilm", "fantasy": "fantasy", "abenteuer": "abenteuer",
        "adventure": "abenteuer", "romantik": "liebesfilm", "romance": "liebesfilm", "liebe": "liebesfilm",
        "mystery": "mystery", "familie": "familie", "family": "familie", "krieg": "kriegsfilm", "war": "kriegsfilm",
        "western": "western", "musik": "musik", "historie": "historie", "history": "historie",
    }
    target = aliases.get(name_l, name_l)
    genres = api.genres()
    for g in genres:
        conn.execute("INSERT INTO genres(id, name) VALUES(?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name", (g["id"], g["name"]))
    for g in genres:
        if g["name"].lower() == target or g["name"].lower().startswith(target):
            return g
    names = ", ".join(g["name"] for g in genres)
    raise ValueError(f"Genre '{name}' unbekannt. Verfügbar: {names}")


def genre_candidates(api, genre_id, year_from, year_to, count, tag):
    seen, out = set(), []
    filters = {"with_genres": genre_id, "sort_by": "vote_count.desc", "vote_count__gte": 50}
    if year_from:
        filters["primary_release_date__gte"] = f"{year_from}-01-01"
    if year_to:
        filters["primary_release_date__lte"] = f"{year_to}-12-31"
    _collect(api, lambda p: api.discover(p, **filters), count * 3, tag, seen, out, max_pages=40)
    return out


def list_candidates(api, query, count, year_from=None, year_to=None):
    """Thema/Liste über TMDB-Keywords; zusätzlich Titelsuche als Ergänzung."""
    seen, out = set(), []
    words = [query] + ([w for w in query.split() if len(w) > 3] if " " in query else [])
    kw_ids = []
    for w in words:
        try:
            res = api.search_keyword(w).get("results", [])
        except TMDBError:
            res = []
        for k in res[:4]:
            if k["id"] not in kw_ids:
                kw_ids.append(k["id"])
        if kw_ids and w == query:
            break
    filters = {"sort_by": "vote_count.desc", "vote_count__gte": 30}
    if year_from:
        filters["primary_release_date__gte"] = f"{year_from}-01-01"
    if year_to:
        filters["primary_release_date__lte"] = f"{year_to}-12-31"
    if kw_ids:
        _collect(api, lambda p: api.discover(p, with_keywords="|".join(map(str, kw_ids[:6])), **filters),
                 count * 3, f"list:{query}", seen, out, max_pages=40)
    if len(out) < count:
        _collect(api, lambda p: api.search(query, page=p), count * 3 - len(out), f"list:{query}", seen, out, max_pages=10)
    return out


# ============================================================== Obergrenze
def importance(row, today=None, fit=None):
    """Je höher, desto wichtiger. Alt + schlecht bewertet + unbeliebt + nicht mein Geschmack = niedrig."""
    today = today or date.today()
    va = row["vote_average"] or 0
    vc = row["vote_count"] or 0
    pop = row["popularity"] or 0
    score = (va / 10.0) * math.log10(1 + vc) * 1.2      # Qualität x Bekanntheit
    score += math.log10(1 + pop) * 0.8                  # aktuelle Beliebtheit
    rd = row["release_date"] or ""
    try:
        d = date.fromisoformat(rd[:10])
        age_years = (today - d).days / 365.25
        if age_years < 0:            # demnächst
            score += 3.0
        elif age_years < 1:
            score += 2.5
        elif age_years < 3:
            score += 1.0
    except ValueError:
        pass
    lists = row["lists"] or ""
    if ",now_playing," in lists or ",upcoming," in lists:
        score += 3.0
    if fit is not None:
        score += fit.get(row["id"], 0)
    return score


def focus_fit(conn):
    """Bonus pro Film: passt zu Genres (+1,5), Themen (+1), Jahren (+0,5)."""
    focus = stored_focus(conn)
    if not focus:
        return None
    fit = {}
    if focus.get("genre_ids"):
        q = ",".join("?" * len(focus["genre_ids"]))
        for r in conn.execute(f"SELECT DISTINCT movie_id FROM movie_genres WHERE genre_id IN ({q})", focus["genre_ids"]):
            fit[r[0]] = fit.get(r[0], 0) + 1.5
    ids = [i for t in focus.get("themes", []) for i in t["ids"]]
    if ids:
        q = ",".join("?" * len(ids))
        for r in conn.execute(f"SELECT DISTINCT movie_id FROM keywords WHERE keyword_id IN ({q})", ids):
            fit[r[0]] = fit.get(r[0], 0) + 1.0
    if focus.get("gte"):
        for r in conn.execute("SELECT id FROM movies WHERE release_date >= ?", (focus["gte"],)):
            fit[r[0]] = fit.get(r[0], 0) + 0.5
    return fit


def catalog_counts(conn):
    total = conn.execute("SELECT COUNT(*) FROM movies").fetchone()[0]
    mine = conn.execute(f"SELECT COUNT(*) FROM movies m WHERE {db.MINE_SQL}").fetchone()[0]
    kept = conn.execute(f"SELECT COUNT(*) FROM movies m WHERE m.keep=1 AND NOT {db.MINE_SQL}").fetchone()[0]
    return {"total": total, "mine": mine, "keep": kept, "catalog": total - mine}


def prune(conn, limit=None, protect_run_id=None, dry_run=False):
    """Hält den Katalog (ohne meine Filme) bei <= limit. Gibt Anzahl gelöschter Filme zurück."""
    limit = config.CATALOG_LIMIT if limit is None else limit
    rows = conn.execute(
        f"SELECT m.*, (SELECT kind FROM update_runs u WHERE u.id = m.added_run_id) AS run_kind"
        f" FROM movies m WHERE m.source='tmdb' AND NOT {db.MINE_SQL}"
    ).fetchall()
    excess = len(rows) - limit
    if excess <= 0:
        return 0
    import_cutoff = (datetime.now(timezone.utc) - timedelta(days=IMPORT_PROTECT_DAYS)).isoformat()

    def protected(r):
        if r["keep"]:                                   # per 'add' gezielt geholt
            return True
        if protect_run_id is not None and r["added_run_id"] == protect_run_id:
            return True
        # per 'import' geholte Filme sind eine Weile geschützt
        return r["run_kind"] == "import" and (r["added_at"] or "") >= import_cutoff
    fit = focus_fit(conn)
    candidates = sorted((r for r in rows if not protected(r)), key=lambda r: importance(r, fit=fit))[:excess]
    if dry_run:
        return len(candidates)
    removed = 0
    for r in candidates:
        with db.tx(conn):
            # Sicherheitsnetz: direkt vor dem Löschen erneut prüfen
            if db.is_mine(conn, r["id"]):
                continue
            conn.execute("DELETE FROM movies WHERE id=?", (r["id"],))
        images.delete_movie_images(r["poster_path"], r["backdrop_path"])
        removed += 1
        log.info("Entfernt (Obergrenze): %s (%s) tmdb=%s", r["title"], r["year"], r["tmdb_id"])
    return removed


# ============================================================ Hauptabläufe
def initial_import(conn, api, total=1000, quiet=False):
    job = open_job(conn, "initial")
    if job:
        print(f"Setze unterbrochenen Erst-Import #{job['id']} fort …")
        job_id = job["id"]
        run_row = conn.execute("SELECT id FROM update_runs WHERE kind='initial' AND status='running' ORDER BY id DESC LIMIT 1").fetchone()
        run_id = run_row["id"] if run_row else start_run(conn, "initial")
    else:
        print(f"Sammle bis zu {total} Filme bei TMDB (beliebt, bestbewertet, Kino, demnächst, Klassiker) …")
        run_id = start_run(conn, "initial")
        focus = resolve_focus(conn, api)
        if focus:
            names = [g["name"] for g in conn.execute(
                f"SELECT name FROM genres WHERE id IN ({','.join('?' * len(focus['genre_ids']))})", focus["genre_ids"])]
            print(f"Profil: {', '.join(names)} · Themen: {', '.join(t['label'] for t in focus['themes'])}"
                  f" · ab {config.FOCUS_YEAR_FROM or 'immer'}")
        cands = initial_candidates(api, total, focus)
        job_id = create_job(conn, "initial", {"total": total}, cands)
        print(f"{len(cands)} Kandidaten gefunden.")
    _ensure_meta(conn, api)
    try:
        added, errors = run_job(conn, api, job_id, run_id, quiet=quiet, label="Erst-Import")
    except KeyboardInterrupt:
        log.warning("Erst-Import unterbrochen – wird beim nächsten 'kino.py init' fortgesetzt.")
        raise
    _tag_lists(conn, api)
    removed = prune(conn)
    done = conn.execute("SELECT COUNT(*) FROM import_queue WHERE job_id=? AND status='done'", (job_id,)).fetchone()[0]
    finish_run(conn, run_id, added=done, removed=removed, errors=errors)
    return {"added": added, "errors": errors, "removed": removed}


def import_candidates(conn, api, kind, params, cands, count, quiet=False):
    run_id = start_run(conn, "import")
    job_id = create_job(conn, kind, params, cands)
    added, errors = run_job(conn, api, job_id, run_id, limit_new=count, keep=False, quiet=quiet, label="Import")
    removed = prune(conn, protect_run_id=run_id)
    finish_run(conn, run_id, added=added, removed=removed, errors=errors, message=json.dumps(params, ensure_ascii=False))
    return {"added": added, "errors": errors, "removed": removed, "candidates": len(cands)}


def _ensure_meta(conn, api):
    try:
        for g in api.genres():
            conn.execute("INSERT INTO genres(id, name) VALUES(?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name", (g["id"], g["name"]))
        for p in api.providers():
            prio = (p.get("display_priorities") or {}).get(config.REGION, p.get("display_priority"))
            logo = images.download(images.LOGO_SIZE, p.get("logo_path")) if config.DOWNLOAD_IMAGES else None
            conn.execute(
                "INSERT INTO providers(id, name, logo_path, logo_local, priority) VALUES(?,?,?,?,?)"
                " ON CONFLICT(id) DO UPDATE SET name=excluded.name, logo_path=excluded.logo_path,"
                " logo_local=COALESCE(excluded.logo_local, providers.logo_local), priority=excluded.priority",
                (p["provider_id"], p["provider_name"], p.get("logo_path"), logo, prio),
            )
    except TMDBError as e:
        log.warning("Metadaten (Genres/Anbieter) nicht geladen: %s", e)


def _tag_lists(conn, api, pages=3):
    """Markiert, welche Katalogfilme gerade im Kino / demnächst laufen."""
    tags = {}
    for kind in ("now_playing", "upcoming"):
        for page in range(1, pages + 1):
            try:
                data = api.movie_list(kind, page)
            except TMDBError:
                break
            for r in data.get("results", []):
                tags.setdefault(r["id"], set()).add(kind)
            if page >= (data.get("total_pages") or 1):
                break
    # zusätzlich: Kinostarts in DE passend zum Profil (Liste oben enthält nur die Top-Titel)
    focus = stored_focus(conn)
    for kind, upcoming in (("now_playing", False), ("upcoming", True)):
        for page in range(1, 6):
            try:
                data = api.discover(page, **_cinema_filters(focus, upcoming=upcoming))
            except TMDBError:
                break
            for r in data.get("results", []):
                tags.setdefault(r["id"], set()).add(kind)
            if page >= (data.get("total_pages") or 1):
                break
    with db.tx(conn):
        conn.execute("UPDATE movies SET lists=''")
        for tid, ks in tags.items():
            conn.execute("UPDATE movies SET lists=? WHERE tmdb_id=?", ("," + ",".join(sorted(ks)) + ",", tid))
    return tags


def update_candidates(api, focus):
    seen, groups = set(), []

    def grab(fetch, n, tag, **kw):
        lst = []
        _collect(api, fetch, n, tag, seen, lst, **kw)
        groups.append(lst)

    stream_since = (date.today() - timedelta(days=540)).isoformat()
    recent = (date.today() - timedelta(days=45)).isoformat()
    if focus and (focus.get("genre_ids") or focus.get("themes")):
        G = focus.get("genres")
        g = {"with_genres": G} if G else {}
        grab(lambda p: api.discover(p, **_cinema_filters(focus)), 40, "now_playing", max_pages=4)
        grab(lambda p: api.discover(p, **_cinema_filters(focus, upcoming=True)), 40, "upcoming", max_pages=4)
        # Neu bei Streamingdiensten in DE (Flatrate/kostenlos/Werbung), passend zum Profil
        grab(lambda p: api.discover(p, watch_region=config.REGION, with_watch_monetization_types="flatrate|free|ads",
                                    sort_by="popularity.desc", primary_release_date__gte=stream_since, **g),
             50, "streaming_new", max_pages=5)
        for t in focus.get("themes", []):
            kw = "|".join(map(str, t["ids"]))
            grab(lambda p, kw=kw: api.discover(p, with_keywords=kw, sort_by="popularity.desc", vote_count__gte=20,
                                               primary_release_date__gte=(date.today() - timedelta(days=730)).isoformat(), **g),
                 15, f"theme:{t['label']}", max_pages=2)
        grab(lambda p: api.discover(p, sort_by="popularity.desc", vote_count__gte=20, primary_release_date__gte=recent, **g),
             25, "recent", max_pages=3)
    else:
        grab(lambda p: api.movie_list("now_playing", p), 60, "now_playing", max_pages=5)
        grab(lambda p: api.movie_list("upcoming", p), 60, "upcoming", max_pages=5)
        grab(lambda p: api.discover(p, watch_region=config.REGION, with_watch_monetization_types="flatrate|free|ads",
                                    sort_by="popularity.desc", primary_release_date__gte=stream_since),
             60, "streaming_new", max_pages=5)
        grab(lambda p: api.discover(p, sort_by="popularity.desc", vote_count__gte=20, primary_release_date__gte=recent),
             30, "recent", max_pages=3)
        grab(lambda p: api.movie_list("popular", p), 40, "popular", max_pages=3, min_votes=50)
    return _interleave(groups)


def daily_update(conn, api, refresh_all=True, max_new=150, quiet=False):
    """Neue Filme holen, bestehende auffrischen, Obergrenze einhalten."""
    run_id = start_run(conn, "update")
    added = refreshed = errors = 0
    try:
        _ensure_meta(conn, api)
        focus = resolve_focus(conn, api)
        cands = update_candidates(api, focus)
        new_cands = [(t, tag) for t, tag in cands if not conn.execute("SELECT 1 FROM movies WHERE tmdb_id=?", (t,)).fetchone()]
        new_cands = new_cands[:max_new]
        if new_cands:
            job_id = create_job(conn, "update", {"date": date.today().isoformat()}, new_cands)
            if not quiet:
                print(f"{len(new_cands)} neue Filme gefunden.")
            a, e = run_job(conn, api, job_id, run_id, quiet=quiet, label="Neue Filme")
            added += a
            errors += e

        if refresh_all:
            rows = conn.execute(
                "SELECT tmdb_id, title FROM movies WHERE source='tmdb' AND (added_run_id IS NOT ? OR added_run_id IS NULL)"
                " ORDER BY updated_at ASC", (run_id,)
            ).fetchall()
            prog = Progress(len(rows), "Aktualisieren", quiet=quiet)
            for r in rows:
                try:
                    fetch_and_save(conn, api, r["tmdb_id"])
                    refreshed += 1
                except TMDBError as e:
                    if e.status == 401:
                        raise
                    errors += 1
                    log.warning("Aktualisieren von %s (%s) fehlgeschlagen: %s", r["title"], r["tmdb_id"], e)
                prog.step(r["title"])
            prog.done()

        _tag_lists(conn, api)
        removed = prune(conn, protect_run_id=None)
        # Neu hinzugekommene, die direkt wieder rausfliegen würden, zählen nicht als "neu"
        added_now = conn.execute("SELECT COUNT(*) FROM movies WHERE added_run_id=?", (run_id,)).fetchone()[0]
        finish_run(conn, run_id, added=added_now, refreshed=refreshed, removed=removed, errors=errors)
        db.set_setting(conn, "last_update", db.now_iso())
        return {"added": added_now, "refreshed": refreshed, "removed": removed, "errors": errors, "run_id": run_id}
    except BaseException as e:
        finish_run(conn, run_id, added=added, refreshed=refreshed, errors=errors + 1, status="error", message=str(e)[:500])
        log.error("Update abgebrochen: %s", e)
        raise


def add_manual(conn, title, year=None, overview=None, runtime=None, director=None, cover_rel=None, genre_ids=()):
    now = db.now_iso()
    with db.tx(conn):
        cur = conn.execute(
            "INSERT INTO movies(source, title, year, release_date, overview, runtime, director, poster_local, keep, added_at, updated_at)"
            " VALUES('manual', ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
            (title, year, f"{year}-01-01" if year else None, overview, runtime, director, cover_rel, now, now),
        )
        mid = cur.lastrowid
        for g in genre_ids:
            conn.execute("INSERT OR IGNORE INTO movie_genres(movie_id, genre_id) VALUES(?,?)", (mid, g))
    return mid
