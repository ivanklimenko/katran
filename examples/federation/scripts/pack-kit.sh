#!/bin/sh
# Собирает пакеты кита и упаковывает их так, как их получит команда из реестра (pnpm pack
# заменяет workspace:* на версии; выпуск для команды — pnpm release:pack в корне). Тарболы — в examples/federation/.kit.
set -e
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
OUT="$ROOT/examples/federation/.kit"
rm -rf "$OUT"
mkdir -p "$OUT"
for p in tokens ui effector; do
  pnpm -C "$ROOT/packages/$p" run build
  pnpm -C "$ROOT/packages/$p" pack --pack-destination "$OUT" >/dev/null
done
ls -1 "$OUT"
