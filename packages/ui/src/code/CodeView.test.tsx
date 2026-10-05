import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { CodeView } from './CodeView'

const HOSTILE = '<img src="x" onerror="window.__kPwned=1"><script>window.__kPwned=1</script>'
const SWIFT = '{1:F01NRDIRUMMAXXX0000000000}{3:{121:3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b}}{4:\n:20:FX2609220000417\n:32A:260922USD1250000,00\n-}'
// экранирование для значения атрибута XML; Record<string, string> — индекс строкой из replace без TS7053
const ENTITY: Record<string, string> = { '<': '&lt;', '>': '&gt;', '"': '&quot;' }
// без цифр: номера строк — только CSS-счётчиком, в тексте их быть не должно
const XML = '<Document xmlns="urn:iso:std"><Hdr><Id>ABC</Id></Hdr><Purp>оплата по договору</Purp></Document>'

describe('CodeView (спека 2b §2)', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>)['__kPwned']
  })

  it('область: role=region с именем, в порядке Tab', async () => {
    renderK(<CodeView code="{}" language="json" label="audit · commonSection" />)
    const region = screen.getByRole('region', { name: 'audit · commonSection' })
    expect(region).toHaveAttribute('tabindex', '0')
    await userEvent.tab()
    expect(region).toHaveFocus()
  })

  it('JSON: ключи, строки, числа и литералы — своими классами', () => {
    renderK(<CodeView code={JSON.stringify({ id: 'FX1', n: 12, ok: null }, null, 2)} language="json" label="JSON" />)
    expect(screen.getByText('"id"')).toHaveClass('key')
    expect(screen.getByText('"FX1"')).toHaveClass('str')
    expect(screen.getByText('12')).toHaveClass('num')
    expect(screen.getByText('null')).toHaveClass('lit')
    expect(screen.getByRole('region').querySelector('pre')).toHaveTextContent('"id": "FX1"')
  })

  it('не JSON — текст без подсветки', () => {
    renderK(<CodeView code="{id: 1,}" language="json" label="JSON" />)
    const region = screen.getByRole('region')
    expect(region.querySelectorAll('span')).toHaveLength(0)
    expect(region).toHaveTextContent('{id: 1,}')
  })

  it('SWIFT: блоки, теги и UETR', () => {
    renderK(<CodeView code={SWIFT} language="swift" label="SWIFT" />)
    expect(screen.getByText('{1:')).toHaveClass('blk')
    expect(screen.getByText(':20:')).toHaveClass('tag')
    expect(screen.getByText(':32A:')).toHaveClass('tag')
    expect(screen.getByText('3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b')).toHaveClass('uetr')
    expect(screen.getByRole('region').textContent).toBe(SWIFT)
  })

  it('XML: строки с глубиной в --k-d, выравнивание в --k-a; номера строк не входят в текст', () => {
    renderK(<CodeView code={XML} language="xml" label="ED244 · XML" />)
    const region = screen.getByRole('region', { name: 'ED244 · XML' })
    const lines = region.querySelectorAll('.xl')
    expect(Array.from(lines).map((l) => l.textContent)).toEqual([
      '<Document xmlns="urn:iso:std">', '<Hdr>', '<Id>ABC</Id>', '</Hdr>', '<Purp>оплата по договору</Purp>', '</Document>',
    ])
    expect(lines[2]).toHaveStyle({ '--k-d': '2', '--k-a': '0' })
    expect(region.textContent).not.toMatch(/\d/)
  })

  it('XML столбиком: у строк атрибутов --k-a — длина имени + 2', () => {
    const v = 'V'.repeat(45)
    renderK(<CodeView code={`<Tx a="${v}" b="${v}"/>`} language="xml" label="XML" />)
    const lines = screen.getByRole('region').querySelectorAll('.xl')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toHaveStyle({ '--k-d': '0', '--k-a': '4' })
  })

  it('битый XML — сырой текст по строкам, без подсветки', () => {
    renderK(<CodeView code={'<a>\n<b></a>'} language="xml" label="XML" />)
    const lines = screen.getByRole('region').querySelectorAll('.xl')
    expect(Array.from(lines).map((l) => l.textContent)).toEqual(['<a>', '<b></a>'])
    expect(screen.getByRole('region').querySelectorAll('span')).toHaveLength(0)
  })

  it('text — как есть', () => {
    renderK(<CodeView code={'строка 1\nстрока 2'} language="text" label="Текст" />)
    expect(screen.getByRole('region').querySelector('pre')!.textContent).toBe('строка 1\nстрока 2')
  })

  it('разметка в данных — текст на всех языках: ни элементов, ни исполнения', () => {
    renderK(
      <>
        <CodeView code={HOSTILE} language="text" label="text" />
        <CodeView code={JSON.stringify({ h: HOSTILE })} language="json" label="json" />
        <CodeView code={`{4:\n:70:${HOSTILE}\n-}`} language="swift" label="swift" />
        <CodeView code={`<a t="${HOSTILE.replace(/[<>"]/g, (c) => ENTITY[c] ?? c)}"/>`} language="xml" label="xml" />
        <CodeView code={HOSTILE} language="xml" label="xml битый" />
      </>,
    )
    expect(document.querySelector('img')).toBeNull()
    expect(document.querySelector('script')).toBeNull()
    expect((window as unknown as Record<string, unknown>)['__kPwned']).toBeUndefined()
    for (const name of ['text', 'swift', 'xml', 'xml битый']) {
      expect(screen.getByRole('region', { name }).textContent).toContain('<img src="x" onerror="window.__kPwned=1">')
    }
  })

  it('innerHTML не используется ни на одном языке', () => {
    const set = vi.spyOn(Element.prototype, 'innerHTML', 'set')
    try {
      renderK(
        <>
          <CodeView code={JSON.stringify({ a: [1, 'b'] })} language="json" label="json" />
          <CodeView code={SWIFT} language="swift" label="swift" />
          <CodeView code={XML} language="xml" label="xml" />
          <CodeView code="<a>" language="xml" label="xml битый" />
        </>,
      )
      expect(set).not.toHaveBeenCalled()
    } finally {
      set.mockRestore()
    }
  })

  it('без нарушений axe', async () => {
    const { container } = renderK(
      <>
        <CodeView code={JSON.stringify({ id: 'FX1' }, null, 2)} language="json" label="JSON" />
        <CodeView code={SWIFT} language="swift" label="SWIFT" />
        <CodeView code={XML} language="xml" label="XML" />
      </>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
