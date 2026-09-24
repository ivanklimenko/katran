# План 4: совместимость с метаприложением

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Цель.** Кит работает в метаприложении команды: React 17.0.2 хоста, webpack 5 Module Federation, Chromium 88, без транспиляции `node_modules`; геометрия не зависит от глобальных стилей хоста. Плюс быстрые дефекты из сверки с эталоном.

**Архитектура.** Переносим в `main` проверенное спайками `spike/react17` и `spike/federation` (ветки локальные, итоги — `docs/STATE.md` §9): совместимый `useStableId` и запрет API React 18+ линтом; тестовая инфраструктура, одинаковая для RTL 12 и 16; рабочее пространство на React 17 и CI-задача на React 19; `dist` всех трёх пакетов под `chrome88` с classic JSX; изоляция CSS под корнем провайдера; макет федерации — в `examples/`. **Ветки спайков не сливать и не cherry-pick'ать целиком:** в них устаревшие данные демо (настоящие BIC до `000ac2a`) и временные правки; весь нужный код приведён в задачах ниже.

**Tech Stack:** React 17.0.2 (разработка) / 19 (CI), effector 23.4, Vite 8.3, vitest 5, Testing Library 12 (React 17) / 16 (React 19), Playwright 1.63, es-check 9, doiuse 6, webpack 5 (только `examples/federation`).

**Спека:** `docs/superpowers/specs/2026-09-24-katran-compat-design.md` (дельта совместимости) поверх основной `docs/superpowers/specs/2026-09-23-katran-design.md` (binding). Сверка с эталоном — `docs/reference/registry-drift.md`.

## Global Constraints

- CSS только токенами `var(--k-…)`: голые `px` лишь в `border*`/`outline*`/`box-shadow`/`letter-spacing`; никаких hex/rgba в `packages/ui` и `apps/demo/src`; локальные имена CSS Modules camelCase. (`apps/demo/public/*.css` stylelint не проверяет — там допустимы сырые значения.)
- Никаких `eslint-disable`/`stylelint-disable`.
- Интерактив — настоящие `<button>`/`<input>` с именем; `jsx-a11y` в линте, `axe` в тестах; тесты через `renderK` ищут по ролям/атрибутам.
- Русский язык интерфейса, комментариев и коммитов. **Коммиты без трейлеров `Co-Authored-By` и подписей «Generated with»**, автор `Ivan Klimenko <ivan.klimenko@gmail.com>`; `git add` — поимённо.
- Данные демо и примеров — только вымышленные (BIC — из набора демо: `VKRBRU8KXXX`, `NRDIRUMMXXX`, `MRDNGB2LXXX`, `HSTBDEHHXXX`, `BCLHLV22XXX`, `CESEDEFFXXX`, `QWRTUS3NXXX`, `PLKZHKHHXXX`).
- React: `peerDependencies` `>=17`; в `packages/ui` и `packages/effector` — никаких API React 18+ (список — спека совместимости 2.1).
- Планка браузера — `browserslist: ["chrome >= 88"]` в корневом `package.json`, единственный источник.
- Перед каждым коммитом `pnpm check` зелёный. e2e (`pnpm --filter demo e2e`) — вне `pnpm check`, прогоняется в задачах, где указано.
- Порты: 5180–5184 заняты другими проектами и превью; для своих серверов — 5210+. Файл `/Users/shaman/_CODE/VTB/.claude/launch.json` не править.
- Коридоры e2e: запись 64–72, шапка 40–56, скелетон = запись ± 2, плотность 125 % = ×1.25 ± 2.

---

### Task 1: Совместимый id и запрет API React 18+

**Files:**
- Create: `packages/ui/src/compat/useStableId.ts`, `packages/ui/src/compat/useStableId.test.tsx`
- Modify: `packages/ui/src/filters/FilterField.tsx`, `packages/ui/src/filters/FilterPanel.tsx`, `packages/ui/src/tooltip/TooltipLayer.tsx`, `eslint.config.js`

**Interfaces:**
- Produces: `useStableId(): string` из `packages/ui/src/compat/useStableId.ts` (внутренний, из `@katran/ui` не экспортируется).

- [ ] **Step 1: тест.** `packages/ui/src/compat/useStableId.test.tsx`:

```tsx
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { useStableId } from './useStableId'

const Probe = ({ n }: { n: number }) => <span data-testid="p" data-n={n}>{useStableId()}</span>

describe('useStableId', () => {
  it('на React 18+ — это React.useId, на 17 — фолбэк', () => {
    const native = (React as unknown as { useId?: unknown }).useId
    if (typeof native === 'function') expect(useStableId).toBe(native)
    else expect(useStableId).not.toBe(native)
  })

  it('id уникальны у экземпляров и не меняются между рендерами', () => {
    const { rerender } = render(<><Probe n={1} /><Probe n={1} /></>)
    const first = screen.getAllByTestId('p').map((e) => e.textContent)
    expect(first[0]).toBeTruthy()
    expect(first[0]).not.toBe(first[1])
    rerender(<><Probe n={2} /><Probe n={2} /></>)
    expect(screen.getAllByTestId('p').map((e) => e.textContent)).toEqual(first)
  })
})
```

- [ ] **Step 2: запуск.** `pnpm --filter @katran/ui exec vitest run src/compat` → FAIL: модуля `./useStableId` нет.

- [ ] **Step 3: реализация.** `packages/ui/src/compat/useStableId.ts`:

```ts
import * as React from 'react'

// Стабильный id элемента для связок aria-controls / htmlFor / aria-describedby.
// React.useId есть только с React 18; кит обязан работать и на React 17
// (хост метаприложения отдаёт 17 как shared singleton через федерацию).
// Выбор делается один раз при загрузке модуля: версия React в рантайме не меняется,
// поэтому порядок хуков в компоненте стабилен и правила хуков не нарушаются.
// Фолбэк — счётчик модуля в ленивом useState: id назначается при первом рендере
// экземпляра и не меняется. SSR и гидратацию кит не поддерживает, поэтому
// расхождение id сервера и клиента для фолбэка неважно.
// Доступ через индекс, а не `import { useId }`: у React 17 такого экспорта нет,
// и сборщик потребителя (webpack/MF) не должен ругаться на отсутствующий именованный экспорт.
const nativeUseId = (React as unknown as { useId?: () => string })['useId']

// Префикс экземпляра модуля: при федерации на странице могут оказаться две копии кита
// (разные remote-приложения со своим @katran/ui), и у каждой свой счётчик с единицы —
// без префикса обе выдали бы одинаковые id и связки aria/htmlFor перепутались бы.
const prefix = `k${Math.random().toString(36).slice(2, 7)}-`
let seq = 0
const useCounterId = (): string => {
  const [id] = React.useState(() => `${prefix}${++seq}`)
  return id
}

export const useStableId: () => string = typeof nativeUseId === 'function' ? nativeUseId : useCounterId
```

- [ ] **Step 4: замена `useId`.** В трёх файлах убрать `useId` из импорта `react`, добавить `import { useStableId } from '../compat/useStableId'` и заменить вызов:
  - `FilterField.tsx`: `import { useState } from 'react'`; `const id = useStableId()`.
  - `FilterPanel.tsx`: `import { useRef, useState, type FormEvent, type MouseEvent } from 'react'`; `const bodyId = useStableId()`.
  - `TooltipLayer.tsx`: `import { useEffect, useRef, useState, type RefObject } from 'react'`; `const id = useStableId()`.

