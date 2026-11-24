import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('сверка использует только текущий счёт и дату, фильтр документов её не меняет', async ({ page }) => {
  await page.goto('/#/nzr-report')
  const reconciliation = page.getByRole('region', { name: 'Сверка с ПП ЛН' })
  await expect(reconciliation.getByRole('status')).toHaveText('Запрос ПП ЛН…')
  await page.getByRole('button', { name: 'Следующий счёт' }).click()
  await expect(reconciliation.getByRole('status')).toHaveText('Есть расхождения')
  const compared = reconciliation.getByRole('table')
  await expect(compared.getByRole('row', { name: /Наш отчёт/ })).toContainText('(−1)')
  const beforeSearch = await compared.innerText()
  await page.getByRole('searchbox', { name: 'Поиск по постановкам' }).fill('несуществующий документ')
  await expect(page.getByText('Постановки не найдены')).toBeVisible()
  expect(await compared.innerText()).toBe(beforeSearch)
  await page.getByLabel('Дата отчёта и оборота', { exact: true }).fill('2026-11-08')
  await expect(reconciliation.getByRole('status')).toHaveText('Сверка не выполнена')
  await expect(compared).toHaveCount(0)
})

test('экспорт и переход к отклонениям используют выделение с разных страниц', async ({ page }) => {
  await page.goto('/#/nzr-report')
  const table = page.getByRole('table', { name: 'Документы постановки на НЗР и дочерние документы' })
  await table.getByRole('checkbox', { name: /^Выбрать постановку \d+$/ }).first().check()
  await page.getByRole('navigation', { name: 'Страницы' }).getByRole('button', { name: 'Страница 2', exact: true }).click()
  await table.getByRole('checkbox', { name: /^Выбрать постановку \d+$/ }).first().check()
  await page.getByRole('button', { name: 'Переход к ручным отклонениям' }).click()
  const dialog = page.getByRole('dialog', { name: 'Переход к ручным отклонениям' })
  await expect(dialog.getByRole('listitem')).toHaveCount(2)
  const ids = await dialog.getByRole('listitem').allTextContents()
  await dialog.getByRole('button', { name: 'ОК' }).click()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Экспорт', exact: true }).click()
  const download = await downloaded
  expect(download.suggestedFilename()).toBe('nzr-report.csv')
  const path = await download.path()
  const lines = (await readFile(path!, 'utf8')).split('\r\n')
  expect(lines).toHaveLength(3)
  expect(lines[0]).toContain('"Остаток на НЗР";"Дней на НЗР"')
  for (const id of ids) expect(lines.slice(1).some((line) => line.includes(id))).toBe(true)
})

test('именованный набор восстанавливает счета, выбранные при разных фильтрах, после перезагрузки', async ({ page }) => {
  await page.goto('/#/nzr-report')
  const openAccounts = page.getByRole('button', { name: /Набор счетов/ })
  const chooser = page.getByRole('dialog', { name: 'Набор счетов НЗР' })
  const search = chooser.getByRole('searchbox', { name: 'Поиск счетов НЗР' })
  await openAccounts.click()
  await chooser.getByRole('button', { name: 'Снять выбор' }).click()
  for (const id of ['47422840000000000202', '47422156000000000404']) {
    await search.fill(id)
    await chooser.getByRole('button', { name: 'Выбрать все найденные · 1' }).click()
  }
  await chooser.getByRole('textbox', { name: 'Название набора' }).fill('Утренняя смена')
  await chooser.getByRole('button', { name: 'Сохранить набор' }).click()
  await expect(chooser.getByText('Набор «Утренняя смена» сохранён.')).toBeVisible()
  await page.reload()
  await openAccounts.click()
  const saved = chooser.getByRole('combobox', { name: 'Сохранённые наборы' })
  await saved.selectOption({ label: 'Утренняя смена · 2' })
  await expect(chooser.getByText('Выбрано 2 из 120')).toBeVisible()
  await chooser.getByRole('button', { name: 'Применить набор' }).click()
  await expect(page.getByText('47422840000000000202')).toBeVisible()
  await page.getByRole('button', { name: 'Следующий счёт' }).click()
  await expect(page.getByText('47422156000000000404')).toBeVisible()
})

test('подписи SWIFT не выходят за свои колонки при прокрутке и смене плотности', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/#/nzr-report')
  const table = page.getByRole('table', { name: 'Документы постановки на НЗР и дочерние документы' })
  await page.getByRole('button', { name: 'Раскрыть все связи' }).click()
  const captions = table.locator('tbody td small[data-k-tip]').filter({ hasText: /BANK|MOSCOW|OLEGOVICH/ })
  await expect(captions.first()).toBeVisible()
  for (const density of ['100 %', '125 %']) {
    await page.getByRole('button', { name: density, exact: true }).click()
    await table.getByRole('columnheader', { name: /Маршрут/ }).scrollIntoViewIfNeeded()
    const overflow = await captions.evaluateAll((nodes) => nodes.flatMap((node) => {
      const cell = node.closest('td')!
      const contentRight = cell.getBoundingClientRect().right - parseFloat(getComputedStyle(cell).paddingRight)
      const right = node.getBoundingClientRect().right
      return right > contentRight + 1 ? [node.textContent] : []
    }))
    expect(overflow, density).toEqual([])
  }
})

test('тултип SWIFT показывает счёт и имя на разных строках и разбивает поле 70 на строки до 35 символов', async ({ page }) => {
  await page.goto('/#/nzr-report')
  await expect(page.getByRole('region', { name: 'Сверка с ПП ЛН' }).getByRole('status')).toHaveText('Данные совпадают')
  await page.getByRole('searchbox', { name: 'Поиск по постановкам' }).fill('a0000400')
  const tooltip = page.getByRole('tooltip')
  await page.getByText('OOO SEVERNAYA ZVEZDA', { exact: true }).hover()
  await expect(tooltip).toBeVisible()
  expect(await tooltip.textContent()).toBe('/40702840300010009911\nOOO SEVERNAYA ZVEZDA')
  const purpose = 'PAYMENT UNDER CONTRACT 140 DD 01.10.2026 FOR CONSULTING SERVICES'
  const purposeCell = page.getByText(purpose, { exact: false })
  const wrapped = purpose.match(/.{1,35}/g)!.join('\n')
  await expect(purposeCell).toHaveAttribute('data-k-tip', wrapped)
  await page.mouse.move(0, 0)
  await purposeCell.hover()
  await expect(tooltip).toHaveText(wrapped)
  expect((await tooltip.textContent())?.split('\n').map((line) => line.length)).toEqual([35, purpose.length - 35])
})
