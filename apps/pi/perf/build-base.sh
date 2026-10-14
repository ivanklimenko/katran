#!/usr/bin/env bash
# База замера скорости (срез styled, Task 0): собирает apps/pi из коммита <ref> во временном worktree в apps/pi/perf/base.
# Использование: pnpm --filter pi perf:base <ref>   (например, sha базы из леджера среза; HEAD — проверка инструмента на себе)
set -euo pipefail

ref="${1:?укажите коммит базы: pnpm --filter pi perf:base <ref>}"
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(git -C "$here" rev-parse --show-toplevel)"
sha="$(git -C "$repo" rev-parse --verify "$ref^{commit}")"
tmp="$(mktemp -d)"
wt="$tmp/base"

cleanup() {
  git -C "$repo" worktree remove --force "$wt" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT

echo "база: $ref ($sha) → $here/base"
git -C "$repo" worktree add --detach "$wt" "$sha" >/dev/null
# зависимости — из общего хранилища pnpm по lockfile коммита; пакеты кита pi берёт исходниками (условие katran-source)
(cd "$wt" && pnpm install --frozen-lockfile --prefer-offline >/dev/null)
(cd "$wt/apps/pi" && pnpm exec vite build --outDir "$here/base" --emptyOutDir --logLevel warn)
echo "$sha" > "$here/base/.ref"
echo "готово: $here/base"