- [ ] **Step 5: запрет линтом.** В `eslint.config.js` после блока `// Граница слоёв для effector …` добавить:

```js
  // Кит работает на React 17 (хост метаприложения): API React 18+ в пакетах запрещены (спека совместимости 2.1).
  // Замены — в packages/ui/src/compat/.
  {
    files: ['packages/ui/src/**/*.{ts,tsx}', 'packages/effector/src/**/*.{ts,tsx}'],
    ignores: ['packages/ui/src/compat/**'],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: "ImportDeclaration[source.value='react'] > ImportSpecifier[imported.name=/^(useId|useSyncExternalStore|useTransition|useDeferredValue|useInsertionEffect|startTransition|use|useOptimistic|useActionState)$/]",
          message: 'API React 18+ — кит работает на React 17; замены в packages/ui/src/compat/',
        },
        {
          selector: "MemberExpression[object.name='React'][property.name=/^(useId|useSyncExternalStore|useTransition|useDeferredValue|useInsertionEffect|startTransition|use|useOptimistic|useActionState)$/]",
          message: 'API React 18+ — кит работает на React 17; замены в packages/ui/src/compat/',
        },
        {
          selector: "ImportDeclaration[source.value=/^react-dom\\/(client|server)$/]",
          message: 'react-dom/client — React 18+; кит монтирует хост',
        },
      ],
    },
  },
```

  `no-restricted-syntax`, а не `no-restricted-imports`: последнее уже занято границей effector в блоке `**/*.{ts,tsx}`, и второе объявление в flat config заменило бы первое для этих файлов. `useFormStatus` живёт в `react-dom` — отдельным селектором не ловится; в ките его нет, при появлении ревью.

- [ ] **Step 6: проверка правила.** Временно вернуть в `FilterField.tsx` `import { useId, useState } from 'react'` → `pnpm lint` падает с сообщением «API React 18+ …». Вернуть правку Step 4 → `pnpm lint` зелёный.

- [ ] **Step 7: запуск.** `pnpm --filter @katran/ui exec vitest run src/compat` → PASS (2); `pnpm check` зелёный (React 19 в рабочем пространстве: `useStableId === React.useId`).

- [ ] **Step 8: Commit.**

```bash
git add packages/ui/src/compat/useStableId.ts packages/ui/src/compat/useStableId.test.tsx packages/ui/src/filters/FilterField.tsx packages/ui/src/filters/FilterPanel.tsx packages/ui/src/tooltip/TooltipLayer.tsx eslint.config.js
git commit -m "Совместимость: useStableId вместо useId, линт запрещает API React 18+ в пакетах кита"
```

---

### Task 2: Тесты хуков без `renderHook` из RTL и никаких записей после размонтирования

**Files:**
- Create: `packages/ui/src/test/renderHook.tsx`, `packages/effector/src/test/renderHook.tsx`, `packages/ui/src/value/useUnmountGuard.ts`
- Modify: `packages/ui/src/state/useLoadingGate.test.ts`, `packages/effector/src/hooks.test.tsx`, `packages/ui/src/provider/LiveRegion.tsx`, `packages/ui/src/provider/KatranProvider.tsx`, `packages/ui/src/value/CopyValue.tsx`, `packages/ui/src/value/LinkValue.tsx`, `packages/ui/src/value/Value.test.tsx`

**Interfaces:**
- Produces: `renderHook<R, P>(cb: (props: P) => R, o?: { initialProps?: P }) => { result: { current: R }, rerender(props: P): void, unmount(): void }` — в `packages/{ui,effector}/src/test/renderHook.tsx`; `useUnmountGuard(timer: MutableRefObject<number | undefined>): MutableRefObject<boolean>`.

- [ ] **Step 1: свой `renderHook`.** Одинаковый файл в `packages/ui/src/test/renderHook.tsx` и `packages/effector/src/test/renderHook.tsx` (пакеты не делят тестовые помощники — `effector` не импортирует `ui/src`):

```tsx
import { render } from '@testing-library/react'

// renderHook без зависимости от версии Testing Library: в @testing-library/react 16 он
// встроен, в 12 (последняя для React 17) — вынесен в @testing-library/react-hooks,
// который не ставится на React 18+. Свой — на `render`, одинаковом в 12 и 16,
// поэтому тесты хуков идут на React 17 и 19 без правок.
export function renderHook<R, P = undefined>(cb: (props: P) => R, o?: { initialProps?: P | undefined }) {
  const result = { current: undefined as R }
  function Probe({ props }: { props: P }) {
    result.current = cb(props)
    return null
  }
  const r = render(<Probe props={o?.initialProps as P} />)
  return {
    result,
    rerender: (props: P) => r.rerender(<Probe props={props} />),
    unmount: r.unmount,
  }
}
```

- [ ] **Step 2: перевод тестов.** `useLoadingGate.test.ts`: `import { act } from '@testing-library/react'` + `import { renderHook } from '../test/renderHook'`. `hooks.test.tsx`: `import { act } from '@testing-library/react'` + `import { renderHook } from './test/renderHook'`. Остальной код тестов не меняется (`result.current`, `rerender`, `unmount` — те же). `pnpm test` → зелёный, число тестов прежнее.

- [ ] **Step 3: тест записи после размонтирования.** В `Value.test.tsx` добавить (в `describe('CopyValue'`; буфер мокается тем же приёмом, что помощник `clip()` в файле, но `writeText` возвращает промис, который тест отпускает сам):

```tsx
  it('копирование после размонтирования не пишет в стейт и не ругается в консоль', async () => {
    let release!: () => void
    Object.assign(navigator, { clipboard: { writeText: () => new Promise<void>((r) => { release = r }) } })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = renderK(<CopyValue value="HSTBDEHHXXX" />)
    fireEvent.click(screen.getByRole('button', { name: 'HSTBDEHHXXX' }))
    unmount()
    await act(async () => { release() })
    expect(err).not.toHaveBeenCalled()
    err.mockRestore()
  })
```

  (Импортировать `act`, `fireEvent` из `@testing-library/react`, если их нет в файле.) На React 19 тест проходит и без правки (19 не ругается) — он страж для прогона на 17 (Task 3).

- [ ] **Step 4: `useUnmountGuard`.** `packages/ui/src/value/useUnmountGuard.ts`:

```ts
import { useEffect, useRef, type MutableRefObject } from 'react'

/**
 * Для кнопок копирования: снимает таймер вспышки при размонтировании и отдаёт флаг «смонтирован»
 * для проверки после `await copyText`. Без этого запись в стейт снятого компонента —
 * no-op, но React 17 в dev пишет в консоль «state update on an unmounted component».
 */
export function useUnmountGuard(timer: MutableRefObject<number | undefined>) {
  const alive = useRef(true)
  useEffect(() => {
    // Таймер — не DOM-узел: в очистке нужен именно последний запущенный, поэтому читаем .current в момент снятия.
    const t = timer
    alive.current = true
    return () => {
      alive.current = false
      window.clearTimeout(t.current)
    }
  }, [timer])
  return alive
}
```

  В `CopyValue.tsx`: `import { useUnmountGuard } from './useUnmountGuard'`; после `const timer = useRef<number | undefined>(undefined)` — `const alive = useUnmountGuard(timer)`; условие — `if (await copyText(value) && alive.current) {`. В `LinkValue.tsx` так же, условие — `if (value && (await copyText(value)) && alive.current) {`.

