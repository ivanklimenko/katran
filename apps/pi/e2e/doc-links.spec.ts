import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.clear()) })

const primary = (page: Page) => page.locator('tbody[data-key][data-mark="a"]')
const dialogs = (page: Page) => page.getByRole('dialog', { name: /^Платёжная инструкция/ })

/** Навигация настоящим <a>, в том числе когда href уже равен адресу страницы. */
async function sameLink(page: Page, href: string) {
  await page.evaluate((value) => {
    document.getElementById('repeat-doc-link')?.remove()
    const a = document.createElement('a')
    a.id = 'repeat-doc-link'
    a.href = value
    a.textContent = 'Повторно открыть документ по ссылке'
    Object.assign(a.style, { position: 'fixed', top: '0', left: '0', zIndex: '999999' })
    document.body.append(a)
  }, href)
  return page.getByRole('link', { name: 'Повторно открыть документ по ссылке' })
}

test('URL: повторная ссылка сохраняет охрану грязной правки', async ({ page }) => {
  const ids = await records(page, 'fx-docs')
  const link = `/?slow=0#/fx-docs?doc=${encodeURIComponent(ids[3]!)}`
  await page.goto(link)
  await expect(primary(page)).toHaveAttribute('data-key', ids[3]!)
  await page.locator('tbody[data-key]').nth(1).locator('[data-k-open]').click()
  await expect(primary(page)).toHaveAttribute('data-key', ids[1]!)
  const drawer = dialogs(page).first()
  await drawer.getByRole('button', { name: 'Редактировать поле 57' }).click()
  const editor = drawer.getByRole('region', { name: /^Поле 57 · .+ — правка$/ })
  await editor.getByRole('textbox', { name: 'Строка 1' }).fill('DRAFT LINK TEST')
  const repeat = await sameLink(page, link)
  await repeat.click()
  const ask = drawer.getByRole('alertdialog', { name: 'Отменить правку?' })
  await expect(ask).toBeVisible()
  await ask.getByRole('button', { name: 'Продолжить правку' }).click()
  await expect(primary(page)).toHaveAttribute('data-key', ids[1]!)
  await expect(editor.getByRole('textbox', { name: 'Строка 1' })).toHaveValue('DRAFT LINK TEST')
  await repeat.click()
  await ask.getByRole('button', { name: 'Отменить правку' }).click()
  await expect(primary(page)).toHaveAttribute('data-key', ids[3]!)
})

async function records(page: Page, route: string) {
  await page.goto(`/?slow=0&noauto#/${route}`)
  await page.locator('tbody[data-key]').first().waitFor()
  return page.locator('tbody[data-key]').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-key')!))
}

