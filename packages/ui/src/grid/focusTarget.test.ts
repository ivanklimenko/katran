import { gridFocusTarget } from './focusTarget'

describe('gridFocusTarget (спека 2a §5: фокус после закрытия деталки)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <table role="grid" aria-label="Другой"><tbody><tr><td data-cell="2:0" tabindex="0"><button data-k-open="d1">x</button></td></tr></tbody></table>
      <table role="grid" aria-label="Валютные документы"><tbody><tr>
        <td data-cell="2:0" tabindex="-1"><button data-k-open="d1">1</button></td>
        <td data-cell="2:1" tabindex="0">яч</td>
      </tr></tbody></table>`
  })
  it('кнопка открытия записи в гриде с этим именем', () => {
    expect(gridFocusTarget('Валютные документы', 'd1')?.textContent).toBe('1')
  })
  it('записи на странице нет — таб-стоп грида', () => {
    expect(gridFocusTarget('Валютные документы', 'd9')?.getAttribute('data-cell')).toBe('2:1')
  })
  it('грида нет — null', () => {
    expect(gridFocusTarget('Рублёвые документы', 'd1')).toBeNull()
  })
})
