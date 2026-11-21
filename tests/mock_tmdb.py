"""TMDB-Simulator für Tests (ohne API-Key). Bildet die genutzten v3-Endpunkte nach.

Start:  python3 tests/mock_tmdb.py 8999
Dann:   TMDB_BASE_URL=http://127.0.0.1:8999/3 TMDB_IMAGE_URL=http://127.0.0.1:8999/t/p TMDB_API_KEY=test
"""
import io
import json
import random
import sys
import threading
import urllib.parse
from datetime import date, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

GENRES = [
    (28, "Action"), (12, "Abenteuer"), (16, "Animation"), (35, "Komödie"), (80, "Krimi"),
    (99, "Dokumentarfilm"), (18, "Drama"), (10751, "Familie"), (14, "Fantasy"), (36, "Historie"),
    (27, "Horror"), (10402, "Musik"), (9648, "Mystery"), (10749, "Liebesfilm"), (878, "Science Fiction"),
    (10770, "TV-Film"), (53, "Thriller"), (10752, "Kriegsfilm"), (37, "Western"),
]
PROVIDERS = [(8, "Netflix", 1), (9, "Amazon Prime Video", 2), (337, "Disney Plus", 3), (350, "Apple TV+", 4),
             (30, "WOW", 5), (531, "Paramount Plus", 6), (2, "Apple TV", 7), (10, "Amazon Video", 8),
             (300, "Pluto TV", 9), (178, "MagentaTV", 10)]
KEYWORDS = [(9663, "psychothriller"), (12565, "psychological thriller"), (10714, "serial killer"),
            (9748, "revenge"), (4565, "dystopia"), (9882, "space"), (6152, "supernatural"), (3133, "vampire")]
WORDS = ["Nacht", "Schatten", "Stadt", "Herz", "Feuer", "Spiegel", "Stille", "Jagd", "Insel", "Sturm",
         "Erbe", "Zeit", "Licht", "Wolf", "Grenze", "Spur", "Traum", "Echo", "Eis", "Glanz"]
NAMES = ["Anna Berg", "Lukas Hahn", "Mia Krause", "Jonas Wolf", "Lea Fuchs", "Paul Richter", "Emma Vogel",
         "Ben Schäfer", "Sofia Lang", "Noah Keller", "Clara Brandt", "Elias Frank", "Hanna Roth", "Finn Graf"]
TODAY = date.today()
N = 2200
MOVIES = {}


def _build():
    rnd = random.Random(42)
    for i in range(N):
        mid = 1000 + i
        r = rnd.random()
        if i < 60:
            rd = TODAY - timedelta(days=rnd.randint(0, 40))          # im Kino
        elif i < 120:
            rd = TODAY + timedelta(days=rnd.randint(5, 120))          # demnächst
        elif r < 0.2:
            rd = date(rnd.randint(1940, 1989), rnd.randint(1, 12), rnd.randint(1, 28))
        else:
            rd = date(rnd.randint(1990, TODAY.year), rnd.randint(1, 12), rnd.randint(1, 28))
            if rd > TODAY:
                rd = TODAY - timedelta(days=rnd.randint(50, 400))
        genres = rnd.sample(GENRES, rnd.randint(1, 3))
        title = f"{rnd.choice(WORDS)} der {rnd.choice(WORDS)}" if rnd.random() < 0.5 else f"Die {rnd.choice(WORDS)} {i}"
        if i == 7:
            title = "Dune: Part Two"
        no_de = rnd.random() < 0.1
        upcoming = rd > TODAY
        MOVIES[mid] = {
            "id": mid, "title": "" if (i % 97 == 5) else title, "original_title": f"Original {title}",
            "release_date": rd.isoformat(), "runtime": rnd.randint(80, 170),
            "vote_average": 0.0 if upcoming else round(rnd.uniform(3.5, 8.9), 3),
            "vote_count": 0 if upcoming else int(rnd.paretovariate(1.2) * 80),
            "popularity": round(rnd.paretovariate(1.5) * 5, 3),
            "overview": "" if no_de else f"Deutsche Beschreibung von {title}. Eine Geschichte über {rnd.choice(WORDS)} und {rnd.choice(WORDS)}.",
            "overview_en": f"English overview of {title}.",
            "genres": [{"id": g, "name": n} for g, n in genres],
            "poster_path": None if i % 53 == 3 else f"/p{mid}.jpg",
            "backdrop_path": None if i % 41 == 4 else f"/b{mid}.jpg",
            "fsk": rnd.choice(["0", "6", "12", "16", "18", ""]),
            "director": rnd.choice(NAMES), "cast": rnd.sample(NAMES, 7),
            "keywords": rnd.sample(KEYWORDS, rnd.randint(0, 2)),
            "providers": {k: rnd.sample(PROVIDERS, rnd.randint(0, 2)) for k in ("flatrate", "rent", "buy", "ads", "free")
                          if rnd.random() < 0.45},
            "videos": [
                {"iso_639_1": lang, "iso_3166_1": "DE" if lang == "de" else "US", "name": f"{title} – {t} ({lang})",
                 "key": f"yt{mid}{lang}{t[0]}", "site": "YouTube", "size": 1080, "type": t,
                 "official": off, "published_at": f"{rd.year}-01-01T10:00:00.000Z", "id": f"v{mid}{lang}{t}"}
                for lang, t, off in ([("en", "Trailer", True), ("de", "Trailer", True), ("de", "Teaser", False),
                                      ("en", "Featurette", True)] if i % 3 else [("en", "Trailer", True)])
            ] if i % 11 else [],
            "adult": False,
        }


