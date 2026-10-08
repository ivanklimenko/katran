import { HOST_LINK_MISSING, configureHostLinks, hostLink } from './host-links'

describe('host-links (срез 2e, §4 п. 9)', () => {
  afterEach(() => { configureHostLinks({}) })

  it('без настройки — null', () => {
    expect(hostLink('manualDeviations', '1')).toBeNull()
  })
  it('после configureHostLinks — ссылка строителя; повторный configureHostLinks({}) снова даёт null', () => {
    configureHostLinks({ manualDeviations: (id) => '/md?doc=' + id })
    expect(hostLink('manualDeviations', '1')).toBe('/md?doc=1')
    configureHostLinks({})
    expect(hostLink('manualDeviations', '1')).toBeNull()
  })
  it('подсказка недоступного перехода', () => {
    expect(HOST_LINK_MISSING).toBe('Переход не настроен для этого стенда')
  })
})
