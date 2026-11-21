# AURA KINO – Anleitung für Claude Code

Private Film-Web-App (Filmbuch): Merkliste, Filmtagebuch, eigene Bewertungen/Notizen/Filmfehler,
Katalog mit automatischen Filmen von TMDB. Läuft auf einer Armbian-Box, Zugriff per iPhone über LAN/Tailscale.

## Zwei Betriebsarten (gleicher Code, gleiche Oberfläche)
1. **GitHub (kostenlos, Hauptvariante):** GitHub Pages zeigt die App, GitHub Actions (`.github/workflows/aura-kino.yml`)
   pflegt den Katalog. Die Katalog-DB liegt zwischen den Läufen im Branch `katalog-daten` (nur TMDB-Daten).
   Im Browser übernimmt `web/local.js` die Rolle des Servers; persönliche Daten: IndexedDB + Sync in das **private**
   Repo `<owner>/aura-kino-daten` (Datei `aura-daten.json`) per Token, den der Nutzer in „Mehr → GitHub-Sync“ einträgt.
2. **Box (Armbian):** `server.py` + SQLite + systemd (siehe unten). Persönliche Daten in der SQLite-DB.

### GitHub-Variante bedienen
- Filme hinzufügen/importieren = Workflow starten (`aura-kino.yml`, Branch `main`) mit Inputs:
  `aktion=add` + `titel="Prisoners"` (oder `tmdb=146233`) · `aktion=import` + `genre=horror` / `liste="psychological thriller"`,
  `von`, `bis`, `anzahl` · `aktion=update` · `aktion=init` · `aktion=deploy` (nur Seite neu bauen).
  Für Claude Code: GitHub-MCP `actions_run_trigger` (method `run_workflow`, workflow `aura-kino.yml`, ref `main`, inputs wie oben).
  „mach 50 neue Horrorfilme rein“ → `aktion=import, genre=horror, anzahl=50`.
- Benötigt: Secret `TMDB_READ_TOKEN` (oder `TMDB_API_KEY`), Pages-Quelle „GitHub Actions“.
- Fehler finden: Actions-Tab → letzter Lauf „AURA KINO“ (Zusammenfassung zeigt `kino stats`); `update.log` liegt im Branch `katalog-daten`.
- Persönliche Daten nie ins öffentliche Repo schreiben. `aura/static_export.py` exportiert ausschließlich Katalogdaten.
- Nach Änderungen an `web/` → in `web/sw.js` `VERSION` hochzählen; Push auf `main` baut die Seite automatisch neu.
- Lokal testen: `python3 kino.py export-static /tmp/pages/jsjd` + `python3 -m http.server -d /tmp/pages` →
  `http://127.0.0.1:8000/jsjd/`; Sync-Simulator `python3 tests/mock_github.py 8600`, Test `node tests/ui-static.js …`.

## Wo liegt was (auf der Box)
| Was | Pfad |
|---|---|
| Programm (Git-Checkout) | `/opt/aura-kino` |
| Daten (DB, Bilder, Backups, Logs, `.env`) | `/var/lib/aura-kino` |
| Datenbank | `/var/lib/aura-kino/aura.db` (SQLite) |
| TMDB-Key + Einstellungen | `/var/lib/aura-kino/.env` (nie ins Git, nie ins Frontend) |
| Update-Log | `/var/lib/aura-kino/logs/update.log` |
| Backups (14 Stück, täglich) | `/var/lib/aura-kino/backups/aura-*.db` + `aura-*.json` |
| Server-Dienst | `aura-kino.service` (Port 8420) |
| Tägliches Update | `aura-kino-update.timer` → `aura-kino-update.service` (04:00, Backup + Update) |

Der Befehl `kino` (= `/usr/local/bin/kino`) ruft `python3 /opt/aura-kino/kino.py` immer als Benutzer `aura`
mit dem richtigen Datenordner auf. **Immer `kino …` benutzen, nicht `python3 kino.py` als root** (sonst
gehören neue Dateien root; `kino.py` wechselt zur Sicherheit aber selbst zum Besitzer des Datenordners).

## Filme hinzufügen (häufigste Aufgabe)
```bash
kino add "Dune" --jahr 2021          # suchen + hinzufügen; bei mehreren Treffern Auswahl (nicht interaktiv: Treffer 1)
kino add "Dune" --erster             # ohne Nachfrage den ersten Treffer
kino add --tmdb 438631               # direkt per TMDB-ID (eindeutig, bevorzugt für Claude)
kino import --genre horror --anzahl 50                      # "mach 50 neue Horrorfilme rein"
kino import --genre thriller --von 2017 --bis 2026 --anzahl 100
kino import --liste "psycho thriller" --anzahl 30           # Thema über TMDB-Keywords (+ Titelsuche)
kino import --liste "serial killer" --von 2010 --anzahl 40
```
- Genres verstehen deutsch und englisch: horror, thriller, action, krimi/crime, drama, komödie/comedy,
  scifi, fantasy, mystery, abenteuer, animation, doku, liebesfilm/romance, krieg, western, familie, historie, musik.
- `--liste` arbeitet mit **englischen** TMDB-Keywords. Bei deutschen Wünschen übersetzen:
  „Psychothriller“ → `"psychological thriller"`, „wahre Begebenheit“ → `"based on true story"`,
  „Zeitreise“ → `"time travel"`, „Serienkiller“ → `"serial killer"`, „Weltraum“ → `"space"`.
- `--anzahl` zählt nur **neue** Filme; schon vorhandene werden übersprungen.
- Mit `add` geholte Filme sind dauerhaft vor dem automatischen Aufräumen geschützt, per `import` geholte 90 Tage.

