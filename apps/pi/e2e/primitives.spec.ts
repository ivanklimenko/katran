import { expect, test } from '@playwright/test'

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
  }
}