- [ ] **Step 5: `LiveRegion`.** Заменить тело компонента:

```tsx
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import s from './Provider.module.css'

export type LiveRegionHandle = { announce: (text: string) => void }

/** Одна живая область на провайдер. Текст перезаписывается — скринридер читает последнее. */
export const LiveRegion = forwardRef<LiveRegionHandle>(function LiveRegion(_, ref) {
  const [text, setText] = useState('')
  const frame = useRef(0)
  useImperativeHandle(ref, () => ({
    announce: (t) => {
      setText('')
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => setText(t))
    },
  }), [])
  // Кадр, запрошенный перед размонтированием, не должен писать в снятый компонент
  // (React 17 ругается на это в dev: «state update on an unmounted component»).
  useEffect(() => {
    const f = frame
    return () => cancelAnimationFrame(f.current)
  }, [])
  return <div role="status" aria-live="polite" className={s.live}>{text}</div>
})
```

- [ ] **Step 6: тип `rootRef`.** `KatranProvider.tsx`: `const rootRef = useRef<HTMLDivElement>(null)` → с комментарием:

```tsx
  // `| null` в параметре: в @types/react 17 useRef<T>(null) даёт RefObject с readonly current,
  // а корень присваивается вручную в ref-колбэке ниже.
  const rootRef = useRef<HTMLDivElement | null>(null)
```

- [ ] **Step 7: запуск.** `pnpm check` зелёный; число тестов ui +1.

- [ ] **Step 8: Commit.**

```bash
git add packages/ui/src/test/renderHook.tsx packages/effector/src/test/renderHook.tsx packages/ui/src/value/useUnmountGuard.ts packages/ui/src/state/useLoadingGate.test.ts packages/effector/src/hooks.test.tsx packages/ui/src/provider/LiveRegion.tsx packages/ui/src/provider/KatranProvider.tsx packages/ui/src/value/CopyValue.tsx packages/ui/src/value/LinkValue.tsx packages/ui/src/value/Value.test.tsx
git commit -m "Совместимость: свой renderHook для RTL 12 и 16, кнопки копирования и живая область не пишут в стейт после размонтирования"
```

---

### Task 3: Рабочее пространство на React 17, CI-задача на React 19

**Files:**
- Create: `scripts/use-react.mjs`
- Modify: `packages/ui/package.json`, `packages/effector/package.json`, `apps/demo/package.json`, `apps/demo/src/main.tsx`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: Task 1–2 (без них тесты на 17 падают: `useId`, `renderHook`).
- Produces: `node scripts/use-react.mjs 17|19` — переключает devDependencies React в `packages/ui` и `packages/effector`.

- [ ] **Step 1: скрипт переключения.** `scripts/use-react.mjs`:

```js
// Переключает devDependencies React у пакетов кита (ui, effector): node scripts/use-react.mjs 17|19.
// Рабочее пространство живёт на 17 (прод — React 17 хоста); CI-задача react19 переключает на 19,
// ставит зависимости без lock-файла и гоняет тесты и сборку пакетов. Демо не трогается:
// ReactDOM.render в React 19 удалён, демо остаётся на 17.
import { readFileSync, writeFileSync } from 'node:fs'

const VERSIONS = {
  17: {
    react: '17.0.2', 'react-dom': '17.0.2', '@types/react': '^17.0.93', '@types/react-dom': '^17.0.26',
    '@testing-library/react': '^12.1.5', '@testing-library/dom': '^8.20.1',
  },
  19: {
    react: '^19.3.0', 'react-dom': '^19.3.0', '@types/react': '^19.3.0', '@types/react-dom': '^19.3.0',
    '@testing-library/react': '^16.3.3', '@testing-library/dom': '^10.4.0',
  },
}
const want = VERSIONS[process.argv[2]]
if (!want) {
  console.error('node scripts/use-react.mjs 17|19')
  process.exit(2)
}
for (const pkg of ['packages/ui', 'packages/effector']) {
  const file = new URL(`../${pkg}/package.json`, import.meta.url)
  const json = JSON.parse(readFileSync(file, 'utf8'))
  // Только уже объявленные зависимости: у effector нет @testing-library/dom и @types/react-dom.
  for (const [name, version] of Object.entries(want)) if (json.devDependencies?.[name]) json.devDependencies[name] = version
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`)
}
console.log(`React ${process.argv[2]}: devDependencies ui и effector переключены; дальше pnpm install --no-frozen-lockfile`)
```

- [ ] **Step 2: зависимости на 17.**
  - `packages/ui/package.json`: `peerDependencies` → `"react": ">=17", "react-dom": ">=17"`; в `devDependencies` добавить `"@testing-library/dom": "^8.20.1"` (без явной версии user-event 14 подтягивает dom 10, который RTL 12 не настраивает на `act` — 9 предупреждений `act` в тестах).
  - `packages/effector/package.json`: `peerDependencies.react` → `">=17"`.
  - `node scripts/use-react.mjs 17` — переключит devDeps ui и effector (react/react-dom 17.0.2, типы 17, RTL 12).
  - `apps/demo/package.json`: `dependencies` `"react": "17.0.2", "react-dom": "17.0.2"`; `devDependencies` `"@types/react": "^17.0.93", "@types/react-dom": "^17.0.26"`.
  - `pnpm install` — обновляет `pnpm-lock.yaml`.

- [ ] **Step 3: демо на `ReactDOM.render`.** `apps/demo/src/main.tsx`:

```tsx
import { render } from 'react-dom'
import '@katran/tokens/fonts.css'
import { App } from './App'

// Демо — на React 17, как прод: хост метаприложения отдаёт React 17, корень там монтирует хост.
// createRoot (react-dom/client) появился в 18; здесь legacy-корень ReactDOM.render
// (без автоматического батчинга вне обработчиков React — так же, как в проде).
render(<App />, document.getElementById('root'))
```

- [ ] **Step 4: прогон на 17.** `pnpm check` → зелёный. Ожидаемо: typecheck 0 ошибок (правка `rootRef` из Task 2 уже есть), тесты tokens 12 / ui ≥ 162 / effector 32. Если в выводе vitest есть «state update on an unmounted component» или «not wrapped in act» из тестов, которых нет в списке известных (одно предупреждение `act` в тесте `useGrid` есть и на React 19 — оно вне этого плана, в техдолг), — разобрать и починить в этой задаче.

- [ ] **Step 5: прогон на 19 локально.**

```bash
node scripts/use-react.mjs 19 && pnpm install --no-frozen-lockfile
pnpm --filter @katran/tokens --filter @katran/ui --filter @katran/effector run test
pnpm --filter @katran/tokens --filter @katran/ui --filter @katran/effector run build
git checkout -- packages/ui/package.json packages/effector/package.json pnpm-lock.yaml && pnpm install
```

  Ожидаемо: те же числа тестов, сборка зелёная. После — рабочее пространство снова на 17, `git status` чистый (кроме файлов этой задачи).

- [ ] **Step 6: CI.** В `.github/workflows/ci.yml` добавить задачу рядом с `check`:

```yaml
  react19:
    runs-on: ubuntu-latest
    env: { COREPACK_ENABLE_DOWNLOAD_PROMPT: 0 }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: corepack enable
      - run: node scripts/use-react.mjs 19
      - run: pnpm install --no-frozen-lockfile
      - run: pnpm --filter @katran/tokens --filter @katran/ui --filter @katran/effector run test
      - run: pnpm --filter @katran/tokens --filter @katran/ui --filter @katran/effector run build