_build()
FAIL = {"n": 0}  # jede x-te Detailanfrage mit 429 beantworten (Wiederholung testen)
_lock = threading.Lock()


def _summary(m):
    return {k: m[k] for k in ("id", "title", "original_title", "release_date", "vote_average", "vote_count",
                              "popularity", "poster_path", "backdrop_path", "adult")} | {
        "overview": m["overview"], "genre_ids": [g["id"] for g in m["genres"]]}


def _page(items, page, per=20):
    page = max(1, int(page or 1))
    total_pages = max(1, (len(items) + per - 1) // per)
    return {"page": page, "results": [_summary(m) for m in items[(page - 1) * per: page * per]],
            "total_pages": min(total_pages, 500), "total_results": len(items)}


def _detail(m):
    out = _summary(m)
    out.pop("genre_ids")
    out.update({
        "runtime": m["runtime"], "genres": m["genres"], "tagline": "", "status": "Released",
        "credits": {
            "cast": [{"id": 50000 + j, "name": n, "character": f"Rolle {j}", "order": j, "profile_path": None}
                     for j, n in enumerate(m["cast"])],
            "crew": [{"id": 60000, "name": m["director"], "job": "Director", "profile_path": None},
                     {"id": 60001, "name": "Kamera Mann", "job": "Director of Photography"}],
        },
        "videos": {"results": m["videos"]},
        "release_dates": {"results": [
            {"iso_3166_1": "US", "release_dates": [{"certification": "R", "type": 3, "release_date": m["release_date"] + "T00:00:00.000Z"}]},
            {"iso_3166_1": "DE", "release_dates": [{"certification": "", "type": 1, "release_date": m["release_date"] + "T00:00:00.000Z"},
                                                   {"certification": m["fsk"], "type": 3, "release_date": m["release_date"] + "T00:00:00.000Z"}]},
        ]},
        "watch/providers": {"results": ({"DE": {"link": f"https://www.themoviedb.org/movie/{m['id']}/watch?locale=DE",
                                                **{k: [{"provider_id": p, "provider_name": n, "logo_path": f"/logo{p}.jpg",
                                                        "display_priority": pr} for p, n, pr in v]
                                                   for k, v in m["providers"].items()}}} if m["providers"] else {})},
        "translations": {"translations": [
            {"iso_639_1": "en", "iso_3166_1": "US", "data": {"title": m["original_title"], "overview": m["overview_en"], "tagline": ""}}]},
        "recommendations": {"results": [_summary(MOVIES[1000 + ((m["id"] - 1000) * 7 + k) % N]) for k in range(1, 9)]},
        "keywords": {"keywords": [{"id": k, "name": n} for k, n in m["keywords"]]},
    })
    return out


def _image(path):
    try:
        from PIL import Image, ImageDraw
        seed = sum(map(ord, path))
        w, h = (342, 513) if "/p" in path and "/w342/" in path else (780, 1170) if "/p" in path else \
               (92, 92) if "logo" in path else (1280, 720)
        img = Image.new("RGB", (w, h), ((seed * 37) % 200, (seed * 91) % 120, (seed * 53) % 160))
        d = ImageDraw.Draw(img)
        d.rectangle([w // 10, h // 10, w - w // 10, h - h // 10], outline=(255, 255, 255), width=max(2, w // 80))
        d.text((w // 8, h // 2), path.rsplit("/", 1)[-1], fill=(255, 255, 255))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=70)
        return buf.getvalue()
    except ImportError:
        return b"\xff\xd8\xff\xe0" + b"0" * 200


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, obj, status=200):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        if status == 429:
            self.send_header("Retry-After", "0")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        p = u.path
        if p.startswith("/t/p/"):
            name = p.split("/")[-1]
            if "missing" in name:
                self.send_response(404); self.end_headers(); return
            body = _image(p)
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if q.get("api_key") != "test" and self.headers.get("Authorization") != "Bearer test":
            return self._json({"status_code": 7, "status_message": "Invalid API key"}, 401)
        p = p[2:] if p.startswith("/3") else p
        allm = list(MOVIES.values())
        today = TODAY.isoformat()
        if p.startswith("/movie/") and p.count("/") == 2 and p.split("/")[2].isdigit():
            with _lock:
                FAIL["n"] += 1
                if FAIL["n"] % 37 == 0:
                    return self._json({"status_message": "Too many requests"}, 429)
            mid = int(p.split("/")[2])
            if mid not in MOVIES:
                return self._json({"status_message": "not found"}, 404)
            return self._json(_detail(MOVIES[mid]))
        if p == "/movie/popular":
            return self._json(_page(sorted(allm, key=lambda m: -m["popularity"]), q.get("page")))
        if p == "/movie/top_rated":
            return self._json(_page(sorted([m for m in allm if m["vote_count"] > 200], key=lambda m: -m["vote_average"]), q.get("page")))
        if p == "/movie/now_playing":
            return self._json(_page([m for m in allm if TODAY - timedelta(days=45) <= date.fromisoformat(m["release_date"]) <= TODAY], q.get("page")))
        if p == "/movie/upcoming":
            return self._json(_page([m for m in allm if m["release_date"] > today], q.get("page")))
        if p == "/discover/movie":
            items = allm
            if q.get("with_genres"):
                gid = int(q["with_genres"])
                items = [m for m in items if any(g["id"] == gid for g in m["genres"])]
            if q.get("with_keywords"):
                ks = {int(k) for k in q["with_keywords"].replace(",", "|").split("|")}
                items = [m for m in items if any(k in ks for k, _ in m["keywords"])]
            if q.get("primary_release_date.gte"):
                items = [m for m in items if m["release_date"] >= q["primary_release_date.gte"]]
            if q.get("primary_release_date.lte"):
                items = [m for m in items if m["release_date"] <= q["primary_release_date.lte"]]
            if q.get("vote_count.gte"):
                items = [m for m in items if m["vote_count"] >= int(q["vote_count.gte"])]
            if q.get("with_watch_monetization_types"):
                items = [m for m in items if m["providers"].get("flatrate")]
            key = q.get("sort_by", "popularity.desc").split(".")[0]
            key = {"primary_release_date": "release_date"}.get(key, key)
            items = sorted(items, key=lambda m: m.get(key) or 0, reverse=True)
            return self._json(_page(items, q.get("page")))
        if p == "/search/movie":
            s = q.get("query", "").lower()
            items = [m for m in allm if s in m["title"].lower() or s in m["original_title"].lower()]
            if q.get("primary_release_year"):
                items = [m for m in items if m["release_date"][:4] == q["primary_release_year"]]
            return self._json(_page(sorted(items, key=lambda m: -m["popularity"]), q.get("page")))
        if p == "/search/keyword":
            s = q.get("query", "").lower()
            res = [{"id": k, "name": n} for k, n in KEYWORDS if s in n or n in s]
            return self._json({"page": 1, "results": res, "total_pages": 1})
        if p == "/genre/movie/list":
            return self._json({"genres": [{"id": g, "name": n} for g, n in GENRES]})
        if p == "/watch/providers/movie":
            return self._json({"results": [{"provider_id": p_, "provider_name": n, "logo_path": f"/logo{p_}.jpg",
                                            "display_priority": pr, "display_priorities": {"DE": pr}} for p_, n, pr in PROVIDERS]})
        return self._json({"status_message": "unknown"}, 404)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8999
    print(f"Mock-TMDB auf :{port} mit {len(MOVIES)} Filmen")
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
