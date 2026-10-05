import { screen, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { KeyValueList, type KeyValueItem } from './KeyValueList'

// Данные — вымышленные, по форме групп «Доп. поля» и «Комплаенс» эталона (XTAB, index.html:650–667; compHtml, 1263–1270)
const refs: KeyValueItem[] = [
  { key: '20', label: '20', hint: 'Референс отправителя', value: 'FX2609220000417', mono: true, aside: '15 симв.' },
  { key: '21', label: '21', hint: 'Связанный референс', value: null },
  { key: 'uetr', label: 'UETR', value: '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b', mono: true },
  { key: 'ext', label: 'Внешний референс', value: '' },
]
const row = (key: string) => document.querySelector(`[data-kv="${key}"]`) as HTMLElement

describe('KeyValueList (спека 2b §2)', () => {
  it('заголовок группы — h3; пары — dt/dd в строках списка', () => {
    renderK(<KeyValueList title="Референсы" items={refs} />)
    expect(screen.getByRole('heading', { level: 3, name: 'Референсы' })).toBeInTheDocument()
    const dl = document.querySelector('dl')!
    expect(dl.querySelectorAll('dt')).toHaveLength(4)
    expect(dl.querySelectorAll('dd')).toHaveLength(4)
    expect(within(row('uetr')).getByText('UETR').tagName).toBe('DT')
    expect(within(row('uetr')).getByText('3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b').closest('dd')).not.toBeNull()
  })

  it('без заголовка — без полосы', () => {
    renderK(<KeyValueList items={refs} />)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('пустое значение (null и пустая строка) — «—» только для глаз, скринридеру «не заполнено»', () => {
    renderK(<KeyValueList items={refs} />)
    for (const key of ['21', 'ext']) {
      const dd = row(key).querySelector('dd')!
      expect(dd).toHaveAttribute('data-empty')
      expect(within(dd).getByText('—')).toHaveAttribute('aria-hidden', 'true')
      expect(within(dd).getByText('не заполнено')).toHaveClass('sr')
    }
    expect(row('20').querySelector('dd')).not.toHaveAttribute('data-empty')
  })

  it('подсказка подписи: тултипом и скрытым текстом; без подсказки строковая подпись — тултип при обрезке', () => {
    renderK(<KeyValueList items={refs} />)
    const dt20 = row('20').querySelector('dt')!
    expect(dt20).toHaveAttribute('data-k-tip', 'Референс отправителя')
    expect(dt20).not.toHaveAttribute('data-k-tip-if')
    expect(dt20).toHaveTextContent('20 · Референс отправителя')
    const dtExt = row('ext').querySelector('dt')!
    expect(dtExt).toHaveAttribute('data-k-tip', 'Внешний референс')
    expect(dtExt).toHaveAttribute('data-k-tip-if', 'truncated')
  })

  it('моноширинное значение и приписка справа', () => {
    renderK(<KeyValueList items={refs} />)
    expect(screen.getByText('FX2609220000417')).toHaveClass('kvMono')
    expect(screen.getByText('15 симв.')).toHaveClass('kvAside')
    expect(screen.getByText('15 симв.').closest('dd')).toBe(row('20').querySelector('dd'))
  })

  it('ширина подписи — px при плотности 1 в calc с --k-density; по умолчанию 150', () => {
    const { unmount } = renderK(<KeyValueList items={refs} />)
    expect(document.querySelector('dl')).toHaveStyle({ '--k-kv-label': 'calc(150px * var(--k-density))' })
    unmount()
    renderK(<KeyValueList items={refs} labelWidth={40} />)
    expect(document.querySelector('dl')).toHaveStyle({ '--k-kv-label': 'calc(40px * var(--k-density))' })
  })

  it('две колонки: dt/dd прямо в сетке .kvs, без рамки; ширина подписи — только заданная', () => {
    const { container } = renderK(<KeyValueList columns={2} items={refs} />)
    const dl = container.querySelector('dl')!
    expect(dl).toHaveClass('kvs')
    expect(Array.from(dl.children).map((el) => el.tagName)).toEqual(['DT', 'DD', 'DT', 'DD', 'DT', 'DD', 'DT', 'DD'])
    expect(dl.getAttribute('style')).toBeNull()
    expect(dl.parentElement).toHaveClass('kvPlain')
  })

  it('wide: в две колонки — dd с data-wide (значение до конца строки); в одну колонку не влияет', () => {
    const items: KeyValueItem[] = [{ ...refs[2]!, wide: true }, refs[0]!]
    const { unmount } = renderK(<KeyValueList columns={2} items={items} />)
    const dds = document.querySelectorAll('dd')
    expect(dds[0]).toHaveAttribute('data-wide', '')
    expect(dds[1]).not.toHaveAttribute('data-wide')
    unmount()
    renderK(<KeyValueList items={items} />)
    expect(document.querySelector('dd')).not.toHaveAttribute('data-wide')
  })

  it('подпись — ReactNode (номер поля элементом)', () => {
    renderK(<KeyValueList labelWidth={40} items={[{ key: '32A', label: <b>32A</b>, value: '260922' }]} />)
    expect(screen.getByText('32A').closest('dt')).not.toBeNull()
    expect(screen.getByText('32A').closest('dt')).not.toHaveAttribute('data-k-tip')
  })

  it('без нарушений axe — одна и две колонки', async () => {
    const { container } = renderK(
      <>
        <KeyValueList title="Референсы" items={refs} />
        <KeyValueList columns={2} items={refs} />
      </>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