```

- [ ] **Step 7: e2e.** `pnpm --filter demo e2e` → 3/3 (запись 68, шапка 49, скелетон 68, 125 % → 84.75 — как на 19).

- [ ] **Step 8: Commit.**

```bash
git add scripts/use-react.mjs packages/ui/package.json packages/effector/package.json apps/demo/package.json apps/demo/src/main.tsx pnpm-lock.yaml .github/workflows/ci.yml
git commit -m "Совместимость: рабочее пространство и демо на React 17.0.2, как в проде; CI гоняет пакеты кита и на React 19"
```

---

### Task 4: Сборка под Chromium 88 и `dist` всех пакетов

**Files:**
- Create: `packages/tokens/vite.config.ts`, `packages/tokens/tsconfig.build.json`, `packages/effector/vite.config.ts`, `packages/effector/tsconfig.build.json`, `scripts/check-css-target.mjs`
- Modify: `packages/ui/vite.config.ts`, `packages/ui/package.json`, `packages/tokens/package.json`, `packages/effector/package.json`, `package.json`, `eslint.config.js`, `.gitignore` (если `dist` пакетов tokens/effector не игнорируется), `pnpm-lock.yaml`

**Interfaces:**
- Produces: `packages/{tokens,ui,effector}/dist/*.js` + `*.d.ts`; скрипт `pnpm check:target`; поле `browserslist` корня.

- [ ] **Step 1: `@katran/ui` — таргет и classic JSX.** В `packages/ui/vite.config.ts`:

```ts
  // Classic JSX runtime в dist: элементы кита создаёт createElement того React, что пришёл из
  // share scope хоста, и dist не импортирует 'react/jsx-runtime'. У React 17 нет поля exports,
  // а @katran/ui — ESM-пакет ("type": "module"), где webpack 5 требует полных путей: импорт
  // 'react/jsx-runtime' без .js в remote на webpack не разрешался без правила fullySpecified: false.
  // Имена фабрик — свои: часть модулей уже импортирует React как пространство имён.
  plugins: [react({ jsxRuntime: 'classic' }), dts({ include: ['src'], exclude: ['**/*.test.*', 'src/test/**'] })],
  oxc: {
    jsx: { runtime: 'classic', pragma: '__kCreate', pragmaFrag: '__kFragment' },
    jsxInject: `import { createElement as __kCreate, Fragment as __kFragment } from 'react'`,
  },
```

  и в `build`:

```ts
    // Реальная планка браузера метаприложения — Chromium 88 (хост не транспилирует node_modules,
    // поэтому кит должен приходить уже пониженным). Без явного target Vite 8 собирает под
    // 'baseline-widely-available' (Chrome 107+), cssTarget наследует его же.
    target: 'chrome88',
    cssTarget: 'chrome88',
```

  `rollupOptions.external` → `['react', 'react-dom', '@katran/tokens', '@floating-ui/dom']` (без `react/jsx-runtime`). `vitest.config.ts` ui наследует этот конфиг — тесты идут на том же classic JSX.
  В `packages/ui/package.json` `publishConfig` дополнить `"main": "./dist/ui.js", "types": "./dist/index.d.ts"`.

- [ ] **Step 2: проверка `dist` ui.** `pnpm --filter @katran/ui build && grep -c "react/jsx-runtime" packages/ui/dist/ui.js` → `0`; `grep -c "__kCreate" packages/ui/dist/ui.js` → больше 0.

- [ ] **Step 3: `dist` у `@katran/tokens`.** `packages/tokens/vite.config.ts`:

```ts
import { defineConfig } from 'vite'

// Сборка dist для потребителей вне монорепо (webpack remote команды не транспилирует node_modules
// и не читает TypeScript): один ESM-файл, таргет Chromium 88. В монорепо пакет по-прежнему
// подключается исходниками (main/exports → src), publishConfig переключает на dist.
export default defineConfig({
  build: {
    target: 'chrome88',
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    sourcemap: true,
  },
})
```

  `packages/tokens/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": false, "emitDeclarationOnly": true, "outDir": "dist", "rootDir": "src", "types": [] },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

  `packages/tokens/package.json`: `"files": ["src", "dist"]`; `scripts.build` → `"vite build && tsc -p tsconfig.json --noEmit && tsc -p tsconfig.build.json"`; `devDependencies` + `"vite": "^8.3.0"`; добавить

```json
  "publishConfig": {
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": {
      ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
      "./tokens.css": "./src/tokens.css",
      "./fonts.css": "./src/fonts.css"
    }
  }
```

  Если `tsc -p tsconfig.build.json` ругается на файлы вне `src` (`scripts/gen.ts`, `generate.ts` импортирует `node:fs`) — исключить их в `exclude` этого конфига, в `dist` нужны только модули, которые реэкспортирует `src/index.ts`.

- [ ] **Step 4: `dist` у `@katran/effector`.** `packages/effector/vite.config.ts`:

```ts
import { defineConfig } from 'vite'

// Сборка dist для потребителей вне монорепо: webpack remote команды не транспилирует node_modules
// и не читает TypeScript. effector/effector-react/react — peer, @katran/ui здесь только типы.
export default defineConfig({
  build: {
    target: 'chrome88',
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    rollupOptions: { external: ['effector', 'effector-react', 'react', 'react/jsx-runtime', '@katran/ui'] },
    sourcemap: true,
  },
})
```

  `packages/effector/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "emitDeclarationOnly": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": [],
    "paths": { "@katran/ui": ["../ui/dist/index.d.ts"] }
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test"]
}
```

  `packages/effector/package.json`: убрать `"private": true`; `scripts.build` → `"vite build && tsc -p tsconfig.json --noEmit && tsc -p tsconfig.build.json"`; `devDependencies` + `"vite": "^8.3.0"`; добавить `"files": ["dist"]` и

```json
  "publishConfig": {
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }
  }
```

  `pnpm build` (корень) собирает пакеты в топологическом порядке: `tokens` → `ui` → `effector` (d.ts effector ссылаются на `ui/dist`).

- [ ] **Step 5: проверка CSS.** `scripts/check-css-target.mjs`:

```js
// Проверка CSS кита на свойства и синтаксис новее планки браузера метаприложения.
// Планка — поле browserslist корневого package.json (сейчас Chromium 88): хост не транспилирует
// node_modules, поэтому то, что ушло в dist, должно работать там как есть.
// node scripts/check-css-target.mjs <файл.css>...
//
// doiuse (база caniuse) ловит вложенность, :has, @layer, @container, lab/lch/oklch и т. п.;
// «частичную поддержку» не считаем ошибкой. Чего нет в caniuse-базе doiuse — ловим регулярками ниже.
import { readFileSync } from 'node:fs'
import postcss from 'postcss'
import doiuse from 'doiuse'

const browsers = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).browserslist
const MISSED_BY_DOIUSE = [
  { re: /color-mix\(/, what: 'color-mix() — Chromium 111' },
  { re: /light-dark\(/, what: 'light-dark() — Chromium 123' },
  { re: /\btext-wrap\s*:/, what: 'text-wrap — Chromium 114' },
  { re: /\b\d*\.?\d+(dvh|svh|lvh|dvw|svw|lvw)\b/, what: 'dvh/svh/lvh — Chromium 108' },
  { re: /@starting-style|@scope\b/, what: '@starting-style/@scope — Chromium 117/118' },
  { re: /\boverflow(-[xy])?\s*:\s*clip\b/, what: 'overflow: clip — Chromium 90' },
  { re: /(^|[;{\s])(translate|rotate|scale)\s*:/, what: 'отдельные translate/rotate/scale — Chromium 104' },
  { re: /@media[^{]*[<>]=?/, what: 'диапазонный синтаксис @media — Chromium 104' },
  { re: /\baccent-color\s*:/, what: 'accent-color — Chromium 93' },
]
// Осознанные исключения: свойство в Chromium 88 просто не применяется, вёрстка не ломается.
const ALLOWED = new Map([
  ['accent-color', 'чекбокс в Chromium < 93 — системного цвета вместо --k-val; разметка и размеры те же'],
])

let failed = 0
for (const file of process.argv.slice(2)) {
  const css = readFileSync(file, 'utf8')
  const found = []
  await postcss([doiuse({ browsers, onFeatureUsage: (u) => { if (/not supported by/.test(u.message)) found.push(`${u.feature} (строка ${u.usage.source?.start?.line})`) } })])
    .process(css, { from: file })
  for (const { re, what } of MISSED_BY_DOIUSE) {
    if (!re.test(css)) continue
    const allowed = [...ALLOWED.keys()].find((k) => what.startsWith(k))
    if (allowed) console.log(`${file}: допущено — ${what}: ${ALLOWED.get(allowed)}`)
    else found.push(what)
  }
  for (const f of found) console.error(`${file}: не поддерживается ${browsers.join(', ')} — ${f}`)
  failed += found.length
}
if (failed) process.exit(1)
console.log(`CSS: синтаксиса новее ${browsers.join(', ')} нет`)
```

- [ ] **Step 6: корневой `package.json`.** `devDependencies` + `"doiuse": "^6.0.6", "es-check": "^9.8.1", "postcss": "^8.5.28"`; поле `"browserslist": ["chrome >= 88"]`; скрипты:

```json
    "check": "pnpm gen:check && pnpm lint && pnpm test && pnpm build && pnpm check:target",
    "check:target": "es-check checkBrowser packages/tokens/dist/index.js packages/ui/dist/ui.js packages/effector/dist/index.js --module --checkFeatures && node scripts/check-css-target.mjs packages/ui/dist/ui.css packages/tokens/src/tokens.css packages/tokens/src/fonts.css"
```

  `pnpm install`.

- [ ] **Step 7: игноры.** `eslint.config.js`: в `ignores` добавить `'examples/**'` (макет федерации из Task 8 — вне workspace, CommonJS-конфиги webpack). Убедиться, что `packages/*/dist` игнорируется git'ом (`git check-ignore packages/tokens/dist/index.js packages/effector/dist/index.js` → оба пути выводятся; иначе добавить `dist/` в `.gitignore`).

- [ ] **Step 8: страж проверки.** Временно добавить в `packages/ui/src/grid/Grid.module.css` правило `.table:has(td) { color: var(--k-ink); }` → `pnpm build && pnpm check:target` падает с `css-has` (или аналогичным) для `ui.css`. Убрать правило → зелёный.

- [ ] **Step 9: запуск.** `pnpm check` зелёный, в конце: `es-check: there were no ES version matching errors` (или эквивалент) и `CSS: синтаксиса новее chrome >= 88 нет`. e2e `pnpm --filter demo e2e` → 3/3.

- [ ] **Step 10: Commit.**

```bash
git add packages/ui/vite.config.ts packages/ui/package.json packages/tokens/vite.config.ts packages/tokens/tsconfig.build.json packages/tokens/package.json packages/effector/vite.config.ts packages/effector/tsconfig.build.json packages/effector/package.json scripts/check-css-target.mjs package.json eslint.config.js pnpm-lock.yaml
git commit -m "Сборка: dist всех пакетов под Chromium 88, classic JSX в @katran/ui, проверка dist на планку браузера в pnpm check"
```

  (`.gitignore` — в тот же коммит, если менялся.)

---

### Task 5: Изоляция от стилей хоста и честная ширина колонок

**Files:**
- Create: `apps/demo/public/hostile.css`, `apps/demo/e2e/isolation.spec.ts`
- Modify: `packages/ui/src/provider/Provider.module.css`, `packages/ui/src/grid/Grid.module.css`, `apps/demo/src/main.tsx`, `apps/demo/src/pages/GridPage.tsx`

**Interfaces:**
- Produces: режим демо `?hostile` (глобальные стили «враждебного хоста»); ширина колонки = полная ширина ячейки с паддингом (сверка W2).

- [ ] **Step 1: «враждебный хост».** `apps/demo/public/hostile.css` (public не проверяется stylelint — сырые значения намеренно):

```css
/* Глобальные стили «чужого» хоста: типичный сброс метаприложения. Демо подключает их по ?hostile —
   проверка, что кит от них не зависит (спека совместимости 2.3). Значения намеренно резкие. */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  font-size: 62.5%;
}

