import { expect, test } from '@playwright/test'
import { colors, contrastRatio, sizes } from '@katran/tokens'

function rgbToHex(color: string): string {
  const channels = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(color)
  if (!channels) throw new Error(`Неожиданный формат цвета: ${color}`)
  return '#' + channels.slice(1).map((channel) => Number(channel).toString(16).padStart(2, '0')).join('')
}

for (const theme of ['light', 'dark'] as const) {
  for (const density of [1, 1.25] as const) {
    test(`Icon и Spinner: ${theme}, плотность ${density}`, async ({ page }) => {
      await page.goto(`/e2e/fixtures/primitives.html?theme=${theme}&density=${density}`)
      const small = page.getByRole('img', { name: 'Поиск' })
      const medium = page.getByRole('img', { name: 'Знак загрузки' })
      await expect(small).toHaveCSS('width', `${14 * density}px`)
      await expect(medium).toHaveCSS('width', `${16 * density}px`)
      await expect(medium).toHaveCSS('animation-name', 'none')
      const inheritedColor = await small.evaluate((svg) => getComputedStyle(svg.parentElement!).color)
      await expect(small.locator('path')).toHaveCSS('stroke', inheritedColor)

      const edit = page.getByRole('button', { name: 'Правка' })
      await expect(edit.locator('svg')).toHaveAttribute('aria-hidden', 'true')
      await expect(page.getByRole('button', { name: 'Свой знак' })).toHaveAttribute('name', 'form-action')
      await edit.click()
      await expect(page.getByLabel('Число кликов')).toHaveText('1')

      const sizes = [['Загрузка S', 14], ['Загрузка', 16], ['Загрузка L', 40]] as const
      for (const [name, diameter] of sizes) {
        const ring = page.getByRole('status', { name, exact: true }).locator('[aria-hidden="true"]')
        await expect(ring).toHaveCSS('width', `${diameter * density}px`)
        await expect(ring).toHaveCSS('height', `${diameter * density}px`)
      }

      const block = page.getByRole('status', { name: 'Загрузка панели' })
      const ring = block.locator('[aria-hidden="true"]')
      await expect(ring).toHaveCSS('animation-duration', '0.8s')
      await expect(ring).not.toHaveCSS('animation-name', 'none')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await expect(ring).toHaveCSS('animation-name', 'none')
      await expect(block).toBeVisible()
      const panelBox = (await page.getByTestId('spinner-panel').boundingBox())!
      const ringBox = (await ring.boundingBox())!
      expect(ringBox.x + ringBox.width / 2).toBeCloseTo(panelBox.x + panelBox.width / 2, 1)
      expect(ringBox.y + ringBox.height / 2).toBeCloseTo(panelBox.y + panelBox.height / 2, 1)
    })

    test(`Text: ${theme}, плотность ${density}`, async ({ page }) => {
      await page.goto(`/e2e/fixtures/primitives.html?theme=${theme}&density=${density}`)
      const section = page.getByTestId('text-samples')
      await expect(section).toBeVisible()
      const fontsLoaded = await page.evaluate(async () => {
        const fonts = await document.fonts.ready
        return [400, 500, 700].every((weight) => fonts.check(`${weight} 12px "IBM Plex Sans"`, 'Текст'))
          && [...fonts].some((face) => face.family === 'IBM Plex Sans' && face.status === 'loaded')
      })
      expect(fontsLoaded).toBe(true)
      const background = await section.evaluate((element) => getComputedStyle(element).backgroundColor)
      const roles = [
        ['body', 'p', 'fs-1', 'lh-1', '400'],
        ['subhead', 'h2', 'fs-h2', 'lh-1', '500'],
        ['caption', 'span', 'fs-2', 'lh-2', '400'],
        ['meta', 'span', 'fs-3', 'lh-3', '400'],
        ['inline', 'span', 'fs-1', 'lh-1', '700'],
      ] as const
      for (const [role, tag, size, height, weight] of roles) {
        const text = section.locator(`:scope > ${tag}[data-variant="${role}"]`)
        await expect(text).toHaveCSS('font-family', /IBM Plex Sans/)
        await expect(text).toHaveCSS('font-size', `${sizes[size] * density}px`)
        await expect(text).toHaveCSS('line-height', `${sizes[height] * density}px`)
        await expect(text).toHaveCSS('font-weight', weight)
        const color = await text.evaluate((element) => getComputedStyle(element).color)
        expect(contrastRatio(rgbToHex(color), rgbToHex(background))).toBeGreaterThanOrEqual(4.5)
      }
      await expect(section.locator('p > span[data-variant="subhead"]')).toHaveText('Внутри абзаца')
      await expect(section.locator('p p, p h2')).toHaveCount(0)
    })

    test(`Link: ${theme}, плотность ${density}`, async ({ page, context }) => {
      const fixtureUrl = `/e2e/fixtures/primitives.html?theme=${theme}&density=${density}`
      await page.goto(fixtureUrl)
      const link = page.getByRole('link', { name: 'пример перехода' })
      const file = page.getByRole('link', { name: 'пример файла' })
      const section = page.getByTestId('link-samples')
      await expect(section).toBeVisible()
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      const paper = await section.evaluate((element) => getComputedStyle(element).backgroundColor)

      for (const sample of [link, file]) {
        const parentSize = await sample.evaluate((element) => getComputedStyle(element.parentElement!).fontSize)
        const color = await sample.evaluate((element) => getComputedStyle(element).color)
        await expect(sample).toHaveCSS('font-size', parentSize)
        await expect(sample).toHaveCSS('text-decoration-line', 'none')
        expect(rgbToHex(color)).toBe(colors[theme].val.toLowerCase())
        expect(contrastRatio(rgbToHex(color), rgbToHex(paper))).toBeGreaterThanOrEqual(4.5)
      }

      await link.hover()
      await expect(link).toHaveCSS('text-decoration-line', 'underline')
      await page.mouse.move(0, 0)
      await expect(link).toHaveCSS('text-decoration-line', 'none')

      await page.getByRole('button', { name: 'Свой знак' }).focus()
      await page.keyboard.press('Tab')
      await expect(link).toBeFocused()
      await expect(link).toHaveCSS('text-decoration-line', 'underline')
      await expect(link).toHaveCSS('outline-style', 'solid')
      await expect(link).toHaveCSS('outline-width', '2px')
      await expect(link).toHaveCSS('outline-offset', '1px')

      const [tab] = await Promise.all([
        context.waitForEvent('page'),
        link.click({ modifiers: ['ControlOrMeta'] }),
      ])
      await expect(tab).toHaveURL(`${fixtureUrl}#link-target`)
      await expect(page).toHaveURL(fixtureUrl)
      await tab.close()

      await link.click()
      await expect(page).toHaveURL(`${fixtureUrl}#link-target`)

      await expect(file).toHaveAttribute('download', 'katran.txt')
      const [download] = await Promise.all([page.waitForEvent('download'), file.click()])
      expect(download.suggestedFilename()).toBe('katran.txt')
      expect(await download.failure()).toBeNull()
    })

    test(`Textarea: ${theme}, плотность ${density}`, async ({ page }) => {
      await page.goto(`/e2e/fixtures/primitives.html?theme=${theme}&density=${density}`)
      const textarea = page.getByRole('textbox', { name: 'Комментарий', exact: true })
      const input = page.getByRole('textbox', { name: 'Однострочное поле' })
      const invalid = page.getByRole('textbox', { name: 'Невалидный комментарий' })
      await expect(textarea).toBeVisible()
      await page.evaluate(() => document.fonts.ready.then(() => undefined))

      await expect(textarea).toHaveAttribute('rows', '3')
      await expect(textarea).toHaveCSS('resize', 'vertical')
      await expect(textarea).toHaveCSS('font-size', `${sizes['fs-1'] * density}px`)
      await expect(invalid).toHaveCSS('font-size', `${sizes['fs-2'] * density}px`)
      await expect(textarea).toHaveCSS('line-height', `${sizes['lh-1'] * density}px`)
      await expect(textarea).toHaveCSS('padding-left', `${sizes['sp-2'] * density}px`)
      expect((await textarea.boundingBox())!.height).toBeGreaterThan((await input.boundingBox())!.height)
      await expect(invalid).toHaveAttribute('aria-invalid', 'true')
      const invalidBorder = await invalid.evaluate((element) => getComputedStyle(element).borderTopColor)
      expect(rgbToHex(invalidBorder)).toBe(colors[theme].bad.toLowerCase())
      const [hint, paper] = await invalid.evaluate((element) => [
        getComputedStyle(element, '::placeholder').color, getComputedStyle(element).backgroundColor,
      ])
      expect(contrastRatio(rgbToHex(hint), rgbToHex(paper))).toBeGreaterThanOrEqual(4.5)

      await page.getByRole('link', { name: 'пример файла' }).focus()
      await page.keyboard.press('Tab')
      await expect(textarea).toBeFocused()
      await expect(textarea).toHaveCSS('outline-width', '2px')
      const outline = await textarea.evaluate((element) => getComputedStyle(element).outlineColor)
      expect(rgbToHex(outline)).toBe(colors[theme].val.toLowerCase())

      await textarea.pressSequentially('First')
      await textarea.press('Enter')
      await textarea.pressSequentially('Second')
      await expect(textarea).toHaveValue('First\nSecond')
      await page.keyboard.press('Tab')
      await expect(input).toBeFocused()
      await expect(textarea).toHaveValue('First\nSecond')

      await page.getByRole('button', { name: 'Подставить комментарий' }).click()
      await expect(textarea).toHaveValue('Готовый\nответ')
    })

    test(`MaskedInput: ${theme}, плотность ${density}`, async ({ page }) => {
      await page.goto(`/e2e/fixtures/primitives.html?theme=${theme}&density=${density}`)
      const code = page.getByRole('textbox', { name: 'Код с маской' })
      const result = page.getByLabel('Значение кода')
      const caret = (start: number, end = start) => code.evaluate(
        (el, [from, to]) => (el as HTMLInputElement).setSelectionRange(from!, to!),
        [start, end],
      )

      await code.focus()
      await caret(1, 6)
      await code.press('8')
      await expect(result).toHaveText('18-7-45')
      await expect(code).toHaveJSProperty('selectionStart', 2)

      await caret(5)
      await code.press('Backspace')
      await expect(code).toHaveValue('14-7-5')
      await expect(code).toHaveJSProperty('selectionStart', 1)

      await caret(1)
      await code.press('a')
      await expect(code).toHaveValue('14-7-5')
      await expect(code).toHaveJSProperty('selectionStart', 1)

      await code.selectText()
      await code.evaluate((el) => {
        const data = new DataTransfer()
        data.setData('text/plain', '90 / 123')
        el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }))
      })
      await expect(result).toHaveText('90-7-123')
      await expect(code).toHaveJSProperty('selectionStart', 8)
      await expect(code).not.toHaveAttribute('aria-invalid')

      await page.getByRole('button', { name: 'Подставить код' }).click()
      await expect(code).toHaveValue('67-7-890')
      await code.fill('82-7-345')
      await expect(result).toHaveText('82-7-345')
    })

    test(`TimeField: ${theme}, плотность ${density}`, async ({ page }) => {
      await page.goto(`/e2e/fixtures/primitives.html?theme=${theme}&density=${density}`)
      const field = page.getByRole('textbox', { name: 'Время с секундами' })
      const value = page.getByLabel('Значение времени')
      await expect(field).toBeVisible()
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      await expect(field.locator('..')).toHaveCSS('height', `${sizes['h-ctl-l'] * density}px`)
      await expect(field).toHaveAttribute('placeholder', 'чч:мм:сс')

      await field.pressSequentially('102029')
      await expect(field).toHaveValue('10:20:29')
      await expect(field).toHaveAttribute('aria-invalid', 'true')
      await expect(value).toHaveText('')
      await field.clear()
      await field.pressSequentially('102030')
      await expect(field).toHaveValue('10:20:30')
      await expect(field).not.toHaveAttribute('aria-invalid')
      await expect(value).toHaveText('10:20:30')

      await field.evaluate((element: HTMLInputElement) => element.setSelectionRange(6, 6))
      await field.press('Backspace')
      await expect(field).toHaveValue('10:23:0')
      await expect.poll(() => field.evaluate((element: HTMLInputElement) => element.selectionStart)).toBe(4)
      await expect(value).toHaveText('')

      await page.getByRole('button', { name: 'Выбрать дату' }).click()
      const dialog = page.getByRole('dialog')
      const calendarTime = dialog.getByRole('textbox', { name: 'Время', exact: true })
      await expect(calendarTime).toHaveAttribute('placeholder', 'чч:мм')
      await calendarTime.pressSequentially('0930')
      await calendarTime.press('Enter')
      await expect(dialog).toHaveCount(0)
      const date = page.getByRole('textbox', { name: 'Дата для календаря' })
      await expect(date).toHaveValue('15.09.2026 09:30')
      await expect(date).toBeFocused()
    })

    test(`RadioGroup: ${theme}, плотность ${density}`, async ({ page }) => {
      await page.goto(`/e2e/fixtures/primitives.html?theme=${theme}&density=${density}`)
      const group = page.getByRole('radiogroup', { name: 'Статус', exact: true })
      const draft = group.getByRole('radio', { name: 'Черновик' })
      const closed = group.getByRole('radio', { name: 'Закрыт' })
      const ready = group.getByRole('radio', { name: 'Готов' })
      const other = page.getByRole('radiogroup', { name: 'Другой статус' })
      const changes = page.getByLabel('Число смен статуса')
      await expect(group).toBeVisible()
      await page.evaluate(() => document.fonts.ready.then(() => undefined))

      await expect(draft).not.toBeChecked()
      await expect(ready).not.toBeChecked()
      await expect(closed).toBeDisabled()
      await expect(draft).toHaveCSS('width', `${sizes['dot-m'] * density}px`)
      await expect(draft).toHaveCSS('height', `${sizes['dot-m'] * density}px`)
      const border = await draft.evaluate((element) => getComputedStyle(element).borderTopColor)
      expect(rgbToHex(border)).toBe(colors[theme].line.toLowerCase())
      const [stroke, background] = await draft.evaluate((element) => {
        const style = getComputedStyle(element)
        return [style.boxShadow.match(/^rgb\([^)]*\)/)?.[0] ?? style.borderTopColor, style.backgroundColor]
      })
      expect(contrastRatio(rgbToHex(stroke), rgbToHex(background))).toBeGreaterThanOrEqual(3)

      await page.getByRole('button', { name: 'Перед радиокнопками' }).focus()
      await page.keyboard.press('Tab')
      await expect(draft).toBeFocused()
      await expect(draft).not.toBeChecked()
      await expect(draft).toHaveCSS('outline-width', '2px')
      const outline = await draft.evaluate((element) => getComputedStyle(element).outlineColor)
      expect(rgbToHex(outline)).toBe(colors[theme].val.toLowerCase())

      await page.keyboard.press('Space')
      await expect(draft).toBeChecked()
      await expect(draft).toHaveCSS('background-image', /radial-gradient/)
      await expect(changes).toHaveText('1')

      await page.keyboard.press('ArrowRight')
      await expect(ready).toBeFocused()
      await expect(ready).toBeChecked()
      await expect(draft).not.toBeChecked()
      await expect(closed).not.toBeChecked()
      await expect(changes).toHaveText('2')

      await page.keyboard.press('ArrowLeft')
      await expect(draft).toBeFocused()
      await expect(draft).toBeChecked()
      await expect(changes).toHaveText('3')
      await draft.click()
      await expect(changes).toHaveText('3')

      await other.getByRole('radio', { name: 'Готов' }).click()
      await expect(other.getByRole('radio', { name: 'Готов' })).toBeChecked()
      await expect(draft).toBeChecked()
      await expect(changes).toHaveText('3')

      const disabled = page.getByRole('radiogroup', { name: 'Недоступный статус' })
      for (const radio of await disabled.getByRole('radio').all()) await expect(radio).toBeDisabled()

      await page.emulateMedia({ forcedColors: 'active' })
      await expect(draft).toHaveCSS('appearance', 'auto')
      await expect(draft).toBeChecked()
    })

    test(`Breadcrumbs: ${theme}, плотность ${density}`, async ({ page }) => {
      const fixtureUrl = `/e2e/fixtures/primitives.html?theme=${theme}&density=${density}`
      await page.goto(fixtureUrl)
      const nav = page.getByRole('navigation', { name: 'Навигационная цепочка' })
      const parent = nav.getByRole('link', { name: 'Реестры' })
      const current = nav.getByRole('link', { name: 'Платежи' })
      const separators = nav.getByText('/', { exact: true })
      await expect(nav).toBeVisible()
      await page.evaluate(() => document.fonts.ready.then(() => undefined))

      await expect(nav.getByRole('listitem')).toHaveCount(3)
      await expect(nav.getByRole('link')).toHaveCount(2)
      await expect(current).toHaveAttribute('aria-current', 'page')
      await expect(nav).toHaveCSS('font-size', `${sizes['fs-2'] * density}px`)
      await expect(separators).toHaveCount(2)
      for (const separator of await separators.all()) await expect(separator).toHaveAttribute('aria-hidden', 'true')
      const parentColor = await parent.evaluate((element) => getComputedStyle(element).color)
      const currentColor = await current.evaluate((element) => getComputedStyle(element).color)
      const separatorColor = await separators.first().evaluate((element) => getComputedStyle(element).color)
      expect(rgbToHex(parentColor)).toBe(colors[theme].val.toLowerCase())
      expect(rgbToHex(currentColor)).toBe(colors[theme].ink.toLowerCase())
      expect(rgbToHex(separatorColor)).toBe(colors[theme].muted.toLowerCase())

      await page.getByRole('button', { name: 'Перед цепочкой' }).focus()
      await page.keyboard.press('Tab')
      await expect(parent).toBeFocused()
      await expect(parent).toHaveCSS('outline-style', 'solid')
      await page.keyboard.press('Tab')
      await expect(current).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(page.getByRole('button', { name: 'После цепочки' })).toBeFocused()

      await page.keyboard.press('Shift+Tab')
      await expect(current).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(`${fixtureUrl}#payments-target`)
    })

    test(`TripleState: ${theme}, плотность ${density}`, async ({ page }) => {
      await page.goto(`/e2e/fixtures/primitives.html?theme=${theme}&density=${density}`)
      const control = page.getByRole('button', { name: 'Фильтр по статусу' })
      const tooltip = page.getByRole('tooltip')
      const glyph = control.locator('svg')
      const count = page.getByLabel('Число переключений фильтра')
      await expect(control).toBeVisible()
      await page.evaluate(() => document.fonts.ready.then(() => undefined))

      await expect(control).toHaveCSS('height', `${sizes['h-ctl-m'] * density}px`)
      const box = (await control.boundingBox())!
      expect(box.width).toBeCloseTo(box.height, 1)
      await expect(control).toHaveAccessibleDescription('Не задано')
      await expect(control).not.toHaveAttribute('aria-pressed')
      const descriptionId = await control.getAttribute('aria-describedby')

      await page.getByRole('button', { name: 'Перед фильтром' }).focus()
      await page.keyboard.press('Tab')
      await expect(control).toBeFocused()
      await expect(control).toHaveCSS('outline-style', 'solid')
      await control.hover()
      await expect(tooltip).toHaveText('Не задано')
      const [tooltipText, tooltipBackground] = await tooltip.evaluate((element) => {
        const style = getComputedStyle(element)
        return [style.color, style.backgroundColor]
      })
      expect(contrastRatio(rgbToHex(tooltipText), rgbToHex(tooltipBackground))).toBeGreaterThanOrEqual(4.5)

      for (const [state, hint, background, color, key, changes] of [
        ['unset', 'Не задано', 'chip', 'muted', 'Space', '0'],
        ['on', 'Включено', 'ok-soft', 'ok', 'Enter', '1'],
        ['off', 'Выключено', 'bad-soft', 'bad', null, '2'],
      ] as const) {
        await expect(control).toHaveAttribute('data-state', state)
        await expect(control).toHaveAccessibleDescription(hint)
        await expect(control).toHaveAttribute('aria-describedby', descriptionId!)
        await expect(tooltip).toHaveText(hint)
        const expectedBackground = colors[theme][background].toLowerCase()
        const expectedGlyph = colors[theme][color].toLowerCase()
        await expect.poll(async () => rgbToHex(await control.evaluate((element) => getComputedStyle(element).backgroundColor))).toBe(expectedBackground)
        await expect.poll(async () => rgbToHex(await glyph.evaluate((element) => getComputedStyle(element).color))).toBe(expectedGlyph)
        expect(contrastRatio(expectedGlyph, expectedBackground)).toBeGreaterThanOrEqual(3)
        await expect(count).toHaveText(changes)
        if (key) await page.keyboard.press(key)
      }

      await control.click()
      await expect(control).toHaveAttribute('data-state', 'unset')
      await expect(count).toHaveText('3')
      await expect(tooltip).toHaveText('Не задано')
      await page.keyboard.press('Escape')
      await expect(tooltip).toHaveCount(0)
      await expect(control).toHaveAccessibleDescription('Не задано')
      await expect(control).toBeFocused()

      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
      await expect(tooltip).toHaveText('Не задано')
      await page.keyboard.press('Tab')
      await expect(control).not.toBeFocused()
      await expect(tooltip).toHaveCount(0)
      await expect(control).toHaveAccessibleDescription('Не задано')
      await expect(page.getByRole('button', { name: 'Недоступный фильтр' })).toBeDisabled()
    })

    test(`AmountField: ${theme}, плотность ${density}`, async ({ page }) => {
      await page.goto(`/e2e/fixtures/primitives.html?theme=${theme}&density=${density}`)
      const amount = page.getByRole('textbox', { name: 'Сумма платежа' })
      const value = page.getByLabel('Числовое значение суммы')
      const reset = page.getByRole('button', { name: 'Подставить сумму' })
      await expect(amount).toBeVisible()
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      await expect(amount).toHaveValue('1\u00a0000.50')
      await expect(amount).toHaveCSS('text-align', 'right')
      await expect(amount.locator('..')).toHaveCSS('height', `${sizes['h-ctl-m'] * density}px`)

      await amount.focus()
      await expect(amount).toHaveValue('1000.5')
      await expect(amount.locator('..')).toHaveCSS('outline-width', '2px')
      await amount.clear()
      await amount.pressSequentially('-2048.507')
      await expect(amount).toHaveValue('-2048.507')
      await expect(value).toHaveText('-2048.507')
      await amount.press('Tab')
      await expect(reset).toBeFocused()
      await expect(amount).toHaveValue('-2\u00a0048.51')

      await amount.focus()
      await amount.clear()
      await amount.pressSequentially('1e3')
      await expect(value).toHaveText('null')
      await expect(amount).toHaveAttribute('aria-invalid', 'true')
      await amount.press('Tab')
      await expect(amount).toHaveValue('1e3')
      await expect(amount.locator('..')).toHaveAttribute('data-invalid', 'true')

      await reset.click()
      await expect(amount).toHaveValue('1\u00a0000.50')
      await expect(amount).not.toHaveAttribute('aria-invalid')
    })

    test(`AmountRange и NumberRange: ${theme}, плотность ${density}`, async ({ page }) => {
      await page.goto(`/e2e/fixtures/primitives.html?theme=${theme}&density=${density}`)
      const money = page.getByRole('group', { name: 'Диапазон суммы' })
      const moneyFrom = money.getByRole('textbox', { name: 'От' })
      const moneyTo = money.getByRole('textbox', { name: 'До' })
      const moneyBounds = page.getByLabel('Границы суммы')
      await expect(money).toBeVisible()
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      await expect(money).toHaveCSS('column-gap', `${sizes['field-gap'] * density}px`)
      await expect(moneyFrom).toHaveCSS('text-align', 'right')
      await expect(moneyFrom).toHaveValue('-1\u00a0000.50')
      await expect(moneyTo).toHaveValue('2\u00a0500.00')
      await money.getByText('От', { exact: true }).click()
      await expect(moneyFrom).toBeFocused()
      await expect(moneyFrom).toHaveValue('-1000.5')
      await moneyFrom.fill('3000')
      await expect(moneyBounds).toHaveText('{"from":3000,"to":2500}')
      for (const field of [moneyFrom, moneyTo]) await expect(field).toHaveAttribute('aria-invalid', 'true')
      await moneyFrom.press('Tab')
      await expect(moneyTo).toBeFocused()
      await expect(moneyFrom).toHaveValue('3\u00a0000.00')

      await moneyFrom.focus()
      await expect(moneyFrom).toHaveValue('3000')
      await moneyFrom.fill('ошибка')
      await expect(moneyBounds).toHaveText('{"from":null,"to":2500}')
      await moneyFrom.press('Tab')
      await expect(moneyFrom).toHaveValue('ошибка')
      await expect(moneyFrom).toHaveAttribute('aria-invalid', 'true')
      await expect(moneyTo).not.toHaveAttribute('aria-invalid')

      const numeric = page.getByRole('group', { name: 'Диапазон числа' })
      const numberFrom = numeric.getByRole('spinbutton', { name: 'От' })
      const numberTo = numeric.getByRole('spinbutton', { name: 'До' })
      const numberBounds = page.getByLabel('Границы числа')
      await expect(numeric).toHaveCSS('column-gap', `${sizes['field-gap'] * density}px`)
      await expect(numberFrom).toHaveCSS('text-align', 'left')
      await expect(numberFrom).toHaveValue('1000.5')
      await numberFrom.press('ArrowUp')
      await expect(numberFrom).toHaveValue('1001')
      await expect(numberBounds).toHaveText('{"from":1001,"to":2500}')
      await numberTo.fill('1000')
      await expect(numberBounds).toHaveText('{"from":1001,"to":1000}')
      for (const field of [numberFrom, numberTo]) await expect(field).toHaveAttribute('aria-invalid', 'true')
      await numberFrom.clear()
      await expect(numberBounds).toHaveText('{"from":null,"to":1000}')
      for (const field of [numberFrom, numberTo]) await expect(field).not.toHaveAttribute('aria-invalid')
      await numberFrom.pressSequentially('-2.5')
      await expect(numberFrom).toHaveValue('-2.5')
      await expect(numberBounds).toHaveText('{"from":-2.5,"to":1000}')
    })
  }
}
