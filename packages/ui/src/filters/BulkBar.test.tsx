import { useState } from 'react'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Button } from '../button'
import { BulkBar } from './BulkBar'
import type { Selection } from '../grid/types'

describe('BulkBar', () => {
  it('при нуле не рендерится', () => {
    renderK(<BulkBar selection={{ mode: 'ids', ids: [] }} total={87} onClear={() => {}} />)
    expect(screen.queryByRole('region')).toBeNull()
  })
  it('режим ids: «Выбрано N», «Выбрать все total по фильтру», «Снять выделение», слот действий, объявление', async () => {
    const u = userEvent.setup()
    const onClear = vi.fn(); const onSelectAll = vi.fn(); const onExport = vi.fn()
    const { container } = renderK(
      <BulkBar selection={{ mode: 'ids', ids: ['a', 'b'] }} total={87} onClear={onClear} onSelectAll={onSelectAll}>
        <Button size="s" onClick={onExport}>Экспортировать</Button>
      </BulkBar>,
    )
    const region = screen.getByRole('region', { name: 'Массовые действия' })
    expect(region).toHaveTextContent('Выбрано 2')
    // LiveRegion объявляет через requestAnimationFrame (сброс → запись) — дожидаемся кадра, как в Value.test.tsx/KatranProvider.test.tsx
    await act(async () => { await new Promise((r) => requestAnimationFrame(r)) })
    expect(screen.getByRole('status')).toHaveTextContent('Выбрано 2')
    await u.click(screen.getByRole('button', { name: 'Выбрать все 87 по фильтру' }))
    expect(onSelectAll).toHaveBeenCalled()
    await u.click(screen.getByRole('button', { name: 'Снять выделение' }))
    expect(onClear).toHaveBeenCalled()
    await u.click(screen.getByRole('button', { name: 'Экспортировать' }))
    expect(onExport).toHaveBeenCalled()
    expect(await axe(container)).toHaveNoViolations()
  })
  it('режим all: «Все N по фильтру» с учётом except; без onSelectAll кнопки нет', () => {
    renderK(<BulkBar selection={{ mode: 'all', except: ['x'] }} total={87} onClear={() => {}} />)
    expect(screen.getByRole('region')).toHaveTextContent('Все 86 по фильтру')
    expect(screen.queryByRole('button', { name: /Выбрать все/ })).toBeNull()
  })
  it('«Снять выделение» → полоса исчезает, снятие объявляется «Выделение снято»; первый рендер с нулём не объявляется', async () => {
    const u = userEvent.setup()
    const frame = () => act(async () => { await new Promise((r) => requestAnimationFrame(r)) })
    function Host() {
      const [sel, setSel] = useState<Selection>({ mode: 'ids', ids: [] })
      return <><button type="button" onClick={() => setSel({ mode: 'ids', ids: ['a'] })}>выбрать</button><BulkBar selection={sel} total={87} onClear={() => setSel({ mode: 'ids', ids: [] })} /></>
    }
    renderK(<Host />)
    await frame()
    expect(screen.getByRole('status')).toHaveTextContent('')
    await u.click(screen.getByRole('button', { name: 'выбрать' }))
    await frame()
    expect(screen.getByRole('status')).toHaveTextContent('Выбрано 1')
    await u.click(screen.getByRole('button', { name: 'Снять выделение' }))
    expect(screen.queryByRole('region')).toBeNull()
    await frame()
    expect(screen.getByRole('status')).toHaveTextContent('Выделение снято')
  })
})
