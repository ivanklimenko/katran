import { expect, test } from '@playwright/test'
import { contrastRatio, sizes } from '@katran/tokens'

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
  }
}
