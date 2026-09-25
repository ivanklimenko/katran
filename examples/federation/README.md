# Макет: встраивание кита в метаприложение через Module Federation

Макет цепочки «кит → remote команды → хост метаприложения» на webpack 5 и классическом
`webpack.container.ModuleFederationPlugin`. Данные вымышленные (генератор из демо).

Папка **вне pnpm workspace**: `host/`, `remote/` и сама папка ставятся `npm`, кит попадает в remote
тарболами `pnpm pack` — так, как его получит команда из реестра (с `publishConfig`, без `workspace:*`).

```
host/     хост: React 17.0.2, react-dom, effector — shared singleton; babel только для своего кода (ES5);
          глобальный «сброс» host.css (box-sizing, td/th, button…); ?bare — без него
remote/   remote: экспонирует ./DocumentsScreen — лейн + панель фильтров + грид + BulkBar на @katran/effector
scripts/  pack-kit.sh (сборка и упаковка кита), serve.mjs (статика для prod-сборок), matrix.sh (варианты shared)
e2e/      check.mjs (проверки в Chromium через Playwright), sizes.mjs (что remote отдаёт странице)
```

## Запуск

```sh
sh scripts/pack-kit.sh                     # из корня репо тоже можно: собрать и упаковать кит в .kit/
(cd host && npm i) && (cd remote && npm i) && npm i

# dev: remote на 5211, хост на 5210
(cd remote && npm run dev) & (cd host && npm run dev) &
node e2e/check.mjs http://localhost:5210/

# prod: remote на 5213 (CORS обязателен — шрифты), хост на 5212
(cd remote && npm run build) && (cd host && REMOTE_URL=http://localhost:5213/remoteEntry.js npm run build)
node scripts/serve.mjs remote/dist 5213 --cors & node scripts/serve.mjs host/dist 5212 --spa &
node e2e/check.mjs http://localhost:5212/
node e2e/sizes.mjs http://localhost:5212/ http://localhost:5213 remote/dist
sh scripts/matrix.sh                       # все варианты shared, JSON — в test-results/
```

Переключатели вариантов описаны в шапках `host/webpack.config.js` и `remote/webpack.config.js`.

## Итог (24.09.2026, Chromium 153 из Playwright 1.63)

| Вариант (prod) | Результат |
|---|---|
| рекомендуемый: effector хоста (`import: false` + `effector/effector.mjs`), jsx-runtime не шарится, style-loader | 21/21, 0 ошибок и предупреждений в консоли |
| то же без ключа `effector/effector.mjs` | 19/21: вторая копия effector, `$dirty` модели фильтров не обновляется |
| effector со своей запасной копией (`shared`) | 21/21, но при равных версиях вся страница работает на копии remote, при старом effector хоста — хост молча получает 23.4.4 |
| своя копия effector (`own`) | 21/21, +12 KiB gzip; единицы хоста через `useUnit` remote — граф из двух копий |
| хост на effector 23.2.3, remote требует `^23.4.0` строго | экран не монтируется: `Unsatisfied version 23.2.3 … (required ^23.4.0)` |
| jsx-runtime из React 19 без общего доступа | React #31, экран не монтируется |
| jsx-runtime React 19 шарится с запасной копией | singleton выбирает 19.2.0 — **падает весь хост** |
| jsx-runtime только хоста (`import: false`) при React 19 в remote | 21/21 |
| mini-css-extract-plugin вместо style-loader | 21/21 |
| remote без CORS | шрифты IBM Plex не грузятся (12 ошибок CORS), геометрия цела |

Размер (рекомендуемый вариант): JS remote 41 KiB gzip (remoteEntry 3.2, экран с данными 8.2, кит и
зависимости 29.6), шрифты 202 KiB (12 woff2). Подробности и выводы — в итоговом отчёте макета.
