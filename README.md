# katran

Дизайн-система для интерфейсов проекта: React + effector. Спецификация — `docs/superpowers/specs/2026-09-23-katran-design.md`.

Пакеты: `@katran/tokens` (токены, шрифты), `@katran/ui` (компоненты), `@katran/effector` (модели). Демо — `apps/demo`.

    corepack enable && pnpm install
    pnpm check        # генерация токенов, линт, тесты, сборка
    pnpm --filter demo dev

## Подключение

В монорепозитории пакеты подключаются исходниками через workspace — сборка не нужна:

    "@katran/ui": "workspace:*"

Вне монорепозитория пакет собирается и подключается сборкой:

    pnpm --filter @katran/ui build

```ts
import '@katran/tokens/fonts.css'
import '@katran/ui/styles.css'
import { KatranProvider, Button } from '@katran/ui'
```

Peer-зависимости: `react` ≥ 18, `react-dom` ≥ 18.
