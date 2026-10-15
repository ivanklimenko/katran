#!/bin/sh
# Матрица вариантов shared на production-сборках. Нужны запущенные статические серверы:
#   node scripts/serve.mjs host/dist 5212 --spa   и   node scripts/serve.mjs remote/dist 5213 --cors
# Для каждого варианта пересобирает remote (и хост, если меняется он), гоняет e2e/check.mjs
# и печатает итоговую строку. Подробный JSON — в test-results/<вариант>.json.
# Первый прогон — вариант без shared styled-components (REMOTE_STYLED=own): его высота записи — эталон
# для проверки «запись грида той же высоты» во всех остальных вариантах. В нём самом ожидаемо не пройдены
# «тема хоста» (контекст темы у копии remote свой) и сравнение высоты (эталона для него нет).
set -e
cd "$(dirname "$0")/.."
mkdir -p test-results
HOST_URL=http://localhost:5212/
export REMOTE_URL=http://localhost:5213/remoteEntry.js

build_host() { (cd host && env "$@" npx webpack --mode production >/dev/null 2>&1); }
build_remote() { (cd remote && env "$@" npx webpack --mode production >/dev/null 2>&1) || { echo "  сборка remote упала"; return 1; }; }
REF=test-results/styled-own.json
run() {
  name=$1
  ref=${2:-$REF}; [ "$ref" = none ] && ref=
  node e2e/check.mjs "$HOST_URL" $ref > "test-results/$name.json" 2>&1 || true
  printf '%-34s %s\n' "$name" "$(tail -1 "test-results/$name.json")"
}

build_host HOST_EFFECTOR=
build_remote REMOTE_STYLED=own && run styled-own none
build_remote REMOTE_STYLED=shared && run styled-shared
build_remote REMOTE_EFFECTOR=host && run effector-host
build_remote REMOTE_EFFECTOR=host REMOTE_EFFECTOR_DEEP=0 && run effector-host-no-deep
build_remote REMOTE_EFFECTOR=shared && run effector-shared
build_remote REMOTE_EFFECTOR=own && run effector-own
build_remote REMOTE_JSX_SHARE=1 && run jsx-shared-host-no-jsx
build_remote REMOTE_REACT19=1 && run jsx-react19
build_remote REMOTE_REACT19=1 REMOTE_JSX_SHARE=1 && run jsx-react19-shared-host-no-jsx

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