body {
  margin: 0;
  font: 16px/1.6 Georgia, serif;
  color: #202020;
  background: #f3efe6;
}

h1,
h2,
p {
  margin: 0 0 1em;
}

button {
  font: inherit;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

table {
  border-collapse: collapse;
  border-spacing: 0;
}

td,
th {
  padding: 6px 10px;
  vertical-align: middle;
  border: 1px solid #c8bfa8;
}

input {
  font: inherit;
}
```

  В `apps/demo/src/main.tsx` перед `render(...)`:

```tsx
// ?hostile — глобальные стили «враждебного хоста» (public/hostile.css): проверка изоляции кита (спека совместимости 2.3).
if (new URLSearchParams(location.search).has('hostile')) {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `${import.meta.env.BASE_URL}hostile.css`
  document.head.appendChild(link)
}
```

- [ ] **Step 2: e2e (падает).** `apps/demo/e2e/isolation.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.clear()) })

/** Заданная ширина колонки ID (ползунок ресайза) и фактическая ширина её заголовка. */
async function idColumn(page: Page) {
  const slider = page.getByRole('slider', { name: 'Ширина колонки ID' })
  const declared = Number(await slider.getAttribute('aria-valuenow'))
  const actual = (await page.locator('table[role=grid] thead th').filter({ has: slider }).boundingBox())!.width
  return { declared, actual }
}

