import { expect, test } from '@playwright/test'
import { MT103_INSTRUCTION, MT202_TREASURY } from '../src/entities/fx-doc/api/instruction.fixture'

test('открывает локальный OpenSearch JSON и подсвечивает значения выбранной записи', async ({ page }) => {
  const imported = { ...MT202_TREASURY, id: 'local-import-example' }
  await page.goto('/?mapping=1&slow=0#/fx-docs?doc=fixture-mt103-in')
  const file = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Открыть JSON' }).click()
  await (await file).setFiles({
    name: 'test-export.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ hits: { hits: [
      { _source: { ...imported, childPaymentInstructionList: [] } },
      { _source: { childPaymentInstructionList: [MT103_INSTRUCTION] } }, { _source: {} },
    ] } })),
  })

  const detail = page.getByRole('dialog', { name: /880202$/ })
  const json = detail.getByRole('region', { name: 'Исходный JSON' })
  await expect(json.getByText('"id": "local-import-example",', { exact: true })).toBeVisible()
  await expect(detail.getByText('Пропущено записей: 1')).toBeVisible()
  await detail.locator('[data-field="58"] button').hover()
  await expect(json.locator('[data-json-highlighted]').filter({ hasText: 'SYNTHETIC BENEFICIARY BANK' })).toBeInViewport()

  await detail.getByRole('combobox', { name: 'Документ из файла' }).selectOption('1')
  await expect(page.getByRole('dialog', { name: /880001$/ }).getByRole('region', { name: 'Исходный JSON' })
    .getByText('"id": "fixture-mt103-in",', { exact: true })).toBeVisible()
  await page.getByRole('dialog', { name: /880001$/ }).getByRole('button', { name: 'Закрыть', exact: true }).click()
  await page.getByRole('combobox', { name: 'Документ из файла' }).selectOption('1')
  await expect(page.getByRole('dialog', { name: /880001$/ })).toBeVisible()
})

test('подсвечивает все источники реквизита MT202 в исходном ответе', async ({ page }) => {
  await page.goto('/?mapping=1&slow=0#/fx-docs?doc=fixture-mt202-treasury')
  const detail = page.getByRole('dialog', { name: /^Платёжная инструкция/ })
  const json = detail.getByRole('region', { name: 'Исходный JSON' })
  await expect(json).toBeVisible()
  await expect(json.getByText('"amount": "92000.10",', { exact: true }).first()).toBeAttached()

  await detail.locator('[data-field="58"]').getByRole('button').hover()
  const highlighted = json.locator('[data-json-highlighted]')
  await expect(highlighted).toHaveCount(3)
  await expect(highlighted.filter({ hasText: '"bankName": "SYNTHETIC BENEFICIARY BANK"' })).toBeInViewport()
  await expect(highlighted.filter({ hasText: '"swiftCode": "TESTKZ22XXX"' })).toHaveCount(1)
  await expect(highlighted.filter({ hasText: '"bankAccount": "/30100000000000000222"' })).toHaveCount(1)
  await expect(page.getByRole('tooltip')).toContainText('$.documentSection.transferTransactionInformation.beneficiaryPart.bankName')

  const source = json.getByRole('group', { name: 'Ответ API' })
  await source.evaluate((el) => { el.scrollTop = 0 })
  await json.getByRole('button', { name: /beneficiaryPart\.swiftCode$/ }).click()
  await expect(highlighted.filter({ hasText: '"swiftCode": "TESTKZ22XXX"' })).toBeInViewport()
  await expect(highlighted).toHaveCount(3)
  await detail.locator('[data-field="72"]').hover()
  await expect(highlighted).toHaveCount(1)
  await expect(highlighted).toContainText('"senderToReceiverInformation": "/BNF/ TEST TREASURY\\r\\nSECOND LINE"')
})

test('у каждой деталки при сравнении свой исходный ответ и подсветка', async ({ page }) => {
  await page.goto('/?mapping=1&slow=0#/fx-docs?doc=fixture-mt202-treasury')
  const left = page.locator('[data-k-drawer][data-slot="b"]')
  const right = page.locator('[data-k-drawer][data-slot="a"]')
  const jsonOf = (drawer: typeof left) => drawer.getByRole('region', { name: 'Исходный JSON' })
  await expect(jsonOf(right)).toBeVisible()
  await page.locator('tbody[data-key="fixture-mt103-in"] [data-k-open]').dblclick()

  const field = left.locator('[data-field="52"]').getByRole('button')
  await field.focus()
  await expect(jsonOf(left).locator('[data-json-highlighted]').filter({ hasText: '"name": "TEST CLEARING BANK"' })).toBeInViewport()
  await expect(jsonOf(right).locator('[data-json-highlighted]')).toHaveCount(0)
  await expect(jsonOf(right).getByText('"id": "fixture-mt202-treasury",', { exact: true })).toBeAttached()
})

test('подсвечивает исходную операцию с нужным индексом', async ({ page }) => {
  await page.goto('/?mapping=1&slow=0#/fx-docs?doc=fixture-internal-commission')
  const detail = page.getByRole('dialog', { name: /^Платёжная инструкция/ })
  const json = detail.getByRole('region', { name: 'Исходный JSON' })
  await detail.getByRole('button', { name: 'Транзакции' }).click()
  await detail.getByText('TEST_CREDIT', { exact: true }).hover()
  const highlighted = json.locator('[data-json-highlighted]')
  await expect(highlighted).toHaveCount(1)
  await expect(highlighted).toContainText('"registerType": "TEST_CREDIT"')
  await expect(page.getByRole('tooltip')).toHaveText('$.paymentTransactionSections[0].transactionOperations[1].registerType')
})

test('в обычном режиме деталка открывается без панели JSON', async ({ page }) => {
  await page.goto('/?slow=0#/fx-docs')
  const detail = page.getByRole('dialog', { name: /^Платёжная инструкция/ })
  await expect(detail.getByRole('tab', { name: 'Общие данные' })).toBeVisible()
  await expect(detail.getByRole('region', { name: 'Исходный JSON' })).toHaveCount(0)
})
