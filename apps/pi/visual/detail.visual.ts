import { expect, test, type Locator, type Page } from '@playwright/test'

// Эталон вида деталки (срез styled, Task 0): каждая вкладка валютного и рублёвого документа, правка поля,
// плашки аннулирования, окно «Курс». Фейк без задержки (?slow=0), без автооткрытия (?noauto); «сегодня» — 23.09.2026.

test.use({ viewport: { width: 1600, height: 1000 } })
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 8, 23, 12, 0))
  await page.addInitScript(() => localStorage.clear())
})

type Route = 'fx-docs' | 'rub-docs'
// вкладки: id — для имён снимков, подпись — как в полосе (как в e2e/detail-tabs.spec.ts, плюс «Общие данные»)
const TABS: Record<Route, [string, string][]> = {
  'fx-docs': [
    ['main', 'Общие данные'], ['extra', 'Доп. поля'], ['statuses', 'Статусы'], ['compliance', 'Комплаенс'], ['linked', 'Связанные документы'],
    ['tasks', 'Задачи'], ['notif', 'Нотификации'], ['source', 'Исходный текст'], ['stream', 'Стриминг'], ['mpu', 'MPU'], ['audit', 'Аудит'],
  ],
  'rub-docs': [
    ['main', 'Общие данные'], ['statuses', 'Статусы'], ['compliance', 'Комплаенс'], ['linked', 'Связанные документы'], ['tasks', 'Задачи'],
    ['notif', 'Нотификации'], ['ed244', 'ED244'], ['stream', 'Стриминг'], ['mpu', 'MPU'], ['audit', 'Аудит'],
  ],
}
/** Документы фейка (те же сиды, что в e2e/detail-ops.spec.ts). */
const DOC = {
  /** уже аннулирован — плашка bad */
  done: '0f3c0004-7b1d-4c8e-9f0a-345544357551',
  /** чужой запрос на аннулирование — плашка warn с решениями */
  pending: '0f3c0003-7b1d-4c8e-9f0a-990759702166',
  /** MT103 EUR с полем 36 — «Курс» с курсом сделки */
  deal: '0f3c0008-7b1d-4c8e-9f0a-104979518335',
  /** сид правки поля 57 */
  edit57: '0f3c0001-7b1d-4c8e-9f0a-286655677016',
}

const dialogs = (page: Page) => page.getByRole('dialog', { name: /^Платёжная инструкция/ })
const openBtn = (page: Page, n: number) => page.locator('tbody[data-key]').nth(n - 1).locator('[data-k-open]')
/** Все анимации страницы закончены (въезд drawer, подъём поповера). */
const still = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)).then(() => undefined))
const ready = async (page: Page) => {
  await dialogs(page).first().locator('[data-part="hero"]').waitFor()
  await still(page)
}
async function shot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.mouse.move(0, 0)
  await expect(page).toHaveScreenshot(name)
}

async function start(page: Page, route: Route) {
  await page.goto(`/?slow=0&noauto#/${route}`)
  await page.getByRole('button', { name: '100 %' }).click()
  await page.locator('tbody[data-key]').first().waitFor()
}
/** Документ по ссылке ?doc= (без перехода по реестру). */
async function openDoc(page: Page, id: string, route: Route = 'fx-docs') {
  await page.goto(`/?slow=0&noauto#/${route}?doc=${id}`)
  await page.getByRole('button', { name: '100 %' }).click()
  await ready(page)
  return dialogs(page).first()
}
/** Выбрать вкладку: видимую — кликом, из переполнения — через «Ещё вкладки: N». false — вкладка недоступна. */
async function pickTab(page: Page, dw: Locator, name: string): Promise<boolean> {
  const tab = dw.getByRole('tab', { name, exact: true })
  if (await tab.count() > 0) {
    if (await tab.isDisabled()) return false
    await tab.click()
    return true
  }
  await dw.getByRole('button', { name: /^Ещё вкладки: \d+$/ }).click()
  const item = page.getByRole('menu', { name: 'Вкладки' }).getByRole('menuitem', { name: new RegExp(`^${name}`) })
  if (await item.isDisabled()) {
    await page.keyboard.press('Escape')
    return false
  }
  await item.click()
  return true
}
/** Открыть в A первую запись реестра, у которой вкладка есть, и выбрать её; содержимое вкладки готово. */
async function openWithTab(page: Page, name: string): Promise<Locator> {
  while (await dialogs(page).count() > 0) await page.keyboard.press('Escape')
  let prev: string | null = null
  for (let n = 1; n <= 20; n++) {
    await openBtn(page, n).click()
    // открытие — через 220 мс (open-delay): ждём смены документа
    if (prev !== null) await expect(dialogs(page).first()).not.toHaveAttribute('aria-label', prev)
    await ready(page)
    const dw = dialogs(page).first()
    if (await pickTab(page, dw, name)) {
      await expect(dw.locator('[data-part="tab-skeleton"]')).toHaveCount(0)
      await expect(dw.getByRole('tabpanel')).not.toBeEmpty()
      await still(page)
      return dw
    }
    prev = await dw.getAttribute('aria-label')
  }
  throw new Error(`Нет документа с вкладкой «${name}» среди первых 20 записей`)
}

for (const route of ['fx-docs', 'rub-docs'] as const) {
  test(`деталка ${route}: каждая вкладка`, async ({ page }) => {
    test.setTimeout(180_000)
    await start(page, route)
    for (const [id, name] of TABS[route]) {
      await openWithTab(page, name)
      await shot(page, `${route}-tab-${id}.png`)
    }
  })
}

test('правка поля 57: редактор открыт', async ({ page }) => {
  const dw = await openDoc(page, DOC.edit57)
  await dw.getByRole('button', { name: 'Редактировать поле 57' }).click()
  await expect(dw.getByRole('region', { name: /^Поле 57 · .+ — правка$/ })).toBeVisible()
  await still(page)
  await shot(page, 'fx-edit-57.png')
})

test('плашки аннулирования: аннулирован, ожидает утверждения', async ({ page }) => {
  const done = await openDoc(page, DOC.done)
  await expect(done.getByText('Документ аннулирован').first()).toBeVisible()
  await shot(page, 'fx-annul-done.png')
  const pending = await openDoc(page, DOC.pending)
  await expect(pending.getByRole('button', { name: 'Утвердить' })).toBeVisible()
  await shot(page, 'fx-annul-pending.png')
})

test('окно «Курс»', async ({ page }) => {
  const dw = await openDoc(page, DOC.deal)
  await dw.getByRole('button', { name: 'Курс', exact: true }).click()
  const pop = page.getByRole('dialog', { name: 'Курс', exact: true })
  await expect(pop.locator('p')).toHaveCount(3)
  await still(page)
  await shot(page, 'fx-rates.png')
})
