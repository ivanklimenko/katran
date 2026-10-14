import { render, screen } from '@testing-library/react'
import { styled } from '../styled'
import { KatranProvider } from './KatranProvider'
import { CopyValue } from '../value/CopyValue'

// Переопределение горячего пути так, как это сделает потребитель: styled(Компонент) — группа его стилей
// определена позже группы HotStyles и при равной специфичности (0,1,0) побеждает её.
// rgb() в шаблонах запрещён ради токенов; здесь это проверочное значение, не цвет интерфейса.
const Recolored = styled(CopyValue)`
  /* stylelint-disable-next-line declaration-property-value-disallowed-list */
  color: rgb(1 2 3);
`

// Отдельный файл: здесь провайдер — первый экземпляр HotStyles в документе. styled-components 5 закрепляет
// место в листе за группой только первого экземпляра createGlobalStyle (при определении); группы второго
// и следующих экземпляров заводятся при их первом рендере — в конце листа, позже групп потребителя.
describe('HotStyles — переопределение потребителем', () => {
  it('styled(CopyValue) потребителя перебивает правило горячего пути', () => {
    render(<KatranProvider><Recolored value="перекрашено" /></KatranProvider>)
    const button = screen.getByRole('button', { name: 'перекрашено' })
    expect(button).toHaveClass('k-copy')
    expect(getComputedStyle(button).color).toBe('rgb(1, 2, 3)')
  })

  // Известное ограничение (отчёт Task 5): второй одновременно смонтированный провайдер (или повторно
  // смонтированный) вставляет те же правила в группу в конце листа — они перебивают styled(CopyValue).
  // it.fails: тест зелёный, пока ограничение есть, и покраснеет, когда его снимут.
  it.fails('при втором провайдере styled(CopyValue) всё ещё перебивает горячий путь', () => {
    render(<KatranProvider><Recolored value="a" /><KatranProvider><Recolored value="b" /></KatranProvider></KatranProvider>)
    expect(getComputedStyle(screen.getByRole('button', { name: 'a' })).color).toBe('rgb(1, 2, 3)')
  })
})