for (const route of ['fx-docs', 'rub-docs']) {
  test(`URL: прямой вход и reload открывают нужный документ (${route})`, async ({ page }) => {
    const ids = await records(page, route)
    await page.goto(`/?slow=0#/${route}?doc=${encodeURIComponent(ids[3]!)}`)
    await expect(primary(page)).toHaveAttribute('data-key', ids[3]!)
    await expect(dialogs(page)).toHaveCount(1)
    await page.reload()
    await expect(primary(page)).toHaveAttribute('data-key', ids[3]!)
    await expect(dialogs(page)).toHaveCount(1)
  })

  test(`URL: повторная та же ссылка после ручного открытия другой записи (${route})`, async ({ page }) => {
    const ids = await records(page, route)
    const link = `/?slow=0#/${route}?doc=${encodeURIComponent(ids[3]!)}`
    await page.goto(link)
    await expect(primary(page)).toHaveAttribute('data-key', ids[3]!)
    await page.locator('tbody[data-key]').nth(4).locator('[data-k-open]').click()
    await expect(primary(page)).toHaveAttribute('data-key', ids[4]!)
    await (await sameLink(page, link)).click()
    await expect(primary(page)).toHaveAttribute('data-key', ids[3]!)
  })

  test(`URL: отмена повторной ссылки на window сохраняет текущий документ (${route})`, async ({ page }) => {
    const ids = await records(page, route)
    const link = `/?slow=0#/${route}?doc=${encodeURIComponent(ids[3]!)}`
    await page.goto(link)
    await expect(primary(page)).toHaveAttribute('data-key', ids[3]!)
    await page.locator('tbody[data-key]').nth(4).locator('[data-k-open]').click()
    await expect(primary(page)).toHaveAttribute('data-key', ids[4]!)
    const anchor = await sameLink(page, link)
    await page.evaluate(() => window.addEventListener('click', (event) => event.preventDefault(), { once: true }))
    await anchor.click()
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)))
    await expect(primary(page)).toHaveAttribute('data-key', ids[4]!)
    await expect(dialogs(page)).toHaveCount(1)
  })

  test(`URL: та же ссылка повторно открывает закрытую деталку (${route})`, async ({ page }) => {
    const ids = await records(page, route)
    const link = `/?slow=0#/${route}?doc=${encodeURIComponent(ids[3]!)}`
    await page.goto(link)
    await expect(primary(page)).toHaveAttribute('data-key', ids[3]!)
    await page.keyboard.press('Escape')
    await expect(dialogs(page)).toHaveCount(0)
    await (await sameLink(page, link)).click()
    await expect(primary(page)).toHaveAttribute('data-key', ids[3]!)
    await expect(dialogs(page)).toHaveCount(1)
  })

  test(`URL: документ вне текущей страницы реестра (${route})`, async ({ page }) => {
    const ids = await records(page, route)
    await page.getByRole('button', { name: 'Страница 2', exact: true }).click()
    await expect(page.locator('tbody[data-key]').first()).not.toHaveAttribute('data-key', ids[0]!)
    const outside = await page.locator('tbody[data-key]').first().getAttribute('data-key')
    await page.locator('tbody[data-key]').first().locator('[data-k-open]').click()
    await dialogs(page).first().locator('[data-part="hero"]').waitFor()
    const name = await dialogs(page).first().getAttribute('aria-label')
    await page.goto(`/?slow=0#/${route}?doc=${encodeURIComponent(outside!)}`)
    await expect(page.locator('tbody[data-key]').first()).toHaveAttribute('data-key', ids[0]!)
    await expect(page.locator(`tbody[data-key="${outside}"]`)).toHaveCount(0)
    await expect(dialogs(page)).toHaveCount(1)
    await expect(dialogs(page).first()).toHaveAttribute('aria-label', name!)
  })

  test(`URL: неизвестный/некорректный ID даёт ошибку детали, пустой не открывает документ (${route})`, async ({ page }) => {
    for (const value of ['not%2Fa%20document', '%E0%A4%A']) {
      await page.goto(`/?slow=0#/${route}?doc=${value}`)
      await page.locator('tbody[data-key]').first().waitFor()
      await expect(dialogs(page)).toHaveCount(1)
      await expect(dialogs(page).getByText('Не удалось загрузить документ', { exact: true })).toBeVisible()
      await expect(primary(page)).toHaveCount(0)
    }
    await page.goto(`/?slow=0&noauto#/${route}?doc=`)
    await page.locator('tbody[data-key]').first().waitFor()
    await expect(dialogs(page)).toHaveCount(0)
  })

  test(`URL: Back/Forward открывают документы из истории (${route})`, async ({ page }) => {
    const ids = await records(page, route)
    await page.goto(`/?slow=0#/${route}?doc=${encodeURIComponent(ids[3]!)}`)
    await expect(primary(page)).toHaveAttribute('data-key', ids[3]!)
    await page.evaluate((hash) => { location.hash = hash }, `#/${route}?doc=${encodeURIComponent(ids[4]!)}`)
    await expect(primary(page)).toHaveAttribute('data-key', ids[4]!)
    await page.goBack()
    await expect(primary(page)).toHaveAttribute('data-key', ids[3]!)
    await page.goForward()
    await expect(primary(page)).toHaveAttribute('data-key', ids[4]!)
    await expect(dialogs(page)).toHaveCount(1)
  })
}
