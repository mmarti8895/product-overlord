#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$ROOT_DIR/ui/src-tauri/binaries"

mkdir -p "$BIN_DIR"

# Tauri's dev build script currently expects the sidecar file to be suffixed
# with the Rust target triple. Keep this in sync with your host.
TRIPLE="x86_64-unknown-linux-gnu"
OUT="$BIN_DIR/product-overlord-server-${TRIPLE}"

cat > "$OUT" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/product-overlord-server.js" "$@"
SH

chmod +x "$OUT"
echo "Wrote $OUT"
