import { expect, test, type Page } from '@playwright/test'

const h = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!.height

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.clear()) })

// Замер эталона (registry-drift.md): валютный — запись 68 px / шапка 48–49 px (план 2.1, план 5b);
// рублёвый — запись 68 px / шапка 48 px (STATE §10, Task 1). Коридор кита — как у валютного: запись
// ± 4, шапка ± 2 (реальная шапка кита 49, как у валютного, — в допуске).
const REF: Record<'fx-docs' | 'rub-docs', { record: number; head: number }> = {
  'fx-docs': { record: 68, head: 48 },
  'rub-docs': { record: 68, head: 48 },
}

for (const route of ['fx-docs', 'rub-docs'] as const) {
  test(`запись и шапка при 100 % (${route})`, async ({ page }) => {
    await page.goto(`/#/${route}`)
    await page.getByRole('button', { name: '100 %' }).click()
    await page.locator('tbody[data-key]').first().waitFor()
    const record = await h(page, 'tbody[data-key]')
    const head = await h(page, 'table[role=grid] thead')
    expect(record).toBeGreaterThanOrEqual(64)
    expect(record).toBeLessThanOrEqual(72)
    expect(head).toBeGreaterThanOrEqual(40)
    expect(head).toBeLessThanOrEqual(56)
    expect(Math.abs(record - REF[route].record)).toBeLessThanOrEqual(4)
    expect(Math.abs(head - REF[route].head)).toBeLessThanOrEqual(2)
    test.info().annotations.push({ type: 'geometry', description: `${route}: record=${record} head=${head}` })
  })

  test(`скелетон повторяет высоту записи (${route})`, async ({ page }) => {
    await page.goto(`/?slow=3000#/${route}`)
    await page.getByRole('button', { name: '100 %' }).click()
    await page.locator('table[role=grid] tbody').first().waitFor()
    const skeleton = await h(page, 'table[role=grid] tbody')
    await page.locator('tbody[data-key]').first().waitFor({ timeout: 10_000 })
    const record = await h(page, 'tbody[data-key]')
    expect(Math.abs(skeleton - record)).toBeLessThanOrEqual(2)
    test.info().annotations.push({ type: 'geometry', description: `${route}: skeleton=${skeleton} record=${record}` })
  })

  test(`плотность 125 % масштабирует запись (${route})`, async ({ page }) => {
    await page.goto(`/#/${route}`)
    await page.locator('tbody[data-key]').first().waitFor()
    await page.getByRole('button', { name: '100 %' }).click()
    const base = await h(page, 'tbody[data-key]')
    await page.getByRole('button', { name: '125 %' }).click()
    const big = await h(page, 'tbody[data-key]')
    expect(Math.abs(big - base * 1.25)).toBeLessThanOrEqual(2)
    test.info().annotations.push({ type: 'geometry', description: `${route}: base=${base} density125=${big}` })
  })
}

// Заголовок сортируемой колонки сидит внутри <button class="thBtn">: провайдер сбрасывает типографику
// контролов (`:where(button,...) { text-transform: none }`), значение не наследуется от .th — падает
// на само правило .thBtn (плане 5b, находка контроллера — прописные не применялись, хотя .th их задаёт).
test('заголовок колонки — прописные (текст сортируемой кнопки, не только .th)', async ({ page }) => {
  await page.goto('/#/fx-docs')
  await page.locator('tbody[data-key]').first().waitFor()
  const btn = page.getByRole('columnheader', { name: /Дата \/ Время/ }).getByRole('button').first()
  const tt = await btn.evaluate((el) => getComputedStyle(el).textTransform)
  expect(tt).toBe('uppercase')
})

// Фикс-раунд 1 плана 5b задачи 6: кнопки номеров подвала наследовали ghost-вид Button (рамка + фон
// paper) — на стенде `.appf .pg button` в покое без рамки и фона, только на hover фон hover. jsdom не
// применяет каскад CSS Modules (getComputedStyle возвращает значения UA-таблицы стилей), поэтому
// проверка — здесь, в реальном Chromium, не юнит-тестом.
test('подвал: неактивная кнопка номера без видимой рамки и без фона в покое', async ({ page }) => {
  await page.goto('/#/fx-docs')
  await page.locator('tbody[data-key]').first().waitFor()
  const btn = page.getByRole('button', { name: 'Страница 2' })
  const style = await btn.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { borderWidth: cs.borderTopWidth, borderColor: cs.borderTopColor, background: cs.backgroundColor }
  })
  // рамка не видна: либо нулевая ширина, либо прозрачный цвет (Button.module.css `.button` держит
  // border: 1px solid transparent как базу — .pageBtn/.navBtn лишь подтверждают transparent поверх ghost)
  expect(style.borderWidth === '0px' || style.borderColor === 'rgba(0, 0, 0, 0)').toBe(true)
  expect(style.background).toBe('rgba(0, 0, 0, 0)')
})

// Задача 7 плана 5b: замеры новых полос по локаторам доступности — цели эталона ± 2 (спека §6):
// лейн 36, строка фильтров 45, подвал 37. Локаторы не завязаны на CSS-классы: группа «Статусы»
// (role=group), полоса с кнопкой «Фильтры» (её прямой родитель), nav «Страницы».
test('лейн, строка фильтров, подвал — высоты полос по эталону ± 2', async ({ page }) => {
  await page.goto('/#/fx-docs')
  await page.locator('tbody[data-key]').first().waitFor()
  // плотность по умолчанию (autoDensity) зависит от screen.width — фиксируем 100 %, иначе полосы
  // измерялись бы на произвольной плотности в зависимости от экрана раннера
  await page.getByRole('button', { name: '100 %' }).click()
  const lane = (await page.getByRole('group', { name: 'Статусы' }).boundingBox())!.height
  const filters = (await page.getByRole('button', { name: /^Фильтры/ }).locator('..').boundingBox())!.height
  const footer = (await page.getByRole('navigation', { name: 'Страницы' }).boundingBox())!.height
  expect(Math.abs(lane - 36)).toBeLessThanOrEqual(2)
  expect(Math.abs(filters - 45)).toBeLessThanOrEqual(2)
  expect(Math.abs(footer - 37)).toBeLessThanOrEqual(2)
  test.info().annotations.push({ type: 'geometry', description: `lane=${lane} filters=${filters} footer=${footer}` })
})
