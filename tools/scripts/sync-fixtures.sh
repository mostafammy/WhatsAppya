#!/usr/bin/env bash
# Copies shared fixtures into the Swift test bundle (SPM resources cannot reference paths outside the package).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="$ROOT/apps/ios/Packages/WhatsAppyaKit/Tests/WhatsAppyaCoreTests/Fixtures"
rsync -a --delete --exclude README.md "$ROOT/fixtures/" "$DEST/"
echo "Synced fixtures → $DEST"