## Weitere Befehle
```bash
kino stats                 # Überblick: Filme, Grenze, meine Daten, letzte Läufe, unterbrochener Import?
kino update                # tägliches Update sofort (neue Filme + alle auffrischen + Aufräumen)
kino update --nur-neu      # nur neue Filme, ohne alle aufzufrischen (schneller)
kino refresh 438631        # einen Film neu von TMDB laden (mehrere IDs möglich)
kino init                  # Erst-Import (bis 1000); nach Abbruch einfach erneut starten → macht weiter
kino backup                # Backup jetzt (DB + JSON in backups/), --ausgabe datei.json für Extra-Export
kino restore datei.json    # JSON-Sicherung zurückspielen (führt zusammen; --ersetzen überschreibt)
kino prune --test          # zeigt, wie viele Filme die Obergrenze entfernen würde
kino remove 12345          # Film löschen (verweigert, wenn er meine Daten enthält; --force)
kino pin 1234 | kino pin --aus
```
Es läuft immer nur ein Import/Update gleichzeitig (Sperrdatei `update.lock`). Meldung „läuft bereits“ → warten.

## Server / Dienste
```bash
sudo systemctl restart aura-kino                 # Server neu starten (nach Code- oder .env-Änderung)
sudo systemctl status aura-kino
journalctl -u aura-kino -n 100 --no-pager        # Server-Fehler
systemctl list-timers aura-kino-update.timer     # wann läuft das nächste Update?
sudo systemctl start aura-kino-update.service    # Update wie nachts (inkl. Backup) jetzt auslösen
journalctl -u aura-kino-update -n 100 --no-pager
tail -n 50 /var/lib/aura-kino/logs/update.log    # jedes Update: wann, wie viele neu, Fehler
sudo /opt/aura-kino/deploy/update-app.sh         # neue App-Version aus Git holen + Neustart
```

## Fehlersuche
- **App lädt nicht:** `systemctl status aura-kino`, dann `journalctl -u aura-kino -n 100`. Port belegt? `ss -ltnp | grep 8420`.
- **403 „Nur im Heimnetz/Tailscale“:** Client-IP liegt nicht in `AURA_ALLOWED_NETS` (.env). Tailscale ist 100.64.0.0/10.
- **TMDB 401:** Key/Token in `/var/lib/aura-kino/.env` prüfen (`TMDB_READ_TOKEN=` langer Token oder `TMDB_API_KEY=`), dann Neustart.
- **Update hängt / „läuft bereits“:** `kino stats`, `ps aux | grep kino.py`; die Sperre löst sich automatisch, wenn der Prozess endet.
- **Erst-Import abgebrochen:** `kino init` erneut → setzt fort (Warteschlange in Tabelle `import_queue`).
- **Datenbank kaputt / Daten zurückholen:** `ls -1t /var/lib/aura-kino/backups/`, dann
  `sudo /opt/aura-kino/deploy/restore-db.sh /var/lib/aura-kino/backups/aura-….db` (stoppt/startet Server,
  sichert vorher den aktuellen Stand). Nur meine Einträge: `kino restore /var/lib/aura-kino/backups/aura-….json`.
- **Bilder fehlen:** `kino refresh <tmdb_id>` lädt Poster/Backdrop neu (Cache: `/var/lib/aura-kino/images/`).

## Regeln (wichtig)
- **Niemals** Filme löschen, die meine Daten haben (Merkliste, gesehen, bewertet, Notiz, Filmfehler, eigene Filme).
  Das Aufräumen (`catalog.prune`) prüft das über `db.MINE_SQL` – diese Logik nicht aufweichen.
- Meine Filme zählen nicht zur Grenze von 1000 (`AURA_CATALOG_LIMIT`).
- TMDB-Key nur im Backend (`.env`). Nichts davon ins Frontend, in Logs oder ins Git.
- Nur Metadaten, offizielle YouTube-Trailer (youtube-nocookie) und legale Anbieter-Links. Keine Downloads, keine Streams.
- TMDB-Attribution im Footer und „Streaming-Daten: JustWatch“ müssen bleiben.
- Server nur LAN/Tailscale; keine Portfreigaben im Router.

## Code-Überblick
- `kino.py` – Kommandozeile · `server.py` – HTTP-Server + JSON-API (nur Standardbibliothek)
- `aura/config.py` (.env, Pfade, Geschmacksprofil) · `aura/db.py` (Schema, `MINE_SQL`) · `aura/tmdb.py` (Client, Pausen, Retry bei 429/5xx)
- `aura/catalog.py` (Film speichern, Erst-Import, Update, Profil, Obergrenze) · `aura/images.py` (Bild-Cache) · `aura/backup.py`
- `web/` – `index.html`, `app.css`, `app.js` (Hash-Router, alle Seiten), `sw.js` (Offline), `manifest.json`, Icons, Inter-Schrift
- Nach Änderungen an `web/app.js`/`app.css`: in `web/sw.js` `VERSION` hochzählen, damit iPhones die neue Version laden.
- Tests: `python3 tests/mock_tmdb.py 8999` (TMDB-Simulator) + `node tests/ui-test.js http://127.0.0.1:8420 /tmp`.

## Geschmacksprofil (`.env`)
`AURA_GENRES`, `AURA_THEMES`, `AURA_YEAR_FROM`, `AURA_YEAR_TO` steuern Erst-Import und tägliches Update
(aktuell: Thriller, Horror, Action, Krimi, Mystery; Themen Psychothriller + wahre Begebenheiten; ab 2015).
Nach Änderung: `sudo systemctl restart aura-kino` – wirkt ab dem nächsten Update. Filme außerhalb des Profils
werden beim Aufräumen zuerst entfernt (außer sie gehören zu „meinen“ Filmen).
