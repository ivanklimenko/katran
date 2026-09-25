# Подключение кита в приложение команды (remote метаприложения)

Для команды, которая строит экран на katran внутри канального метаприложения. Основание — спека
`docs/superpowers/specs/2026-09-24-katran-compat-design.md`; рабочий макет цепочки — `examples/federation/`.

## Среда

- Хост: webpack 5, `ModuleFederationPlugin`; **React 17.0.2** и `react-dom` — shared singleton хоста; effector 23.4.
- Браузер: Chromium 88+. `node_modules` не транспилируются — пакеты кита приходят собранными под Chromium 88.

## Установка

```sh
npm i @katran/tokens @katran/ui @katran/effector effector@^23.4 effector-react@^23
npm i -D react@17.0.2 react-dom@17.0.2 @types/react@^17 @types/react-dom@^17
```

React 17 в devDependencies обязателен: `react/jsx-runtime` React 19 создаёт элементы, которые React 17
хоста не рендерит (ошибка React #31), а шарить `react/jsx-runtime` нельзя — с запасной копией
singleton выбирает 19 и падает весь хост.

## Точка входа экрана

```tsx
import '@katran/tokens/fonts.css'
import '@katran/ui/styles.css'
import { KatranProvider } from '@katran/ui'

export default function DocumentsScreen() {
  return (
    <KatranProvider defaultTheme="light" storageKey="documents">
      {/* экран на компонентах @katran/ui и моделях @katran/effector */}
    </KatranProvider>
  )
}
```

`storageKey` разводит настройки кита (тема, плотность, раскладка грида) с другими remote в общем `localStorage`.

## webpack remote

```js
new ModuleFederationPlugin({
  name: 'documents',
  filename: 'remoteEntry.js',
  exposes: { './DocumentsScreen': './src/DocumentsScreen.tsx' },
  shared: {
    react:       { singleton: true, requiredVersion: '^17.0.2', strictVersion: true, import: false },
    'react-dom': { singleton: true, requiredVersion: '^17.0.2', strictVersion: true, import: false },
    effector:    { singleton: true, requiredVersion: '^23.4.0', strictVersion: true, import: false },
    // effector-react.mjs импортирует 'effector/effector.mjs' — без этого ключа на странице вторая копия
    // effector, и модели ломаются молча (например, «Применить» в фильтрах не активируется)
    'effector/effector.mjs': { singleton: true, shareKey: 'effector', requiredVersion: '^23.4.0', strictVersion: true, import: false },
    // react/jsx-runtime и effector-react — не шарить
  },
})
// output: { publicPath: 'auto', uniqueName: 'documents' }
```

`import: false` — remote не несёт своих копий: React, react-dom и effector берутся у хоста. Своя запасная
копия effector в `shared` опасна: при равных версиях webpack отдаёт её всей странице, включая хост.

## Сервер remote

- Заголовок `Access-Control-Allow-Origin` для статики remote: шрифты IBM Plex грузятся с адреса remote
  (`publicPath: 'auto'`), без CORS — 12 ошибок загрузки шрифтов (геометрия цела, шрифт системный).
- `remoteEntry.js` без хеша в имени — не кешировать надолго.

## Что нужно от хоста

- ErrorBoundary вокруг точки встраивания: если effector хоста окажется ниже `^23.4.0`, `strictVersion`
  не даст экрану подняться (`Unsatisfied version …`) — хост должен показать заглушку, а не упасть.
- Слот фиксированной высоты — экран растягивается на него сам.

## Изоляция

Кит не трогает `html`/`body` и глобальные стили хоста; наружу выходят только переменные `--k-*` на `:root`
и `@font-face` IBM Plex. Под корнем `KatranProvider` геометрия не зависит от глобальных сбросов хоста
(`box-sizing`, `td/th`, типографика `button`). Правила хоста с классами (`.content table td`) по-прежнему
могут перебить стили кита — точка встраивания не должна лежать внутри таких контейнеров.

## Размер (макет, prod, gzip)

remoteEntry 3.2 KiB, экран с данными 8.2 KiB, кит и зависимости 29.6 KiB — итого JS 41 KiB; шрифты 202 KiB (12 woff2).
