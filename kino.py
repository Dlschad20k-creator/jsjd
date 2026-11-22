#!/usr/bin/env python3
"""AURA KINO – Kommandozeile.

Beispiele:
  python3 kino.py init                         Erst-Import (bis 1000 Filme, fortsetzbar)
  python3 kino.py add "Dune" --jahr 2021       Film suchen und hinzufügen
  python3 kino.py add --tmdb 438631            Film per TMDB-ID hinzufügen
  python3 kino.py import --genre horror --von 2015 --bis 2026 --anzahl 50
  python3 kino.py import --liste "psycho thriller" --anzahl 30
  python3 kino.py update                       tägliches Update sofort ausführen
  python3 kino.py refresh 438631               einen Film neu laden
  python3 kino.py stats | backup | restore datei.json | serve
"""
import argparse
import json
import sys
from pathlib import Path

from aura import backup, catalog, config, db
from aura.tmdb import TMDB, TMDBError


class UpdateLock:
    """Verhindert parallele Importe/Updates (Timer + Knopf in der App)."""

    def __init__(self):
        import fcntl, os
        self.fcntl, self.os = fcntl, os
        config.ensure_dirs()
        self.path = config.DATA_DIR / "update.lock"

    def __enter__(self):
        self.f = open(self.path, "a+")
        try:
            self.fcntl.flock(self.f, self.fcntl.LOCK_EX | self.fcntl.LOCK_NB)
        except OSError:
            sys.exit("Es läuft bereits ein Import/Update. Bitte warten (siehe 'python3 kino.py stats').")
        self.f.seek(0); self.f.truncate(); self.f.write(str(self.os.getpid())); self.f.flush()
        return self

    def __exit__(self, *exc):
        try:
            self.f.seek(0); self.f.truncate(); self.f.flush()
        finally:
            self.fcntl.flock(self.f, self.fcntl.LOCK_UN)
            self.f.close()
        return False


LOCKED = {"init", "import", "update", "daily", "add"}


def _conn():
    conn = db.connect()
    db.init(conn)
    return conn


def _api():
    api = TMDB()
    if not api.configured:
        sys.exit("Kein TMDB-Zugang. Trage TMDB_API_KEY=… (oder TMDB_READ_TOKEN=…) in "
                 f"{config.DATA_DIR / '.env'} ein.")
    return api


def _fmt_movie(r):
    y = f" ({r['year']})" if r.get("year") else ""
    rating = f"  ★ {r['vote_average']:.1f}" if r.get("vote_average") else ""
    return f"{r.get('title')}{y}{rating}"


# ---------------------------------------------------------------- Befehle
def cmd_init(a):
    conn, api = _conn(), _api()
    res = catalog.initial_import(conn, api, total=a.anzahl, quiet=a.leise)
    c = catalog.catalog_counts(conn)
    print(f"Fertig: {res['added']} neu, {res['errors']} Fehler, {res['removed']} entfernt. "
          f"Katalog: {c['total']} Filme.")


def cmd_add(a):
    conn, api = _conn(), _api()
    run_id = catalog.start_run(conn, "add")
    if a.tmdb:
        ids = [a.tmdb]
    else:
        if not a.titel:
            sys.exit("Titel oder --tmdb angeben.")
        res = api.search(a.titel, year=a.jahr).get("results", [])
        if not res and a.jahr:
            res = api.search(a.titel).get("results", [])
        if not res:
            catalog.finish_run(conn, run_id, status="ok", message=f"Nichts gefunden: {a.titel}")
            sys.exit(f"Nichts gefunden für „{a.titel}“.")
        res = res[:10]
        if len(res) == 1 or a.erster:
            ids = [res[0]["id"]]
        else:
            print(f"Mehrere Treffer für „{a.titel}“:")
            for i, r in enumerate(res, 1):
                year = (r.get("release_date") or "")[:4]
                in_cat = " [schon drin]" if conn.execute("SELECT 1 FROM movies WHERE tmdb_id=?", (r["id"],)).fetchone() else ""
                print(f"  {i:2}) {r.get('title')} ({year or '?'})  ★ {r.get('vote_average', 0):.1f}  tmdb={r['id']}{in_cat}")
            if not sys.stdin.isatty():
                print("Nicht interaktiv: nehme Treffer 1 (mit --tmdb ID gezielt wählen).")
                ids = [res[0]["id"]]
            else:
                choice = input("Nummer wählen (mehrere mit Komma, Enter = 1, 0 = abbrechen): ").strip() or "1"
                if choice == "0":
                    catalog.finish_run(conn, run_id, message="abgebrochen")
                    return
                ids = []
                for part in choice.split(","):
                    if part.strip().isdigit() and 1 <= int(part) <= len(res):
                        ids.append(res[int(part) - 1]["id"])
    added = 0
    for tid in ids:
        try:
            mid, is_new = catalog.fetch_and_save(conn, api, tid, run_id=run_id, keep=True)
        except TMDBError as e:
            print(f"Fehler: {e}")
            continue
        row = conn.execute("SELECT * FROM movies WHERE id=?", (mid,)).fetchone()
        print(("Hinzugefügt: " if is_new else "Schon im Katalog (aktualisiert): ") + _fmt_movie(dict(row)) + f"  [id {mid}]")
        added += int(is_new)
    removed = catalog.prune(conn, protect_run_id=run_id)
    catalog.finish_run(conn, run_id, added=added, removed=removed)


