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
  }
}
