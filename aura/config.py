"""Konfiguration: liest .env (ohne Fremdpakete) und legt die Datenordner fest."""
import os
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = APP_DIR / "web"


def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        # Echte Umgebungsvariablen haben Vorrang vor der .env
        os.environ.setdefault(key, val)


# Datenordner: AURA_DATA_DIR, sonst /var/lib/aura-kino (Installation auf der Box), sonst ./data
SYSTEM_DATA_DIR = Path("/var/lib/aura-kino")
_default_data = SYSTEM_DATA_DIR if SYSTEM_DATA_DIR.is_dir() else APP_DIR / "data"

# Reihenfolge: AURA_ENV_FILE, Datenordner/.env, Projektordner/.env
_explicit = os.environ.get("AURA_ENV_FILE")
if _explicit:
    _load_env_file(Path(_explicit))
_load_env_file(Path(os.environ.get("AURA_DATA_DIR", _default_data)) / ".env")
_load_env_file(APP_DIR / ".env")

DATA_DIR = Path(os.environ.get("AURA_DATA_DIR", _default_data)).resolve()
DB_PATH = DATA_DIR / "aura.db"
IMAGE_DIR = DATA_DIR / "images"
UPLOAD_DIR = DATA_DIR / "uploads"
BACKUP_DIR = DATA_DIR / "backups"
LOG_DIR = DATA_DIR / "logs"

TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "").strip()
TMDB_READ_TOKEN = os.environ.get("TMDB_READ_TOKEN", "").strip()
TMDB_BASE_URL = os.environ.get("TMDB_BASE_URL", "https://api.themoviedb.org/3").rstrip("/")
TMDB_IMAGE_URL = os.environ.get("TMDB_IMAGE_URL", "https://image.tmdb.org/t/p").rstrip("/")
TMDB_DELAY = float(os.environ.get("TMDB_DELAY", "0.12"))  # Pause zwischen Anfragen (s)

LANG = "de-DE"
REGION = "DE"

HOST = os.environ.get("AURA_HOST", "0.0.0.0")
PORT = int(os.environ.get("AURA_PORT", "8420"))
# Erlaubte Netze: localhost, Heimnetz, Tailscale (IPv4 CGNAT + IPv6 ULA)
ALLOWED_NETS = os.environ.get(
    "AURA_ALLOWED_NETS",
    "127.0.0.0/8,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,100.64.0.0/10,fd7a:115c:a1e0::/48,fe80::/10",
)

# ---- Mein Geschmack: steuert Erst-Import und tägliches Update (leer = alles)
FOCUS_GENRES = [g.strip() for g in os.environ.get(
    "AURA_GENRES", "thriller,horror,action,krimi,mystery").split(",") if g.strip()]
# Themen = TMDB-Keywords (englisch). Format: Anzeigename=suchbegriff|suchbegriff;…
FOCUS_THEMES = os.environ.get(
    "AURA_THEMES",
    "Psychothriller=psychological thriller|psychological;Nach wahren Begebenheiten=based on true story|true crime|based on real events",
)
FOCUS_YEAR_FROM = int(os.environ.get("AURA_YEAR_FROM", "2015") or 0) or None
FOCUS_YEAR_TO = int(os.environ.get("AURA_YEAR_TO", "") or 0) or None   # leer = bis heute + Demnächst


def focus_themes():
    out = []
    for part in FOCUS_THEMES.split(";"):
        if "=" in part:
            label, terms = part.split("=", 1)
            terms = [t.strip() for t in terms.split("|") if t.strip()]
            if label.strip() and terms:
                out.append((label.strip(), terms))
    return out


CATALOG_LIMIT = int(os.environ.get("AURA_CATALOG_LIMIT", "1000"))
BACKUP_KEEP = int(os.environ.get("AURA_BACKUP_KEEP", "14"))


def ensure_dirs() -> None:
    for d in (DATA_DIR, IMAGE_DIR, UPLOAD_DIR, BACKUP_DIR, LOG_DIR):
        d.mkdir(parents=True, exist_ok=True)


def has_tmdb_credentials() -> bool:
    return bool(TMDB_API_KEY or TMDB_READ_TOKEN)
