"""SQLite-Datenbank: Schema, Verbindung, Hilfsfunktionen."""
import sqlite3
import threading
import unicodedata
from datetime import datetime, timezone

from . import config

SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS movies (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    tmdb_id         INTEGER UNIQUE,              -- NULL bei eigenen Filmen
    source          TEXT NOT NULL DEFAULT 'tmdb', -- 'tmdb' | 'manual'
    title           TEXT NOT NULL,
    original_title  TEXT,
    year            INTEGER,
    release_date    TEXT,                        -- Erstveröffentlichung (TMDB)
    release_date_de TEXT,                        -- Kinostart DE
    runtime         INTEGER,
    fsk             TEXT,
    vote_average    REAL,
    vote_count      INTEGER,
    popularity      REAL,
    overview        TEXT,
    overview_lang   TEXT,
    tagline         TEXT,
    director        TEXT,
    poster_path     TEXT,                        -- TMDB-Pfad, z.B. /abc.jpg
    backdrop_path   TEXT,
    poster_local    TEXT,                        -- lokaler Dateiname (Cache/Upload)
    backdrop_local  TEXT,
    justwatch_link  TEXT,
    keep            INTEGER NOT NULL DEFAULT 0,  -- per Befehl gezielt hinzugefügt -> nie automatisch löschen
    added_at        TEXT NOT NULL,
    added_run_id    INTEGER,
    updated_at      TEXT,
    lists           TEXT NOT NULL DEFAULT ''     -- ',now_playing,upcoming,' (aus dem letzten Update)
);
CREATE INDEX IF NOT EXISTS idx_movies_added ON movies(added_at);
CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year);

