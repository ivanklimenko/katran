#!/bin/sh
# Матрица вариантов shared на production-сборках. Нужны запущенные статические серверы:
#   node scripts/serve.mjs host/dist 5202 --spa   и   node scripts/serve.mjs remote/dist 5203 --cors
# Для каждого варианта пересобирает remote (и хост, если меняется он), гоняет e2e/check.mjs
# и печатает итоговую строку. Подробный JSON — в test-results/<вариант>.json.
set -e
cd "$(dirname "$0")/.."
mkdir -p test-results
HOST_URL=http://localhost:5202/
export REMOTE_URL=http://localhost:5203/remoteEntry.js

build_host() { (cd host && env "$@" npx webpack --mode production >/dev/null 2>&1); }
build_remote() { (cd remote && env "$@" npx webpack --mode production >/dev/null 2>&1) || { echo "  сборка remote упала"; return 1; }; }
run() {
  name=$1
  node e2e/check.mjs "$HOST_URL" > "test-results/$name.json" 2>&1 || true
  printf '%-34s %s\n' "$name" "$(tail -1 "test-results/$name.json")"
}

build_host HOST_EFFECTOR=
build_remote REMOTE_EFFECTOR=host && run effector-host
build_remote REMOTE_EFFECTOR=host REMOTE_EFFECTOR_DEEP=0 && run effector-host-no-deep
build_remote REMOTE_EFFECTOR=shared && run effector-shared
build_remote REMOTE_EFFECTOR=own && run effector-own
build_remote REMOTE_JSX_SHARE=1 && run jsx-shared-host-no-jsx
build_remote REMOTE_REACT19=1 && run jsx-react19
build_remote REMOTE_REACT19=1 REMOTE_JSX_SHARE=1 && run jsx-react19-shared-host-no-jsx
build_remote REMOTE_CSS=extract && run css-extract

build_host HOST_SHARE_JSX=1
build_remote REMOTE_JSX_SHARE=1 && run jsx-shared-host-jsx
build_remote REMOTE_REACT19=1 REMOTE_JSX_SHARE=1 && run jsx-react19-shared-host-jsx
build_remote REMOTE_REACT19=1 REMOTE_JSX_SHARE=host && run jsx-react19-hostonly-host-jsx

build_host HOST_EFFECTOR=old
build_remote REMOTE_EFFECTOR=host && run old-host-effector-host
build_remote REMOTE_EFFECTOR=shared && run old-host-effector-shared
build_remote REMOTE_EFFECTOR=own && run old-host-effector-own

# вернуть рекомендуемую конфигурацию
build_host HOST_EFFECTOR=
build_remote REMOTE_EFFECTOR=host
