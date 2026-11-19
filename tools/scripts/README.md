# tools/scripts

## Overview
Provides repository automation scripts for synchronizing shared test fixtures across workspace packages that cannot reference parent directory paths directly (such as Swift Package Manager test bundles).

## Interface
- `[sync-fixtures.sh:sync-fixtures.sh]`: Executable Bash script (no CLI flags or arguments) that synchronizes shared fixtures from `$ROOT/fixtures/` into `$ROOT/apps/ios/Packages/WhatsAppyaKit/Tests/WhatsAppyaCoreTests/Fixtures/`.

## Invariants
- `[sync-fixtures.sh:set -euo pipefail]`: Enforces strict shell execution (`-e` exits on non-zero status, `-u` errors on unset variables, `-o pipefail` fails on any errored command in a pipeline).
- `[sync-fixtures.sh:ROOT]`: Assumes `sync-fixtures.sh` resides exactly two directory levels below the repository root (`$(dirname "$0")/../..`).
- `[sync-fixtures.sh:DEST]`: Targets `$ROOT/apps/ios/Packages/WhatsAppyaKit/Tests/WhatsAppyaCoreTests/Fixtures` so Swift Package Manager test targets have local bundle access to shared fixtures.
- `[sync-fixtures.sh:--exclude README.md]`: Excludes `README.md` from being copied or deleted in the destination fixture directory.

## Side Effects
- `[sync-fixtures.sh:rsync -a --delete --exclude README.md]`: Mutates the local filesystem by copying files in archive mode from `$ROOT/fixtures/` to `$DEST/` and deleting extraneous files from `$DEST/` (excluding `README.md`).
- `[sync-fixtures.sh:echo]`: Writes `Synced fixtures → $DEST` to standard output.

## Verification
- Run: `bash tools/scripts/sync-fixtures.sh`
