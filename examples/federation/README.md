# Макет: встраивание кита в метаприложение через Module Federation

Макет цепочки «кит → remote команды → хост метаприложения» на webpack 5 и классическом
`webpack.container.ModuleFederationPlugin`. Данные вымышленные (генератор из демо).
Данные и форматы — упрощённая копия демо на момент макета; эталон — `apps/demo`.

Папка **вне pnpm workspace**: `host/`, `remote/` и сама папка ставятся `npm`, кит попадает в remote
тарболами `pnpm pack` — так, как его получит команда из реестра (без `workspace:*`).

```
host/     хост: React 17.0.2, react-dom, effector, styled-components 5 — shared singleton; babel только для своего
          кода (ES5); глобальный «сброс» host.css (box-sizing, td/th, button…); ?bare — без него; экран remote —
          под ThemeProvider хоста с темой { hostMark: 'host' }
remote/   remote: экспонирует ./DocumentsScreen — лейн + панель фильтров + грид + BulkBar на @katran/effector;
          стили — styled-components, своего CSS нет; элемент под KatranProvider показывает theme.hostMark
scripts/  pack-kit.sh (сборка и упаковка кита), serve.mjs (статика для prod-сборок), matrix.sh (варианты shared)
e2e/      check.mjs (проверки в Chromium через Playwright), sizes.mjs (что remote отдаёт странице)
```

## Запуск

```sh
sh scripts/pack-kit.sh                     # из корня репо тоже можно: собрать и упаковать кит в .kit/
(cd host && npm i) && (cd remote && npm i) && npm i

# Проверка «запись грида той же высоты, что без shared styled-components» сравнивает с эталоном — выводом check.mjs
# на варианте REMOTE_STYLED=own (в нём самом ожидаемо не пройдены «тема хоста» и это сравнение).

# dev: remote на 5211, хост на 5210; сначала эталон без shared styled-components, затем рекомендуемый вариант
(cd remote && REMOTE_STYLED=own npm run dev) & (cd host && npm run dev) &
node e2e/check.mjs http://localhost:5210/ > test-results/dev-styled-own.json
# перезапустить remote без REMOTE_STYLED
node e2e/check.mjs http://localhost:5210/ test-results/dev-styled-own.json

# prod: remote на 5213 (CORS обязателен — шрифты), хост на 5212
(cd remote && REMOTE_STYLED=own npm run build) && (cd host && REMOTE_URL=http://localhost:5213/remoteEntry.js npm run build)
node scripts/serve.mjs remote/dist 5213 --cors & node scripts/serve.mjs host/dist 5212 --spa &
node e2e/check.mjs http://localhost:5212/ > test-results/styled-own.json
(cd remote && npm run build)
node e2e/check.mjs http://localhost:5212/ test-results/styled-own.json
node e2e/sizes.mjs http://localhost:5212/ http://localhost:5213 remote/dist
sh scripts/matrix.sh                       # все варианты shared, JSON — в test-results/; первый — styled-own (эталон)
```

Каталог `test-results/` перед первым запуском — `mkdir -p test-results`.

Переключатели вариантов описаны в шапках `host/webpack.config.js` и `remote/webpack.config.js`.

## styled-components (14.10.2026, срез styled, Task 10)

Кит и remote на styled-components 5.3.11, CSS-файлов у remote нет; проверок 24 (добавлены «тема хоста» и
«запись той же высоты, что без shared styled-components»; прочие — как в таблице ниже).

| Вариант (prod) | Результат |
|---|---|
| рекомендуемый: styled-components — shared singleton `^5.3.11` у хоста и remote | 24/24 (dev и prod), один `ThemeContext`, theme.hostMark = host под KatranProvider, запись 68 / 84.75 px (100 / 125 %) |
| без shared styled-components (`REMOTE_STYLED=own`) | 22/24: тема хоста не видна (контекст темы у копии remote свой); запись та же — 68 / 84.75 px; в dev — предупреждение styled-components о нескольких копиях |

Размер JS remote (рекомендуемый вариант, `e2e/sizes.mjs`): 83.5 KiB gzip (при равных версиях webpack берёт копию
styled-components из remote), без shared — 83.0 KiB; шрифты 193.8 KiB. Вариант `REMOTE_CSS=extract` снят — CSS нет.

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
зависимости 29.6), шрифты 202 KiB (12 woff2). Выводы для команды — `docs/consuming.md`; решения и
проверки — спека совместимости `docs/superpowers/specs/2026-09-24-katran-compat-design.md` и `docs/STATE.md` (§9).