CREATE TABLE IF NOT EXISTS genres (
    id   INTEGER PRIMARY KEY,                    -- TMDB-Genre-ID
    name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS movie_genres (
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL REFERENCES genres(id),
    PRIMARY KEY (movie_id, genre_id)
);
CREATE INDEX IF NOT EXISTS idx_mg_genre ON movie_genres(genre_id);

CREATE TABLE IF NOT EXISTS people (
    movie_id   INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    tmdb_person_id INTEGER,
    name       TEXT NOT NULL,
    role       TEXT NOT NULL,                    -- 'director' | 'cast'
    character  TEXT,
    ord        INTEGER NOT NULL DEFAULT 0,
    profile_path TEXT
);
CREATE INDEX IF NOT EXISTS idx_people_movie ON people(movie_id);
CREATE INDEX IF NOT EXISTS idx_people_name ON people(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS keywords (
    movie_id   INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    keyword_id INTEGER NOT NULL,
    name       TEXT NOT NULL,
    PRIMARY KEY (movie_id, keyword_id)
);

CREATE TABLE IF NOT EXISTS trailers (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id  INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    youtube_key TEXT NOT NULL,
    name      TEXT,
    lang      TEXT,
    type      TEXT,
    official  INTEGER,
    published_at TEXT,
    is_main   INTEGER NOT NULL DEFAULT 0,
    UNIQUE (movie_id, youtube_key)
);

CREATE TABLE IF NOT EXISTS providers (
    id        INTEGER PRIMARY KEY,               -- TMDB provider_id
    name      TEXT NOT NULL,
    logo_path TEXT,
    logo_local TEXT,
    priority  INTEGER
);
CREATE TABLE IF NOT EXISTS movie_providers (
    movie_id    INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    provider_id INTEGER NOT NULL REFERENCES providers(id),
    kind        TEXT NOT NULL,                   -- flatrate | free | ads | rent | buy
    PRIMARY KEY (movie_id, provider_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_mp_provider ON movie_providers(provider_id);

CREATE TABLE IF NOT EXISTS similar (
    movie_id  INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    tmdb_id   INTEGER NOT NULL,                  -- TMDB-Empfehlung (muss nicht im Katalog sein)
    ord       INTEGER NOT NULL,
    PRIMARY KEY (movie_id, tmdb_id)
);

-- ===== Meine Daten (werden nie automatisch gelöscht) =====
CREATE TABLE IF NOT EXISTS watchlist (
    movie_id  INTEGER PRIMARY KEY REFERENCES movies(id) ON DELETE CASCADE,
    priority  INTEGER NOT NULL DEFAULT 0,        -- 0 normal, 1 unbedingt
    added_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS views (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id  INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    watched_on TEXT NOT NULL,                    -- YYYY-MM-DD
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_views_movie ON views(movie_id);
CREATE INDEX IF NOT EXISTS idx_views_date ON views(watched_on);
CREATE TABLE IF NOT EXISTS ratings (
    movie_id  INTEGER PRIMARY KEY REFERENCES movies(id) ON DELETE CASCADE,
    rating    REAL,                              -- 1.0 .. 10.0, halbe Schritte
    verdict   TEXT,                              -- 'lohnt' | 'geht' | 'zeit'
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notes (
    movie_id  INTEGER PRIMARY KEY REFERENCES movies(id) ON DELETE CASCADE,
    text      TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS goofs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id  INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    text      TEXT NOT NULL,
    timecode  TEXT,
    category  TEXT NOT NULL DEFAULT 'sonstiges',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goofs_movie ON goofs(movie_id);

-- ===== System =====
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS import_jobs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    kind       TEXT NOT NULL,                    -- initial | genre | list | update
    params     TEXT,
    status     TEXT NOT NULL DEFAULT 'running',  -- running | done
    created_at TEXT NOT NULL,
    finished_at TEXT
);
CREATE TABLE IF NOT EXISTS import_queue (
    job_id   INTEGER NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
    tmdb_id  INTEGER NOT NULL,
    ord      INTEGER NOT NULL,
    tag      TEXT,
    status   TEXT NOT NULL DEFAULT 'pending',    -- pending | done | failed | skipped
    PRIMARY KEY (job_id, tmdb_id)
);
CREATE TABLE IF NOT EXISTS update_runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kind        TEXT NOT NULL,                   -- initial | update | import | add
    started_at  TEXT NOT NULL,
    finished_at TEXT,
    added       INTEGER NOT NULL DEFAULT 0,
    refreshed   INTEGER NOT NULL DEFAULT 0,
    removed     INTEGER NOT NULL DEFAULT 0,
    errors      INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'running', -- running | ok | error
    message     TEXT
);
"""

_local = threading.local()


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def fold(text) -> str:
    """Für die Suche: klein, ohne Akzente, ß->ss (\"Amélie\" findet \"amelie\")."""
    if text is None:
        return ""
    t = unicodedata.normalize("NFKD", str(text).casefold())
    return "".join(ch for ch in t if not unicodedata.combining(ch))


def connect(path=None) -> sqlite3.Connection:
    config.ensure_dirs()
    conn = sqlite3.connect(str(path or config.DB_PATH), timeout=30, isolation_level=None, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.create_function("fold", 1, fold, deterministic=True)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA busy_timeout = 30000")
    return conn


def get() -> sqlite3.Connection:
    """Eine Verbindung pro Thread (für den Server)."""
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = connect()
        _local.conn = conn
    return conn


def init(conn=None) -> sqlite3.Connection:
    conn = conn or connect()
    conn.executescript(SCHEMA)
    conn.execute(
        "INSERT OR IGNORE INTO settings(key, value) VALUES('schema_version', ?)", (str(SCHEMA_VERSION),)
    )
    return conn


class tx:
    """Transaktion als Kontextmanager: with db.tx(conn): ..."""

    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        self.conn.execute("BEGIN IMMEDIATE")
        return self.conn

    def __exit__(self, exc_type, exc, tb):
        if exc_type is None:
            self.conn.execute("COMMIT")
        else:
            self.conn.execute("ROLLBACK")
        return False


def get_setting(conn, key, default=None):
    row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return row["value"] if row else default


def set_setting(conn, key, value):
    conn.execute(
        "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )


# Ein Film gilt als "meiner", wenn ich irgendetwas damit gemacht habe.
MINE_SQL = """(
    m.source = 'manual'
    OR EXISTS (SELECT 1 FROM watchlist w WHERE w.movie_id = m.id)
    OR EXISTS (SELECT 1 FROM views v WHERE v.movie_id = m.id)
    OR EXISTS (SELECT 1 FROM ratings r WHERE r.movie_id = m.id)
    OR EXISTS (SELECT 1 FROM notes n WHERE n.movie_id = m.id AND trim(n.text) <> '')
    OR EXISTS (SELECT 1 FROM goofs g WHERE g.movie_id = m.id)
)"""


def is_mine(conn, movie_id) -> bool:
    row = conn.execute(f"SELECT {MINE_SQL} AS mine FROM movies m WHERE m.id=?", (movie_id,)).fetchone()
    return bool(row and row["mine"])
