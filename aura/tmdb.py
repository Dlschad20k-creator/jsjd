"""Schlanker TMDB-v3-Client (nur Standardbibliothek) mit Pausen und Wiederholungen."""
import json
import random
import time
import urllib.error
import urllib.parse
import urllib.request

from . import config

USER_AGENT = "AuraKino/1.0 (private)"


class TMDBError(Exception):
    def __init__(self, msg, status=None):
        super().__init__(msg)
        self.status = status


class TMDB:
    def __init__(self, api_key=None, read_token=None, base_url=None, delay=None):
        self.api_key = api_key if api_key is not None else config.TMDB_API_KEY
        self.read_token = read_token if read_token is not None else config.TMDB_READ_TOKEN
        self.base_url = (base_url or config.TMDB_BASE_URL).rstrip("/")
        self.delay = config.TMDB_DELAY if delay is None else delay
        self._last = 0.0
        self.requests = 0

    @property
    def configured(self):
        return bool(self.api_key or self.read_token)

    # ------------------------------------------------------------------ Kern
    def get(self, path, params=None, retries=5):
        if not self.configured:
            raise TMDBError("Kein TMDB-Zugang: TMDB_API_KEY oder TMDB_READ_TOKEN in der .env eintragen.")
        params = {k: v for k, v in (params or {}).items() if v is not None and v != ""}
        if self.api_key:
            params["api_key"] = self.api_key
        url = f"{self.base_url}/{path.lstrip('/')}"
        if params:
            url += "?" + urllib.parse.urlencode(params, safe=",|")
        headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
        if self.read_token and not self.api_key:
            headers["Authorization"] = f"Bearer {self.read_token}"

        attempt = 0
        while True:
            wait = self.delay - (time.monotonic() - self._last)
            if wait > 0:
                time.sleep(wait)
            self._last = time.monotonic()
            self.requests += 1
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=20) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as e:
                status = e.code
                if status == 404:
                    raise TMDBError(f"Nicht gefunden: {path}", 404)
                if status == 401:
                    raise TMDBError("TMDB lehnt den Zugang ab (401): API-Key/Token prüfen.", 401)
                if status == 429 or status >= 500:
                    attempt += 1
                    if attempt > retries:
                        raise TMDBError(f"TMDB-Fehler {status} nach {retries} Versuchen: {path}", status)
                    retry_after = e.headers.get("Retry-After") if e.headers else None
                    try:
                        pause = float(retry_after) if retry_after else 0
                    except ValueError:
                        pause = 0
                    time.sleep(max(pause, min(30, 1.5 ** attempt + random.random())))
                    continue
                raise TMDBError(f"TMDB-Fehler {status}: {path}", status)
            except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
                attempt += 1
                if attempt > retries:
                    raise TMDBError(f"Keine Verbindung zu TMDB: {e}")
                time.sleep(min(30, 1.5 ** attempt + random.random()))

    # ------------------------------------------------------------- Endpunkte
    def movie(self, tmdb_id):
        return self.get(
            f"movie/{int(tmdb_id)}",
            {
                "language": config.LANG,
                "append_to_response": "credits,videos,release_dates,watch/providers,translations,recommendations,keywords",
                "include_video_language": "de,en,null",
            },
        )

    def movie_list(self, kind, page=1):
        """kind: popular | top_rated | now_playing | upcoming"""
        return self.get(f"movie/{kind}", {"language": config.LANG, "region": config.REGION, "page": page})

    def discover(self, page=1, **filters):
        params = {"language": config.LANG, "include_adult": "false", "page": page}
        params.update({k.replace("__", "."): v for k, v in filters.items()})
        return self.get("discover/movie", params)

    def search(self, query, year=None, page=1):
        return self.get(
            "search/movie",
            {"query": query, "language": config.LANG, "region": config.REGION,
             "include_adult": "false", "primary_release_year": year, "page": page},
        )

    def search_keyword(self, query, page=1):
        return self.get("search/keyword", {"query": query, "page": page})

    def genres(self):
        return self.get("genre/movie/list", {"language": "de"}).get("genres", [])

    def providers(self):
        return self.get("watch/providers/movie", {"language": config.LANG, "watch_region": config.REGION}).get("results", [])
