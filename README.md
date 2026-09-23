# katran

Дизайн-система для интерфейсов проекта: React + effector. Спецификация — `docs/superpowers/specs/2026-09-23-katran-design.md`.

Пакеты: `@katran/tokens` (токены, шрифты), `@katran/ui` (компоненты), `@katran/effector` (модели). Демо — `apps/demo`.

    corepack enable && pnpm install
    pnpm check        # генерация токенов, линт, тесты, сборка
    pnpm --filter demo dev
