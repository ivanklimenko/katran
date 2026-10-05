import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // «сегодня» для горячих кнопок — 23.09.2026, как в данных фейка; таймеры страницы идут как обычно
  await page.clock.setFixedTime(new Date(2026, 8, 23, 12, 0))
  await page.addInitScript(() => localStorage.clear())
})

async function openFilters(page: Page) {
  await page.goto('/#/fx-docs')
  await page.locator('tbody[data-key]').first().waitFor()
  // экран при входе тихо открывает первую запись (registry.model, В-Д4) — деталка закрывает правую половину панели
  await page.getByRole('dialog', { name: /^Платёжная инструкция/ }).getByRole('button', { name: 'Закрыть' }).click()
  await page.getByRole('button', { name: /^Фильтры/ }).click()
}
const chips = (page: Page) => page.getByRole('list', { name: 'Применённые условия' })
const rows = (page: Page) => page.locator('tbody[data-key]')

test('период горячей кнопкой: «Сегодня» — все документы, «Вчера» — пусто', async ({ page }) => {
  await openFilters(page)
  const quick = page.getByRole('group', { name: /: быстрый период$/ }).first()
  await quick.getByRole('button', { name: 'Сегодня' }).click()
  await page.getByRole('button', { name: 'Применить' }).click()
  await expect(chips(page)).toContainText('23.09.2026')
  await expect(rows(page).first()).toBeVisible()
  await quick.getByRole('button', { name: 'Вчера' }).click()
  await page.getByRole('button', { name: 'Применить' }).click()
  await expect(page.getByText('По заданным условиям документов нет')).toBeVisible()
})

test('период календарём: два клика, поповер в пределах окна', async ({ page }) => {
  await openFilters(page)
  await page.getByRole('button', { name: 'Выбрать период' }).first().click()
  const pop = page.getByRole('dialog', { name: /выбор периода/ })
  const box = (await pop.boundingBox())!
  const vp = page.viewportSize()!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height)
  await pop.getByRole('button', { name: /^22 сентября/ }).click()
  await pop.getByRole('button', { name: /^23 сентября/ }).click()
  await page.getByRole('button', { name: 'Применить' }).click()
  await expect(chips(page)).toContainText('с 22.09.2026 по 23.09.2026')
})

test('список номеров вставкой — IN, в гриде ровно эти документы', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openFilters(page)
  // номер документа — первое значение в ячейке колонки «ID» (раскладка entities/fx-doc/ui/layout.tsx)
  const nums = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('table[role=grid] thead th')]
    const col = heads.findIndex((th) => th.textContent?.trim().startsWith('ID'))
    return [...document.querySelectorAll('tbody[data-key]')].slice(0, 3)
      .map((row) => row.querySelector('tr')?.children[col]?.querySelector('[class*="copy"]')?.textContent?.trim() ?? '')
  })
  expect(nums.every((n) => /^\d+$/.test(n))).toBe(true)
  await page.evaluate((t) => navigator.clipboard.writeText(t), nums.join('\n'))
  const input = page.getByRole('textbox', { name: 'Номер документа' })
  await input.click()
  await page.keyboard.press('ControlOrMeta+V')
  await page.getByRole('button', { name: 'Применить' }).click()
  await expect(chips(page)).toContainText('в списке')
  await expect(rows(page)).toHaveCount(3)
})

test('две фразы в «Назначении» — оба вхождения в каждой записи', async ({ page }) => {
  await openFilters(page)
  await page.getByRole('combobox', { name: 'Назначение' }).fill('')
  await page.getByRole('combobox', { name: 'Назначение' }).pressSequentially('"Оплата по договору" "НДС"')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Применить' }).click()
  await expect(chips(page)).toContainText('„Оплата по договору“ и „НДС“')
  // чип рисуется сразу, грид перезапрашивается с задержкой фейка — ждём, пока записи сменятся
  await expect.poll(async () => {
    const texts = (await rows(page).allInnerTexts()).map((t) => t.toLowerCase())
    return texts.length > 0 && texts.every((t) => t.includes('оплата по договору') && t.includes('ндс'))
  }).toBe(true)
})

test('подсказки: список по вводу, выбор добавляет чип', async ({ page }) => {
  await openFilters(page)
  const box = page.getByRole('combobox', { name: 'Приказодатель' })
  await box.pressSequentially('ооо')
  const list = page.getByRole('listbox', { name: 'Подсказки: Приказодатель' })
  await expect(list).toBeVisible()
  // пока ответа нет, в списке — отключённая строка «ищу…»; ждём первый настоящий вариант
  const option = list.getByRole('option', { disabled: false }).first()
  await expect(option).toContainText(/ооо/i)
  const first = (await option.innerText()).trim()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('list', { name: 'Приказодатель' })).toContainText(first)
})

test('справочник с клавиатуры: Enter открывает, поиск, Enter отмечает, Escape закрывает', async ({ page }) => {
  await openFilters(page)
  const trigger = page.getByRole('button', { name: /^Статус:/ })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.type('ошиб')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Статус: выбрано 1' })).toBeFocused()
})

test('высота контролов в строке одинакова; поле — во всю ширину колонки', async ({ page }) => {
  await openFilters(page)
  const tag = await page.getByRole('textbox', { name: 'Номер документа' }).evaluate((el) => el.parentElement!.getBoundingClientRect().height)
  const range = (await page.getByRole('group', { name: 'Дата документа', exact: true }).boundingBox())!.height
  const multi = await page.getByRole('button', { name: /^Статус:/ }).evaluate((el) => el.parentElement!.getBoundingClientRect().height)
  const num = await page.getByRole('textbox', { name: 'Сумма' }).evaluate((el) => el.parentElement!.getBoundingClientRect().height)
  for (const x of [tag, range, multi]) expect(Math.abs(x - num)).toBeLessThanOrEqual(0.5)
  const col = await page.getByRole('group', { name: 'Дата документа', exact: true }).evaluate((el) => {
    const box = el.closest('[class*="fieldBox"]')!.getBoundingClientRect()
    return Math.abs(el.getBoundingClientRect().width - box.width)
  })
  expect(col).toBeLessThanOrEqual(1)
})

test('тёмная тема: поповер на paper темы, скриншот в отчёт', async ({ page }, info) => {
  await openFilters(page)
  await page.getByRole('button', { name: 'Тёмная' }).click()
  await page.getByRole('button', { name: 'Выбрать период' }).first().click()
  const pop = page.getByRole('dialog', { name: /выбор периода/ })
  const [bg, paper] = await pop.evaluate((el) => {
    const probe = document.createElement('div')
    probe.style.background = getComputedStyle(el).getPropertyValue('--k-paper')
    el.appendChild(probe)
    const p = getComputedStyle(probe).backgroundColor
    probe.remove()
    return [getComputedStyle(el).backgroundColor, p]
  })
  expect(bg).toBe(paper)
  await page.screenshot({ path: info.outputPath('filters-dark.png') })
})
