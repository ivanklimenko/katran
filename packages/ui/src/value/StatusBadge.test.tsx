import { screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { StatusBadge, type BadgeTone } from './StatusBadge'

describe('StatusBadge', () => {
  it('текст — содержимое, тон — атрибутом data-badge, точка скрыта от скринридера', () => {
    renderK(<StatusBadge tone="ok">ALLOW</StatusBadge>)
    const b = screen.getByText('ALLOW')
    expect(b).toHaveAttribute('data-badge', 'ok')
    expect(b.querySelector('[aria-hidden="true"]')).not.toBeNull()
    expect(b).toHaveTextContent(/^ALLOW$/)
  })
  it('четыре тона без нарушений axe', async () => {
    const tones: BadgeTone[] = ['ok', 'bad', 'wait', 'neutral']
    const { container } = renderK(<>{tones.map((t) => <StatusBadge key={t} tone={t}>{t.toUpperCase()}</StatusBadge>)}</>)
    expect(tones.map((t) => screen.getByText(t.toUpperCase()).getAttribute('data-badge'))).toEqual(tones)
    expect(await axe(container)).toHaveNoViolations()
  })
})
