import { render } from '@testing-library/react'
import { fontFaces } from '@katran/tokens/fonts'
import { KatranFonts } from '..'

const sheet = () => [...document.querySelectorAll('style[data-styled]')].map((n) => n.textContent ?? '').join('\n')

describe('KatranFonts', () => {
  it('добавляет 14 правил @font-face с font-display: swap', () => {
    render(<KatranFonts />)
    const faces = sheet().match(/@font-face\s*\{[^}]*\}/g) ?? []
    expect(faces).toHaveLength(14)
    for (const face of faces) expect(face).toMatch(/font-display:\s*swap/)
  })

  it('каждое правило — семейство, вес, unicode-range и адрес woff2 из fontFaces', () => {
    render(<KatranFonts />)
    const css = sheet()
    for (const f of fontFaces) {
      const rule = (css.match(/@font-face\s*\{[^}]*\}/g) ?? []).find((r) => r.includes(f.url))
      expect(rule, f.url).toBeDefined()
      expect(rule).toContain(`font-family:'${f.family}'`)
      expect(rule).toMatch(new RegExp(`font-weight:\\s*${f.weight}`))
      expect(rule).toMatch(/font-style:\s*normal/)
      expect(rule).toContain(`format('woff2')`)
      expect(rule).toContain(`unicode-range:${f.unicodeRange}`)
    }
  })
})
