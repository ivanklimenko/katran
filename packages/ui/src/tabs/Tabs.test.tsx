import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { TabPanel } from './TabPanel'
import { Tabs, type TabItem } from './Tabs'

const items: TabItem[] = [
  { id: 'docs', label: 'Документы', count: 84 },
  { id: 'archive', label: 'Архив документов' },
  { id: 'research', label: 'Исследование', disabled: true },
  { id: 'prio', label: 'Приоритеты' },
]

function Host({ orientation }: { orientation?: 'horizontal' | 'vertical' }) {
  const [v, setV] = useState('docs')
  return (
    <>
      <Tabs id="reg" label="Разделы реестра" items={items} value={v} onChange={setV} orientation={orientation} />
      {items.map((it) => <TabPanel key={it.id} tabsId="reg" tabId={it.id} active={v === it.id}>Панель {it.label}</TabPanel>)}
    </>
  )
}

describe('Tabs', () => {
  it('роли, выбранный таб, связь с панелью, счётчик', () => {
    renderK(<Host />)
    const list = screen.getByRole('tablist', { name: 'Разделы реестра' })
    expect(list).toHaveAttribute('aria-orientation', 'horizontal')
    const docs = screen.getByRole('tab', { name: /Документы/ })
    expect(docs).toHaveAttribute('aria-selected', 'true')
    expect(docs).toHaveTextContent('84')
    const panel = screen.getByRole('tabpanel', { name: /Документы/ })
    expect(docs).toHaveAttribute('aria-controls', panel.id)
    expect(screen.queryByText('Панель Архив документов')).toBeNull()
  })

  it('стрелка двигает фокус, пропуская недоступный; выбор — по Enter (ручная активация)', async () => {
    renderK(<Host />)
    screen.getByRole('tab', { name: /Документы/ }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Архив документов' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: /Документы/ })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Приоритеты' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('tab', { name: 'Приоритеты' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Панель Приоритеты')).toBeVisible()
  })

  it('вертикальные: ↑↓ и aria-orientation', async () => {
    renderK(<Host orientation="vertical" />)
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical')
    screen.getByRole('tab', { name: /Документы/ }).focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('tab', { name: 'Архив документов' })).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Приоритеты' })).toHaveFocus()
  })

  it('клик выбирает; недоступный не выбирается', async () => {
    renderK(<Host />)
    await userEvent.click(screen.getByRole('tab', { name: 'Архив документов' }))
    expect(screen.getByRole('tab', { name: 'Архив документов' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('tab', { name: 'Исследование' }))
    expect(screen.getByRole('tab', { name: 'Архив документов' })).toHaveAttribute('aria-selected', 'true')
  })

  it('без нарушений axe', async () => {
    const { container } = renderK(<Host />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('выбранный таб недоступен → таб-стоп на первом доступном', () => {
    renderK(<Tabs id="x" label="Т" items={[{ id: 'a', label: 'A', disabled: true }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }]} value="a" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute('tabindex', '0')
  })
})