for (const [q, name] of [['', 'чистая страница'], ['?hostile', 'враждебный хост']] as const) {
  test(`${name}: ширина колонки равна заданной, запись в коридоре`, async ({ page }) => {
    await page.goto(`/${q}#/grid`)
    await page.getByRole('button', { name: '100 %' }).click()
    await page.locator('tbody[data-key]').first().waitFor()
    const { declared, actual } = await idColumn(page)
    expect(Math.abs(actual - declared)).toBeLessThanOrEqual(1)
    const record = (await page.locator('tbody[data-key]').first().boundingBox())!.height
    expect(record).toBeGreaterThanOrEqual(64)
    expect(record).toBeLessThanOrEqual(72)
    test.info().annotations.push({ type: 'geometry', description: `${name}: declared=${declared} actual=${actual} record=${record}` })
  })
}
```

  `pnpm --filter demo e2e isolation` → FAIL: на чистой странице `actual = declared + 16` (W2), на враждебной — запись 71 и `actual` ≠ `declared`.

- [ ] **Step 3: изоляция под корнем провайдера.** В `Provider.module.css` после `.root { … }`:

```css
/* Модель коробки под корнем провайдера — content-box: типичный сброс хоста
   `*, *::before, *::after { box-sizing: border-box }` сужал колонки грида и поля ввода.
   Корень провайдера — граница изоляции: геометрия под ним не зависит от хоста.
   Специфичность (0,1,0) перебивает `*` хоста. Псевдоэлементы — отдельными селекторами:
   внутри :where() они недопустимы. Ячейки грида — исключение (border-box, Grid.module.css). */
.root,
.root *,
.root *::before,
.root *::after {
  box-sizing: content-box;
}

/* Типографика контролов под корнем провайдера: хост может глобально задавать
   `button { text-transform; letter-spacing }` — кнопки кита унаследовали бы их. Специфичность (0,1,0)
   перебивает селектор элемента хоста; правила компонентов кита идут в ui.css позже и перебивают сброс. */
.root :where(button, input, select, textarea) {
  text-transform: none;
  letter-spacing: normal;
}
```

- [ ] **Step 4: ячейки грида.** В `Grid.module.css` перед `/* --- шапка --- */`:

```css
/* Ячейки без рамок по умолчанию: хост может задавать глобальное `td, th { border }` —
   без сброса рамки протекают в запись (+3 px к 68). Специфичность (0,1,0) перебивает селектор элемента,
   а правила ниже с той же или большей специфичностью (.th, .record > tr > td) рисуют свои линии. */
.table :where(td, th) {
  border: 0;
}

/* Ширина колонки — полная ширина ячейки с паддингом (ползунок ресайза показывает её же):
   border-box. [data-k-root] поднимает специфичность до (0,2,0) — выше content-box корня провайдера. */
[data-k-root] .table :where(td, th) {
  box-sizing: border-box;
}
```

  Селектор фокуса ячеек заменить:

```css
/* Только ячейки грида: глобальный td[tabindex] красил бы фокус в таблицах хоста. */
.table td[tabindex]:focus-visible,
.table th[tabindex]:focus-visible {
```

  (тело правила прежнее). Атрибут `data-k-root` ставит `KatranProvider` на свой корень; CSS Modules атрибутные селекторы не переименовывают.

- [ ] **Step 5: ширины демо.** Фактическая ширина колонок теперь меньше на 16 px — вернуть прежний вид: в `docsLayout` (`GridPage.tsx`) каждое `width` +16: `status` 60, `id` 136, `created` 126, `type` 106, `direction` 166, `amount` 136, `f50` 186, `f52` 126, `f57` 126, `f59` 186, `sr` 136, `prov` 126. Ширины колонок в тестах `packages/ui` не менять — там проверяется логика, не вид.

- [ ] **Step 6: проверка.** `pnpm check` зелёный. `pnpm --filter demo e2e` → 5/5 (3 геометрии + 2 изоляции): запись 68 на обеих страницах, `actual = declared`. Числа — в отчёт задачи.

- [ ] **Step 7: Commit.**

```bash
git add apps/demo/public/hostile.css apps/demo/e2e/isolation.spec.ts packages/ui/src/provider/Provider.module.css packages/ui/src/grid/Grid.module.css apps/demo/src/main.tsx apps/demo/src/pages/GridPage.tsx
git commit -m "Изоляция: геометрия кита не зависит от глобальных стилей хоста; ширина колонки — полная ширина ячейки"
```

---

### Task 6: Мелкие дефекты `@katran/ui` из сверки (P1, T4, B3, B6, Z3)

**Files:**
- Create: `apps/demo/e2e/registry.spec.ts`
- Modify: `packages/ui/src/filters/Filters.module.css`, `packages/ui/src/grid/Grid.module.css`, `packages/ui/src/grid/DataGrid.tsx`, `packages/ui/src/grid/DataGrid.test.tsx`, `packages/ui/src/value/StatusDot.tsx`, `packages/ui/src/value/Value.test.tsx`

**Interfaces:**
- Produces: проп `emptyText?: string | undefined` у `DataGridProps`; `onOpen(row, { secondary: true })` и по Shift+клику.

- [ ] **Step 1: тесты (падают).** В `DataGrid.test.tsx`, в тест «открытие…» после проверки `detail: 2` добавить:

```tsx
    fireEvent.click(btn, { detail: 1, shiftKey: true })
    expect(p.onOpen).toHaveBeenLastCalledWith(docs[0], { secondary: true })
```

  и новый тест:

```tsx
  it('пустое состояние: заголовок, пояснение и действие', () => {
    renderK(<DataGrid {...base({ rows: [], total: 0, emptyTitle: 'Документов нет', emptyText: 'Измените условия отбора', emptyAction: { label: 'Сбросить фильтр', onClick: () => {} } })} />)
    expect(screen.getByText('Документов нет')).toBeInTheDocument()
    expect(screen.getByText('Измените условия отбора')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Сбросить фильтр' })).toBeInTheDocument()
  })
```

  В `Value.test.tsx`, в `describe('StatusDot / FieldTag / Counter'`:

```tsx
  it('точка с подписью показывает её тултипом; без подписи — нет', () => {
    renderK(<><StatusDot tone="ok" label="Обработан" /><StatusDot tone="bad" /></>)
    expect(screen.getByRole('img', { name: 'Обработан' })).toHaveAttribute('data-k-tip', 'Обработан')
    expect(document.querySelector('[data-tone="bad"]')).not.toHaveAttribute('data-k-tip')
  })
```

  `pnpm --filter @katran/ui exec vitest run src/grid/DataGrid src/value` → 3 FAIL.

- [ ] **Step 2: B3.** `DataGrid.tsx`, кнопка открытия: `onClick={(e) => p.onOpen!(row, { secondary: e.detail >= 2 || e.shiftKey })}`; JSDoc `onOpen` → «Второй клик по кнопке (e.detail ≥ 2) или Shift+клик — secondary: второй drawer рядом.»

- [ ] **Step 3: Z3.** `DataGridProps`: после `emptyTitle` — `/** Пояснение под заголовком пустого состояния. */ emptyText?: string | undefined`; `<EmptyState title={…} text={p.emptyText} action={p.emptyAction} />`.

- [ ] **Step 4: B6.** `StatusDot.tsx`: `const a11y = label ? { role: 'img', 'aria-label': label, 'data-k-tip': label } : { 'aria-hidden': true as const }`; в JSDoc `label` — «подпись для скринридера и тултип (статус не только цветом)».

- [ ] **Step 5: P1 и T4 — CSS.** `Filters.module.css` после `.body { … }`:

```css
/* Свёрнутое тело: display: grid выше перебил бы атрибут hidden — поля остались бы видны и в Tab-порядке. */
.body[hidden] {
  display: none;
}
```

  `Grid.module.css` после `.thSub { … }`:

```css
/* Подзаголовок отсортированной колонки (выбранный ключ) — цвета значения, как заголовок. */
.sorted .thSub {
  color: var(--k-val);
}
```

- [ ] **Step 6: e2e.** `apps/demo/e2e/registry.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.clear()) })

