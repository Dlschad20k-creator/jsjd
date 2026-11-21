"""Lokaler Bild-Cache für Poster, Backdrops und Anbieter-Logos."""
import os
import re
import time
import urllib.error
import urllib.request

from . import config

POSTER_SIZES = ("w342", "w780")
BACKDROP_SIZE = "w1280"
LOGO_SIZE = "w92"
_SAFE = re.compile(r"^/?[A-Za-z0-9_\-]+\.(jpg|jpeg|png|webp|svg)$")


def local_path(size, tmdb_path):
    name = tmdb_path.lstrip("/")
    return config.IMAGE_DIR / size / name


def download(size, tmdb_path, retries=3):
    """Lädt ein TMDB-Bild in den Cache. Gibt den relativen Pfad zurück oder None."""
    if not tmdb_path or not _SAFE.match(tmdb_path):
        return None
    dest = local_path(size, tmdb_path)
    rel = f"{size}/{dest.name}"
    if dest.is_file() and dest.stat().st_size > 0:
        return rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    url = f"{config.TMDB_IMAGE_URL}/{size}/{dest.name}"
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "AuraKino/1.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
            if not data:
                raise OSError("leere Antwort")
            tmp = dest.with_suffix(dest.suffix + ".part")
            tmp.write_bytes(data)
            os.replace(tmp, dest)  # atomar: nie halbe Bilder im Cache
            return rel
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(attempt)
        except (urllib.error.URLError, OSError, TimeoutError):
            time.sleep(attempt)
    return None


def cache_movie_images(poster_path, backdrop_path):
    """Gibt (poster_rel, backdrop_rel) zurück; poster_rel zeigt auf w342."""
    poster = None
    if poster_path:
        for size in POSTER_SIZES:
            r = download(size, poster_path)
            if size == "w342":
                poster = r
    backdrop = download(BACKDROP_SIZE, backdrop_path) if backdrop_path else None
    return poster, backdrop


def delete_movie_images(poster_path, backdrop_path):
    for size in POSTER_SIZES:
        if poster_path:
            p = local_path(size, poster_path)
            p.unlink(missing_ok=True)
    if backdrop_path:
        local_path(BACKDROP_SIZE, backdrop_path).unlink(missing_ok=True)
