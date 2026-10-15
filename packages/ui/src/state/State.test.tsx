import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { ProgressBar } from './ProgressBar'
import { Skeleton, dimClass } from './Skeleton'

describe('состояния', () => {
  it('скелетон скрыт от скринридера и рисует N строк', () => {
    const { container } = renderK(<Skeleton.Line lines={3} width="60%" />)
    const root = container.querySelector('[aria-hidden="true"]')!
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root.children).toHaveLength(3)
  })
  it('dimClass — постоянный класс k-dim, правило под корнем провайдера приглушает элемент', () => {
    expect(dimClass).toBe('k-dim')
    renderK(<span className={dimClass}>Данные</span>)
    const st = getComputedStyle(screen.getByText('Данные'))
    expect(st.opacity).toBe('0.55')
    expect(st.pointerEvents).toBe('none')
  })
  it('высота строки скелетона — атрибутом data-h', () => {
    const { container } = renderK(<Skeleton.Line lines={2} height="s" />)
    const bars = container.querySelectorAll('[aria-hidden="true"] > span')
    expect([...bars].map((b) => b.getAttribute('data-h'))).toEqual(['s', 's'])
  })
  it('прогресс с именем', () => {
    renderK(<ProgressBar label="Обновление данных" />)
    expect(screen.getByRole('progressbar', { name: 'Обновление данных' })).toBeInTheDocument()
  })
  it('пустое состояние с действием', async () => {
    const onClick = vi.fn()
    renderK(<EmptyState title="По заданным условиям документов нет" action={{ label: 'Сбросить фильтр', onClick }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Сбросить фильтр' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
  it('ошибка с повтором', async () => {
    const retry = vi.fn()
    renderK(<ErrorState title="Не удалось загрузить" retry={retry} />)
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<>
      <Skeleton.Line /><ProgressBar label="x" /><EmptyState title="Пусто" /><ErrorState title="Ошибка" retry={() => {}} />
    </>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
