import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { Button } from '../button'
import { renderK } from '../test/renderK'
import { Banner, type BannerTone } from './Banner'

/** role="status" плашки (у KatranProvider — свой live-регион role="status", поэтому — по тексту). */
const statusOf = (text: string): HTMLElement => screen.getAllByRole('status').find((el) => el.textContent === text) as HTMLElement

describe('Banner (спека 2e §2.1)', () => {
  it('текст — в role="status", кнопки actions — вне него', () => {
    renderK(<Banner tone="warn" actions={<Button>Утвердить</Button>}>Запрос на аннулирование ожидает утверждения</Banner>)
    const status = statusOf('Запрос на аннулирование ожидает утверждения')
    expect(status).toBeInTheDocument()
    expect(within(status).queryByRole('button')).toBeNull()
    expect(screen.getByRole('button', { name: 'Утвердить' })).toBeInTheDocument()
  })

  it('onClose — кнопка «Закрыть» вне статуса, клик вызывает onClose', async () => {
    const onClose = vi.fn()
    renderK(<Banner tone="bad" onClose={onClose}>Запрос отклонён</Banner>)
    const close = screen.getByRole('button', { name: 'Закрыть' })
    expect(within(statusOf('Запрос отклонён')).queryByRole('button')).toBeNull()
    await userEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closeLabel — подпись кнопки закрытия', () => {
    renderK(<Banner tone="bad" onClose={vi.fn()} closeLabel="Закрыть уведомление">Запрос отклонён</Banner>)
    expect(screen.getByRole('button', { name: 'Закрыть уведомление' })).toBeInTheDocument()
  })

  it('без onClose кнопки закрытия нет', () => {
    renderK(<Banner tone="ok">Документ аннулирован</Banner>)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it.each<BannerTone>(['neutral', 'warn', 'bad', 'ok'])('data-tone="%s" — по тону', (tone) => {
    const { container } = renderK(<Banner tone={tone}>Текст</Banner>)
    expect(container.querySelector(`[data-tone="${tone}"]`)).toContainElement(statusOf('Текст'))
  })

  it('axe без нарушений', async () => {
    const { container } = renderK(
      <Banner tone="warn" actions={<Button>Утвердить</Button>} onClose={vi.fn()}>Запрос ожидает утверждения</Banner>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