test('свёрнутая панель фильтров не показывает поля', async ({ page }) => {
  await page.goto('/#/grid')
  const toggle = page.getByRole('button', { name: /^Фильтры/ })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByLabel('Номер документа')).toBeHidden()
  await toggle.click()
  await expect(page.getByLabel('Номер документа')).toBeVisible()
})

test('подзаголовок отсортированной колонки — цвета заголовка', async ({ page }) => {
  await page.goto('/#/grid')
  await page.locator('tbody[data-key]').first().waitFor()
  await page.locator('table[role=grid] thead th').filter({ hasText: 'ID' }).getByRole('button').first().click()
  await page.getByRole('menu').getByText('Номер документа', { exact: true }).click()
  const th = page.locator('table[role=grid] thead th[aria-sort]').filter({ hasText: 'ID' })
  const [head, sub] = await th.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el.querySelector('[class*="thSub"]')!).color])
  expect(sub).toBe(head)
})
```

  Если заголовок отсортированной колонки в ките не несёт `aria-sort` — найти `th` по классу `[class*="sorted"]` (имена детерминированы: `k-Grid__sorted`). `pnpm --filter demo e2e` → 7/7.

- [ ] **Step 7: запуск.** Юнит-тесты из Step 1 → PASS; `pnpm check` зелёный.

- [ ] **Step 8: Commit.**

```bash
git add apps/demo/e2e/registry.spec.ts packages/ui/src/filters/Filters.module.css packages/ui/src/grid/Grid.module.css packages/ui/src/grid/DataGrid.tsx packages/ui/src/grid/DataGrid.test.tsx packages/ui/src/value/StatusDot.tsx packages/ui/src/value/Value.test.tsx
git commit -m "Реестр: панель фильтров сворачивается, Shift+клик открывает вторую деталку, тултип статусной точки, пояснение пустого состояния, подзаголовок сортировки цвета значения"
```

---

### Task 7: Дефекты демо и формат дат (B5, F1, F2, F4, F6, F7, Z3)

**Files:**
- Modify: `packages/ui/src/format/date.ts`, `packages/ui/src/format/date.test.ts`, `apps/demo/src/pages/GridPage.tsx`, `apps/demo/src/data/docs.ts`

**Interfaces:**
- Consumes: `emptyText` из Task 6; ширины колонок из Task 5.
- Produces: `formatDate('YYYY-MM-DD')` — без `new Date()`, не зависит от часового пояса.

- [ ] **Step 1: тест даты без зоны (падает).** В `date.test.ts`:

```ts
  it('дата без времени не сдвигается часовым поясом', () => {
    const tz = process.env.TZ
    process.env.TZ = 'America/New_York'
    try {
      expect(formatDate('2026-09-23')).toBe('23.09.2026')
    } finally {
      process.env.TZ = tz
    }
  })
```

  `pnpm --filter @katran/ui exec vitest run src/format/date` → FAIL: `22.09.2026` (`new Date('2026-09-23')` — полночь UTC).

- [ ] **Step 2: `formatDate`.** В `date.ts`:

```ts
// Дата без времени (как у бека: дата валютирования) — строкой, без new Date(): иначе полночь UTC
// в западных зонах показывалась бы предыдущим днём.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

