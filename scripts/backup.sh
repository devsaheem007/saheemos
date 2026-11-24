#!/usr/bin/env bash
# Daily MongoDB + uploads backup. Usage: MONGODB_URI=... UPLOAD_DIR=... ./scripts/backup.sh
# Cron example (2:30 every night):  30 2 * * * cd /srv/saheemos && ./scripts/backup.sh >> backups/backup.log 2>&1
set -euo pipefail
: "${MONGODB_URI:?Set MONGODB_URI}"
STAMP=$(date +%F-%H%M)
DEST="${BACKUP_DIR:-./backups}/$STAMP"
mkdir -p "$DEST"
mongodump --uri="$MONGODB_URI" --archive="$DEST/db.archive.gz" --gzip
[ -d "${UPLOAD_DIR:-server/uploads}" ] && tar -czf "$DEST/uploads.tar.gz" -C "$(dirname "${UPLOAD_DIR:-server/uploads}")" "$(basename "${UPLOAD_DIR:-server/uploads}")"
# keep 30 days
find "${BACKUP_DIR:-./backups}" -mindepth 1 -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +
echo "Backup written to $DEST"
# Restore:  mongorestore --uri="$MONGODB_URI" --archive=<db.archive.gz> --gzip --drop
