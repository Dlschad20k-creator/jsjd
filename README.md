# AURA KINO

Dein privates Filmbuch: **Was will ich schauen, was habe ich geschaut, wie war es?** Dazu jeden Tag automatisch neue
Filme von TMDB, passend zu deinem Geschmack (Thriller, Psychothriller, Horror, Action, wahre Begebenheiten, ab 2015).

- Python 3 (nur Standardbibliothek) + SQLite, Frontend ohne Framework/Build, als PWA auf dem iPhone-Home-Bildschirm
- Läuft auf der Armbian-Box, erreichbar nur im Heimnetz und über Tailscale

## Variante A: Kostenlos auf GitHub (ohne Box)
Die App läuft auf **GitHub Pages** unter `https://dlschad20k-creator.github.io/jsjd/`.
**GitHub Actions** holt jede Nacht (ca. 04:00) neue Filme von TMDB und veröffentlicht die Seite neu.
Deine persönlichen Daten liegen auf dem iPhone und – verschlüsselt übertragen – in einem **privaten** Repo
`aura-kino-daten` (jede Änderung = eine Version, nichts geht verloren). Im öffentlichen Repo liegen nur Code
und öffentliche TMDB-Katalogdaten.

Einmalig einrichten (je ein Klick in GitHub):
1. **TMDB-Token als Secret:** [Settings → Secrets → Actions → New secret](https://github.com/Dlschad20k-creator/jsjd/settings/secrets/actions/new),
   Name `TMDB_READ_TOKEN`, Wert = dein „API Read Access Token“.
2. **Pages einschalten:** [Settings → Pages](https://github.com/Dlschad20k-creator/jsjd/settings/pages) → *Source*: **GitHub Actions**.
3. **Erster Lauf:** [Actions → AURA KINO → Run workflow](https://github.com/Dlschad20k-creator/jsjd/actions/workflows/aura-kino.yml)
   (baut den Katalog mit bis zu 1000 Filmen, ca. 5 Minuten).
4. **Privates Daten-Repo:** [neues Repo `aura-kino-daten`, privat](https://github.com/new?name=aura-kino-daten&visibility=private).
5. **Token fürs iPhone:** [Fine-grained Token](https://github.com/settings/personal-access-tokens/new) → *Only select repositories*:
   `aura-kino-daten` und `jsjd` → Permissions: **Contents: Read and write**, **Actions: Read and write**.
   In der App unter **Mehr → GitHub-Sync** eintragen. (Ohne Token funktioniert alles, die Daten bleiben dann nur auf dem Gerät.)

Filme per Knopf hinzufügen: in der App suchen → „… hinzufügen lassen“, oder unter Actions → *Run workflow*
mit `aktion=add` / `aktion=import` (Genre, Thema, Jahre, Anzahl).

## Variante B: Installation auf der Box
```bash
sudo apt-get install -y git python3
sudo git clone https://github.com/dlschad20k-creator/jsjd.git /opt/aura-kino
cd /opt/aura-kino && sudo ./deploy/install.sh
```
Das Skript fragt nach deinem TMDB-Token (themoviedb.org → Einstellungen → API → „API Read Access Token“),
richtet den Dienst `aura-kino` (Autostart) und den Timer `aura-kino-update.timer` (jede Nacht 04:00, Backup + Update)
ein und bietet den Erst-Import an (bis 1000 Filme, ca. 20–40 Minuten, fortsetzbar).

Ist das Repo privat, fragt `git clone` nach Benutzername und einem GitHub-Token (Settings → Developer settings →
Personal access tokens, Recht „Contents: Read“).

## Am iPhone öffnen
- Zuhause: `http://192.168.2.142:8420`
- Unterwegs (Tailscale an): `http://<Tailscale-IP der Box>:8420` – die IP zeigt `tailscale ip -4` auf der Box
  (oder der MagicDNS-Name, z. B. `http://armbian:8420`)
- Safari → Teilen → **Zum Home-Bildschirm** (Schalter „Als Web-App öffnen“ an) → startet im Vollbild wie eine App

## Filme hinzufügen
```bash
kino add "Prisoners"                         # suchen + hinzufügen
kino add --tmdb 146233                       # per TMDB-ID
kino import --genre horror --anzahl 50       # 50 neue Horrorfilme
kino import --liste "psychological thriller" --von 2015 --anzahl 30
kino update                                  # Update sofort
kino stats | kino backup | kino restore datei.json
```
Mehr in [CLAUDE.md](CLAUDE.md) – dort steht alles, was Claude Code (oder du) zum Verwalten braucht.

## Daten & Sicherheit
- Daten: `/var/lib/aura-kino` (Datenbank, Bilder, Backups, Logs, `.env` mit TMDB-Key – nie im Git)
- Tägliches Backup (14 behalten) + Export/Import als JSON in der App unter „Mehr“
- Optionaler PIN-Schutz; Server antwortet nur Heimnetz- und Tailscale-Adressen. **Keine Ports im Router öffnen.**

Diese App nutzt die TMDB-API, ist aber nicht von TMDB unterstützt oder zertifiziert. Streaming-Daten: JustWatch.