def cmd_import(a):
    conn, api = _conn(), _api()
    if not a.genre and not a.liste:
        sys.exit("--genre oder --liste angeben.")
    if a.genre:
        g = catalog.resolve_genre(conn, api, a.genre)
        print(f"Suche {a.anzahl} Filme im Genre „{g['name']}“ ({a.von or '…'}–{a.bis or '…'}) …")
        cands = catalog.genre_candidates(api, g["id"], a.von, a.bis, a.anzahl, f"genre:{g['name']}")
        params = {"genre": g["name"], "von": a.von, "bis": a.bis, "anzahl": a.anzahl}
        kind = "genre"
    else:
        print(f"Suche {a.anzahl} Filme zum Thema „{a.liste}“ …")
        cands = catalog.list_candidates(api, a.liste, a.anzahl, a.von, a.bis)
        params = {"liste": a.liste, "von": a.von, "bis": a.bis, "anzahl": a.anzahl}
        kind = "list"
    new = [c for c in cands if not conn.execute("SELECT 1 FROM movies WHERE tmdb_id=?", (c[0],)).fetchone()]
    print(f"{len(cands)} Treffer, davon {len(new)} noch nicht im Katalog.")
    res = catalog.import_candidates(conn, api, kind, params, cands, a.anzahl, quiet=a.leise)
    c = catalog.catalog_counts(conn)
    print(f"Fertig: {res['added']} neu hinzugefügt, {res['errors']} Fehler, {res['removed']} alte entfernt. "
          f"Katalog: {c['total']} Filme.")


def cmd_update(a):
    conn, api = _conn(), _api()
    if a.mit_backup:
        p = backup.backup_db(conn)
        print(f"Backup: {p}")
    res = catalog.daily_update(conn, api, refresh_all=not a.nur_neu, quiet=a.leise)
    print(f"Update fertig: {res['added']} neu, {res['refreshed']} aktualisiert, "
          f"{res['removed']} entfernt, {res['errors']} Fehler.")


def cmd_daily(a):
    """Für den systemd-Timer: erst Backup, dann Update."""
    a.mit_backup = True
    a.nur_neu = False
    cmd_update(a)


def cmd_refresh(a):
    conn, api = _conn(), _api()
    for tid in a.tmdb_ids:
        try:
            mid, is_new = catalog.fetch_and_save(conn, api, tid)
            row = conn.execute("SELECT * FROM movies WHERE id=?", (mid,)).fetchone()
            print(("Neu: " if is_new else "Aktualisiert: ") + _fmt_movie(dict(row)))
        except TMDBError as e:
            print(f"{tid}: {e}")


def cmd_remove(a):
    conn = _conn()
    row = conn.execute("SELECT * FROM movies WHERE tmdb_id=? OR (id=? AND source='manual')", (a.tmdb_id, a.tmdb_id)).fetchone()
    if not row:
        sys.exit("Nicht im Katalog.")
    if db.is_mine(conn, row["id"]) and not a.force:
        sys.exit(f"„{row['title']}“ enthält deine Daten (gemerkt/gesehen/bewertet/Notiz/Fehler). Mit --force trotzdem löschen.")
    conn.execute("DELETE FROM movies WHERE id=?", (row["id"],))
    print(f"Entfernt: {row['title']}")


