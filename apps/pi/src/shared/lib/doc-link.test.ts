import { buildDocLink, configureDocLinks, defaultDocLink } from './doc-link'

describe('doc-link (план 2d, Ruling R5)', () => {
  afterEach(() => { configureDocLinks({ build: defaultDocLink }) })

  it('defaultDocLink: origin + pathname текущей страницы, маршрут грида и ?doc= с кодированием id', () => {
    const base = `${location.origin}${location.pathname}`
    expect(defaultDocLink('fx-docs', 'x')).toBe(`${base}#/fx-docs?doc=x`)
    expect(defaultDocLink('rub-docs', 'a/b c?')).toBe(`${base}#/rub-docs?doc=a%2Fb%20c%3F`)
  })

  it('buildDocLink по умолчанию — defaultDocLink', () => {
    expect(buildDocLink('fx-docs', 'x')).toBe(defaultDocLink('fx-docs', 'x'))
  })

  it('configureDocLinks подменяет строитель для всех последующих вызовов; возврат defaultDocLink — сброс', () => {
    configureDocLinks({ build: (gridId, id) => `https://host.example/pi/${gridId}/${id}` })
    expect(buildDocLink('fx-docs', 'x')).toBe('https://host.example/pi/fx-docs/x')
    configureDocLinks({ build: defaultDocLink })
    expect(buildDocLink('fx-docs', 'x')).toBe(defaultDocLink('fx-docs', 'x'))
  })
})
