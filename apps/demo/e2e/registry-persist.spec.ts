import { expect, test } from '@playwright/test'

// Отдельный файл без beforeEach: registry.spec.ts чистит localStorage через page.addInitScript,
// а это применилось бы и к page.reload() ниже и обнулило бы то, что должно пережить перезагрузку.

test('«Валюта отдельной колонкой» добавляет колонку и переживает перезагрузку', async ({ page }) => {
  await page.goto('/#/grid')
  await page.locator('tbody[data-key]').first().waitFor()
  await page.getByRole('button', { name: 'Состав колонок' }).click()
  await page.getByRole('checkbox', { name: 'Валюта отдельной колонкой' }).check()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('columnheader', { name: /^Валюта/ })).toBeVisible()
  await page.reload()
  await page.locator('tbody[data-key]').first().waitFor()
  await expect(page.getByRole('columnheader', { name: /^Валюта/ })).toBeVisible()
})