def cmd_stats(a):
    conn = _conn()
    c = catalog.catalog_counts(conn)
    q = lambda sql, *p: conn.execute(sql, p).fetchone()[0]
    print("AURA KINO – Statistik")
    print(f"  Filme gesamt:          {c['total']}")
    print(f"  davon Katalog:         {c['catalog']} / Grenze {config.CATALOG_LIMIT}")
    print(f"  davon meine Filme:     {c['mine']}  (zählen nicht zur Grenze)")
    print(f"  per Befehl geschützt:  {c['keep']}")
    print(f"  Eigene Filme (manuell): {q('SELECT COUNT(*) FROM movies WHERE source=?', 'manual')}")
    print(f"  Merkliste:             {q('SELECT COUNT(*) FROM watchlist')}")
    print(f"  Geschaut (Einträge):   {q('SELECT COUNT(*) FROM views')}")
    print(f"  Bewertet:              {q('SELECT COUNT(*) FROM ratings')}")
    print(f"  Notizen:               {q('SELECT COUNT(*) FROM notes WHERE trim(text) <> ?', '')}")
    print(f"  Filmfehler:            {q('SELECT COUNT(*) FROM goofs')}")
    print(f"  Mit Trailer:           {q('SELECT COUNT(DISTINCT movie_id) FROM trailers')}")
    print(f"  Mit Streaming (DE):    {q('SELECT COUNT(DISTINCT movie_id) FROM movie_providers')}")
    print(f"  Poster lokal:          {q('SELECT COUNT(*) FROM movies WHERE poster_local IS NOT NULL')}")
    print("  Letzte Läufe:")
    for r in conn.execute("SELECT * FROM update_runs ORDER BY id DESC LIMIT 5"):
        print(f"    #{r['id']} {r['kind']:7} {r['started_at'][:16]}  +{r['added']} ~{r['refreshed']} -{r['removed']} "
              f"Fehler {r['errors']}  {r['status']}")
    job = conn.execute("SELECT * FROM import_jobs WHERE status='running' AND kind='initial'").fetchone()
    if job:
        left = q("SELECT COUNT(*) FROM import_queue WHERE job_id=? AND status='pending'", job["id"])
        print(f"  ⚠ Erst-Import unterbrochen, {left} Filme offen → 'python3 kino.py init'")


