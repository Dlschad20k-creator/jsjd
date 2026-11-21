#!/bin/sh
# Holt die neueste App-Version aus Git und startet den Server neu. Deine Daten bleiben unberührt.
set -e
[ "$(id -u)" = "0" ] || { echo "Bitte mit sudo starten."; exit 1; }
cd /opt/aura-kino
git pull --ff-only
systemctl daemon-reload
systemctl restart aura-kino
echo "App aktualisiert und neu gestartet."
