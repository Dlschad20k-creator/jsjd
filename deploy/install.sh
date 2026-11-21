#!/bin/bash
# AURA KINO – Installation auf der Armbian-Box (Debian). Aufruf: sudo ./deploy/install.sh
set -euo pipefail

APP=/opt/aura-kino
DATA=/var/lib/aura-kino
PORT=${AURA_PORT:-8420}
SRC="$(cd "$(dirname "$0")/.." && pwd)"

if [ "$(id -u)" != "0" ]; then echo "Bitte mit sudo starten: sudo ./deploy/install.sh"; exit 1; fi

echo "== AURA KINO Installation =="

# 1) Python prüfen (nur Standardbibliothek nötig)
if ! command -v python3 >/dev/null; then
  apt-get update && apt-get install -y python3
fi
python3 - <<'PY'
import sys, sqlite3
assert sys.version_info >= (3, 9), "Python 3.9 oder neuer nötig"
print(f"Python {sys.version.split()[0]}, SQLite {sqlite3.sqlite_version} – ok")
PY

# 2) Programmdateien nach /opt/aura-kino (falls nicht direkt dorthin geklont)
if [ "$SRC" != "$APP" ]; then
  echo "Kopiere App nach $APP …"
  mkdir -p "$APP"
  cp -a "$SRC"/. "$APP"/
  rm -rf "$APP/data"
fi

# 3) Eigener Systembenutzer + Datenordner
if ! id aura >/dev/null 2>&1; then
  useradd --system --home-dir "$DATA" --shell /usr/sbin/nologin aura
fi
mkdir -p "$DATA"/{images,uploads,backups,logs}
chown -R aura:aura "$DATA"
chmod 750 "$DATA"
chown -R root:root "$APP"
chmod -R a+rX "$APP"

# 4) .env mit TMDB-Key (bleibt im Datenordner, nie im Code/Git)
ENVF="$DATA/.env"
if [ ! -f "$ENVF" ]; then
  cp "$APP/.env.example" "$ENVF"
fi
if ! grep -Eq '^TMDB_(API_KEY|READ_TOKEN)=.+' "$ENVF"; then
  echo
  echo "TMDB-Zugang: themoviedb.org → Einstellungen → API."
  echo "Füge den langen 'API Read Access Token' ODER den kurzen 'API-Key' ein (Eingabe bleibt unsichtbar)."
  read -r -s -p "TMDB-Token/Key: " KEY; echo
  KEY="$(echo "$KEY" | tr -d '[:space:]')"
  if [ -n "$KEY" ]; then
    sed -i '/^TMDB_API_KEY=/d;/^TMDB_READ_TOKEN=/d' "$ENVF"
    if [ ${#KEY} -gt 60 ]; then echo "TMDB_READ_TOKEN=$KEY" >> "$ENVF"; else echo "TMDB_API_KEY=$KEY" >> "$ENVF"; fi
    echo "Gespeichert in $ENVF"
  else
    echo "Übersprungen – später in $ENVF eintragen."
  fi
fi
chown aura:aura "$ENVF"
chmod 600 "$ENVF"

# 5) Kurzbefehl "kino"
install -m 755 "$APP/deploy/kino" /usr/local/bin/kino

# 6) systemd: Server + täglicher Timer
install -m 644 "$APP/deploy/aura-kino.service" /etc/systemd/system/aura-kino.service
install -m 644 "$APP/deploy/aura-kino-update.service" /etc/systemd/system/aura-kino-update.service
install -m 644 "$APP/deploy/aura-kino-update.timer" /etc/systemd/system/aura-kino-update.timer
if [ "$PORT" != "8420" ]; then
  sed -i "s|^Environment=AURA_DATA_DIR=.*|&\nEnvironment=AURA_PORT=$PORT|" /etc/systemd/system/aura-kino.service
fi
systemctl daemon-reload
systemctl enable --now aura-kino.service
systemctl enable --now aura-kino-update.timer

sleep 2
if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/"; then
  echo "Server läuft auf Port $PORT."
else
  echo "Server antwortet noch nicht – prüfen mit: journalctl -u aura-kino -n 50"
fi

# 7) Erst-Import anbieten
if [ "$(kino stats 2>/dev/null | awk '/Filme gesamt/ {print $3}')" = "0" ] && grep -Eq '^TMDB_(API_KEY|READ_TOKEN)=.+' "$ENVF"; then
  echo
  read -r -p "Jetzt den Erst-Import starten (bis 1000 Filme, ca. 20–40 Min.)? [J/n] " A
  if [ -z "$A" ] || [[ "$A" =~ ^[JjYy] ]]; then
    kino init || echo "Import unterbrochen – einfach erneut 'kino init' starten, er macht dort weiter."
  fi
fi

echo
echo "== Fertig =="
TS=$(command -v tailscale >/dev/null && tailscale ip -4 2>/dev/null | head -1 || true)
LAN=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -n "$LAN" ] && echo "Im Heimnetz:     http://$LAN:$PORT"
[ -n "$TS" ] && echo "Über Tailscale:  http://$TS:$PORT"
echo "Timer:           $(systemctl list-timers aura-kino-update.timer --no-pager | sed -n 2p)"
echo "Befehle:         kino stats | kino add \"Titel\" | kino import --genre horror --anzahl 50"