def cmd_backup(a):
    conn = _conn()
    p = backup.backup_db(conn)
    print(f"Datenbank-Backup: {p}")
    print(f"JSON (deine Daten): {p.with_suffix('.json')}")
    if a.ausgabe:
        Path(a.ausgabe).write_text(json.dumps(backup.export_data(conn), ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"Export: {a.ausgabe}")


def cmd_restore(a):
    conn = _conn()
    path = Path(a.datei)
    if path.suffix == ".db":
        sys.exit("Datenbank-Backups (.db) bitte mit 'deploy/restore-db.sh' zurückspielen (Server vorher stoppen).")
    data = json.loads(path.read_text(encoding="utf-8"))
    backup.backup_db(conn)  # Sicherheitskopie vor dem Zurückspielen
    api = TMDB()
    res = backup.import_data(conn, data, api=api if api.configured else None, replace=a.ersetzen)
    print(f"Wiederhergestellt: {res['movies']} Filme ({res['created']} neu angelegt), "
          f"{res['views']} Gesehen-Einträge, {res['goofs']} Filmfehler.")


def cmd_prune(a):
    conn = _conn()
    n = catalog.prune(conn, limit=a.grenze, dry_run=a.test)
    print(("Würde entfernen: " if a.test else "Entfernt: ") + f"{n} Filme")


def cmd_export_static(a):
    from aura import static_export
    conn = _conn()
    res = static_export.export(conn, a.ziel, repo=a.repo)
    print(f"Statische Seite: {res['movies']} Filme → {res['dir']}")


def cmd_export_artifact(a):
    from aura import artifact_export
    conn = _conn()
    res = artifact_export.export(conn, a.ziel)
    print(f"Artifact: {res['movies']} Filme, {res['sheets']} Poster-Sammelbilder "
          f"({res['missing_posters']} ohne Poster) → {res['dir']}")


def cmd_serve(a):
    import server
    server.main(a.host, a.port)


def cmd_pin(a):
    conn = _conn()
    import server
    if a.aus:
        db.set_setting(conn, "pin_enabled", "0")
        print("PIN-Schutz ausgeschaltet.")
    else:
        server.set_pin(conn, a.pin)
        print("PIN gesetzt und eingeschaltet.")


def _drop_root():
    """Als root gestartet? Dann als Besitzer des Datenordners weitermachen (keine root-Dateien im Datenordner)."""
    import os
    if os.geteuid() != 0 or not config.DATA_DIR.exists():
        return
    st = config.DATA_DIR.stat()
    if st.st_uid == 0:
        return
    import pwd
    pw = pwd.getpwuid(st.st_uid)
    os.setgroups([])
    os.setgid(st.st_gid)
    os.setuid(st.st_uid)
    os.environ["HOME"] = pw.pw_dir


def main(argv=None):
    p = argparse.ArgumentParser(prog="kino.py", description="AURA KINO – dein Filmbuch")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("init", help="Erst-Import (fortsetzbar)")
    s.add_argument("--anzahl", type=int, default=config.CATALOG_LIMIT)
    s.add_argument("--leise", action="store_true")
    s.set_defaults(fn=cmd_init)

    s = sub.add_parser("add", help="Film hinzufügen")
    s.add_argument("titel", nargs="?")
    s.add_argument("--jahr", type=int)
    s.add_argument("--tmdb", type=int)
    s.add_argument("--erster", action="store_true", help="ohne Nachfrage den ersten Treffer nehmen")
    s.set_defaults(fn=cmd_add)

    s = sub.add_parser("import", help="Viele Filme nach Genre oder Thema importieren")
    s.add_argument("--genre")
    s.add_argument("--liste")
    s.add_argument("--von", type=int)
    s.add_argument("--bis", type=int)
    s.add_argument("--anzahl", type=int, default=50)
    s.add_argument("--leise", action="store_true")
    s.set_defaults(fn=cmd_import)

    s = sub.add_parser("update", help="Update jetzt ausführen")
    s.add_argument("--nur-neu", action="store_true", help="nur neue Filme, bestehende nicht auffrischen")
    s.add_argument("--mit-backup", action="store_true")
    s.add_argument("--leise", action="store_true")
    s.set_defaults(fn=cmd_update)

    s = sub.add_parser("daily", help="Backup + Update (für den Timer)")
    s.add_argument("--leise", action="store_true")
    s.set_defaults(fn=cmd_daily)

    s = sub.add_parser("refresh", help="Film(e) neu von TMDB laden")
    s.add_argument("tmdb_ids", type=int, nargs="+")
    s.set_defaults(fn=cmd_refresh)

    s = sub.add_parser("remove", help="Film aus dem Katalog löschen")
    s.add_argument("tmdb_id", type=int)
    s.add_argument("--force", action="store_true")
    s.set_defaults(fn=cmd_remove)

    sub.add_parser("stats", help="Statistik").set_defaults(fn=cmd_stats)

    s = sub.add_parser("backup", help="Backup jetzt")
    s.add_argument("--ausgabe", help="zusätzlich JSON-Export in diese Datei")
    s.set_defaults(fn=cmd_backup)

    s = sub.add_parser("restore", help="JSON-Sicherung zurückspielen")
    s.add_argument("datei")
    s.add_argument("--ersetzen", action="store_true", help="vorhandene Einträge der Filme ersetzen statt zusammenführen")
    s.set_defaults(fn=cmd_restore)

    s = sub.add_parser("prune", help="Obergrenze jetzt anwenden")
    s.add_argument("--grenze", type=int)
    s.add_argument("--test", action="store_true")
    s.set_defaults(fn=cmd_prune)

    s = sub.add_parser("export-static", help="Webseite für GitHub Pages erzeugen")
    s.add_argument("ziel", nargs="?", default="site")
    s.add_argument("--repo", default=None)
    s.set_defaults(fn=cmd_export_static)

    s = sub.add_parser("export-artifact", help="App als claude.ai-Artifact bauen (braucht Pillow)")
    s.add_argument("ziel", nargs="?", default="artifact")
    s.set_defaults(fn=cmd_export_artifact)

    s = sub.add_parser("serve", help="Webserver starten")
    s.add_argument("--host", default=config.HOST)
    s.add_argument("--port", type=int, default=config.PORT)
    s.set_defaults(fn=cmd_serve)

    s = sub.add_parser("pin", help="PIN setzen oder ausschalten")
    s.add_argument("pin", nargs="?")
    s.add_argument("--aus", action="store_true")
    s.set_defaults(fn=cmd_pin)

    a = p.parse_args(argv)
    _drop_root()
    catalog.setup_logging()
    try:
        if a.cmd in LOCKED:
            with UpdateLock():
                a.fn(a)
        else:
            a.fn(a)
    except BrokenPipeError:
        pass
    except KeyboardInterrupt:
        print("\nAbgebrochen – nichts kaputt, einfach erneut starten.")
        sys.exit(130)
    except TMDBError as e:
        sys.exit(f"TMDB: {e}")
    except ValueError as e:
        sys.exit(str(e))


if __name__ == "__main__":
    main()
