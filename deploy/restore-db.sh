#!/bin/sh
# Spielt ein Datenbank-Backup (.db) zurück. Aufruf: sudo deploy/restore-db.sh /var/lib/aura-kino/backups/aura-YYYYMMDD-HHMMSS.db
set -e
DATA=/var/lib/aura-kino
[ "$(id -u)" = "0" ] || { echo "Bitte mit sudo starten."; exit 1; }
[ -f "$1" ] || { echo "Backup-Datei fehlt: $1"; ls -1t "$DATA/backups/"*.db 2>/dev/null | head -14; exit 1; }
python3 -c "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); assert c.execute('pragma integrity_check').fetchone()[0]=='ok'" "$1" \
  || { echo "Backup ist beschädigt – abgebrochen."; exit 1; }
systemctl stop aura-kino
STAMP=$(date +%Y%m%d-%H%M%S)
[ -f "$DATA/aura.db" ] && cp -a "$DATA/aura.db" "$DATA/backups/vor-restore-$STAMP.db"
rm -f "$DATA/aura.db-wal" "$DATA/aura.db-shm"
cp "$1" "$DATA/aura.db"
chown aura:aura "$DATA/aura.db"
systemctl start aura-kino
echo "Zurückgespielt. Der vorherige Stand liegt in $DATA/backups/vor-restore-$STAMP.db"