export function formatDate(iso: string): string {
  const m = DATE_ONLY.exec(iso)
  if (m) return `${m[3]}.${m[2]}.${m[1]}`
  const d = parse(iso); if (!d) return ''
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`
}
```

  Тест → PASS.

- [ ] **Step 3: дата документа и валютирования (F1, F2).** В `GridPage.tsx` колонка `created`: `width: 150` (полная дата с секундами — «22.09.2026 07:33:22» — не помещается в 126), `render: (d) => <><CopyValue value={formatDateTimeFull(d.created)} tone="ink" tabIndex={T} /><div><CopyValue value={formatDate(d.valueDate)} tone="ink2" tabIndex={T} /></div></>`; в импорте из `@katran/ui` заменить `formatDateTimeShort` на `formatDate, formatDateTimeFull`.

- [ ] **Step 4: строка «Открыт документ» (B5).** Вместо `{opened && <p className={s.note} role="status">{opened}</p>}`:

```tsx
        {/* Строка всегда на месте: появляясь, она сдвигала грид, и второй клик двойного промахивался мимо кнопки.
            Объявление — через announce (живая область провайдера), поэтому без role="status". */}
        <p className={s.note}>{opened ?? 'Документ не открыт'}</p>
```

- [ ] **Step 5: пустое состояние (Z3).** У `DataGrid` в демо: `emptyTitle="По заданным условиям документов нет"` и `emptyText="Измените условия отбора или сбросьте фильтр"`.

- [ ] **Step 6: данные (F4, F6, F7).** В `docs.ts`:
  - `const CCY = { USD: '840', EUR: '978', CNY: '156', RUB: '810' } as const` с комментарием над: `// Код валюты в знаках 6–8 счёта: рубль в счёте — 810 (не ISO 4217 643), правило владельца.`
  - `STATUS_LABEL.INVALID` → `'INVALID'` (термин владельца).
  - Направление в фильтре — кодом, как в гриде: удалить `DIRECTION_LABEL`; в `docsFilterMeta` поле `direction` — `values: (['IN', 'OUT', 'TRANSIT', 'OTHER'] as const).map((v) => ({ value: v, label: v }))`. `grep -rn DIRECTION_LABEL apps packages` → пусто.

- [ ] **Step 7: проверка.** `pnpm check` зелёный. `pnpm --filter demo e2e` → 7/7 (запись по-прежнему 64–72). В браузере (превью демо, порт 5210+: `pnpm --filter demo exec vite --port 5210`): двойной клик по кнопке открытия на свежей странице даёт «Открыт документ N — второй drawer рядом»; дата «23.09.2026 10:52:47»; валютирование «23.09.2026»; рублёвый счёт «40702**810**…»; лейн «INVALID»; фильтр «Направление» — IN/OUT/TRANSIT/OTHER.

- [ ] **Step 8: Commit.**

```bash
git add packages/ui/src/format/date.ts packages/ui/src/format/date.test.ts apps/demo/src/pages/GridPage.tsx apps/demo/src/data/docs.ts
git commit -m "Демо: дата документа полностью с секундами, валютирование датой, рублёвый счёт с 810, INVALID, направление кодом в фильтре, строка открытия без сдвига грида"
```

---

### Task 8: Макет федерации и документ для команды-потребителя

**Files:**
- Create: `examples/federation/**` (из ветки `spike/federation`, папка `spikes/federation/`), `docs/consuming.md`
- Modify: `README.md` (раздел «Подключение»)

**Interfaces:**
- Consumes: `dist` и `publishConfig` из Task 4, изоляция из Task 5.

- [ ] **Step 1: перенос макета.**

```bash
git checkout spike/federation -- spikes/federation
git mv spikes/federation examples/federation
grep -rl 'spikes/federation' examples/federation | xargs sed -i '' 's#spikes/federation#examples/federation#g'
grep -rn 'spikes/' examples/federation   # пусто
```

  Глубина пути та же (`examples/federation` ↔ `spikes/federation`), относительные пути скриптов (`scripts/pack-kit.sh`: корень репо — `../../..` от `scripts/`) не меняются.

- [ ] **Step 2: обезличивание данных макета.** `examples/federation/remote/src/data/docs.ts` снят со старого демо: заменить весь массив `BICS` на набор из Global Constraints, `CCY.RUB` → `'810'`, `INVALID` → `'INVALID'`, как в Task 7. Проверка: `grep -rnE 'DEUTDEFF|CHASUS33|SABRRUMM|VTBRRUMM|CITIUS33|HSBCHKHH|BNPAFRPP|BKCHCNBJ' examples` → пусто.

- [ ] **Step 3: прогон макета (руками, вне CI).** По `examples/federation/README.md`: `sh examples/federation/scripts/pack-kit.sh`; `npm i` в `host`, `remote` и корне макета; prod-сборка remote на 5213 (`--cors`), хост на 5212 (`REMOTE_URL=http://localhost:5213/remoteEntry.js`); `node e2e/check.mjs http://localhost:5212/` → 21/21, 0 ошибок консоли. В README макета заменить порты 5200–5203 на 5210–5213. Серверы остановить.

- [ ] **Step 4: `docs/consuming.md`.**

````markdown
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
````

- [ ] **Step 5: README.** Раздел «Подключение»: строку `Peer-зависимости: react ≥ 18, react-dom ≥ 18.` заменить на `Peer-зависимости: react ≥ 17, react-dom ≥ 17 (прод — React 17.0.2 хоста). Встраивание в метаприложение (webpack 5, Module Federation, Chromium 88) — docs/consuming.md, макет — examples/federation/.`; фразу «Вне монорепозитория пакет собирается и подключается сборкой: `pnpm --filter @katran/ui build`» — на «Вне монорепозитория пакеты подключаются собранными (`dist`, `publishConfig`): `pnpm build`».

- [ ] **Step 6: проверка.** `pnpm check` зелёный (макет в `ignores` eslint, stylelint его не видит, в workspace не входит).

- [ ] **Step 7: Commit.**

```bash
git add examples/federation docs/consuming.md README.md
git commit -m "Встраивание: макет федерации в examples/, документ подключения для команды remote"
```

---

### Task 9: Документы: спека, состояние, журнал, сверка

**Files:**
- Modify: `docs/superpowers/specs/2026-09-23-katran-design.md`, `docs/superpowers/specs/2026-09-24-katran-compat-design.md`, `docs/STATE.md`, `CHANGELOG.md`, `docs/reference/registry-drift.md`

- [ ] **Step 1: основная спека.**
  - §5.1, строка «Утилиты»: «даты `22.09 07:33:22`» → «даты: в гриде — полная `22.09.2026 07:33:22` (`formatDateTimeFull`, решение владельца 24.09), компактная `22.09 07:33:22` — для транзакций деталки; дата без времени (`YYYY-MM-DD`) — `22.09.2026` строкой, без часового пояса».
  - §3 (пакеты): дописать абзац «Поставка вне монорепо — собранными `dist` под Chromium 88 (`publishConfig`), classic JSX у `@katran/ui`; React `>=17`; подробности — спека совместимости `2026-09-24-katran-compat-design.md`».
  - В шапке спеки дата обновления: «2026-09-24 — §3, 5.1 по плану 4 (совместимость)».
- [ ] **Step 2: спека совместимости.** Статус «исполнена планом 4», фактические числа проверок (тесты, e2e, `check:target`, макет 21/21) — в §3.
- [ ] **Step 3: `STATE.md`.**
  - §2: «React 19 + effector 23 — стек разработки кита» → «Разработка и демо — на React 17.0.2 (как прод); CI дополнительно гоняет пакеты на React 19 (`scripts/use-react.mjs`)».
  - §5 «Карта»: `packages/ui/src/compat/`, `examples/federation/`, `docs/consuming.md`, `scripts/use-react.mjs`, `scripts/check-css-target.mjs`.
  - §6: план 4 исполнен — состав и числа проверок.
  - §7 техдолг: убрать пункт про `formatDate` и часовой пояс для дат без времени (остаётся для строк с временем без смещения — переформулировать); добавить «предупреждение `act` в тесте `useGrid` (есть и на React 19)», «`KatranProvider` не принимает `className`/`style` — экран не растянуть на слот хоста без обёртки», «vitest не показывает предупреждения React 17 про `act`: React 17 пишет их, только если определён глобальный `jest`».
  - §8 грабли: «`react/jsx-runtime` React 19 не рендерится на React 17 (React #31) — remote и демо на React 17»; «`effector-react.mjs` импортирует `effector/effector.mjs` — в shared нужен второй ключ с `shareKey: 'effector'`»; «`display` у класса перебивает атрибут `hidden` — для сворачиваемых блоков явное `[hidden] { display: none }`».
  - §9: план 4 исполнен; следующий — план 5 «Реестр по эталону» (спека-дельта: ячейки на всю высоту записи R6, многоуровневая сортировка S1 с правкой контракта `GridQuery.sort`, раскладка «вместе / раздельно», типографика T1–T3 и цвет значений T2, колонки R1–R16, состояния записи B1, вид лейна и фильтров L1/P3, пагинация W4, счёт 8…4 F3); затем план 6 — advanced-фильтры или срез 2 (выбор владельца).
- [ ] **Step 4: `CHANGELOG.md`.** Строка «План 4 (совместимость): …» — React `>=17` (разработка на 17, CI на 19), `useStableId`, `dist` всех пакетов под Chromium 88 и `check:target`, classic JSX, `@katran/effector` публикуемый, изоляция от стилей хоста, ширина колонки — полная ширина ячейки (**breaking** для потребителей: заданные `width` колонок теперь включают паддинг 16 px), `emptyText` у `DataGrid`, Shift+клик — второй drawer, тултип `StatusDot`, `formatDate` для дат без времени, демо — формат дат, данные, строка открытия.
- [ ] **Step 5: сверка.** В `registry-drift.md` пунктам P1, T4, B3, B5, B6, W2, Z3, F1, F2, F4, F6, F7 в колонке «Предложение» дописать «**Исправлено** планом 4 (`<коммит>`)»; в сводке — строка «План 4 закрыл 12 пунктов: …».
- [ ] **Step 6: проверка.** `pnpm check` зелёный; ссылки на файлы в документах существуют (`ls` по каждому новому пути).
- [ ] **Step 7: Commit.**

```bash
git add docs/superpowers/specs/2026-09-23-katran-design.md docs/superpowers/specs/2026-09-24-katran-compat-design.md docs/STATE.md CHANGELOG.md docs/reference/registry-drift.md
git commit -m "Документы: план 4 исполнен — спека, состояние проекта, журнал, сверка с эталоном"
```

---

## После плана (контроллер)

- Финальное ревью ветки, фикс-волна, слияние в `main` fast-forward, пуш; Pages передеплоится из `main` — проверить демо на Pages (запись 68, консоль чистая, `?hostile`).
- CI: зелёные задачи `check` и `react19`.
- Удалить локальные ветки и worktree спайков (`spike/react17`, `spike/federation`, `.claude/worktrees/agent-*`) — их код перенесён, ветки не пушились.
