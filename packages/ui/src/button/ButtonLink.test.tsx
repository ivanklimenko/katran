import { screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Button } from './Button'
import { ButtonLink } from './ButtonLink'

describe('ButtonLink', () => {
  it('рендерит <a> с href и атрибутами ссылки, роль link', () => {
    renderK(<ButtonLink href="/md?doc=1" target="_blank" rel="noopener">Открыть</ButtonLink>)
    const a = screen.getByRole('link', { name: 'Открыть' })
    expect(a.tagName).toBe('A')
    expect(a).toHaveAttribute('href', '/md?doc=1')
    expect(a).toHaveAttribute('target', '_blank')
    expect(a).toHaveAttribute('rel', 'noopener')
  })
  it('вариант и размер — те же атрибуты, что у Button', () => {
    renderK(<><Button variant="primary" size="s">Кнопка</Button><ButtonLink href="#x" variant="primary" size="s">Ссылка</ButtonLink></>)
    for (const el of [screen.getByRole('button'), screen.getByRole('link')]) {
      expect(el).toHaveAttribute('data-variant', 'primary')
      expect(el).toHaveAttribute('data-size', 's')
    }
  })
  it('по умолчанию ghost и размер m, как у Button', () => {
    renderK(<><Button>Кнопка</Button><ButtonLink href="#x">Ссылка</ButtonLink></>)
    for (const el of [screen.getByRole('button'), screen.getByRole('link')]) {
      expect(el).toHaveAttribute('data-variant', 'ghost')
      expect(el).toHaveAttribute('data-size', 'm')
    }
    // одни и те же правила стилей: ссылка — тот же styled-компонент, что и кнопка
    expect(screen.getByRole('link').className).toBe(screen.getByRole('button').className)
  })
  it('ref указывает на <a>, className добавляется', () => {
    let el: HTMLAnchorElement | null = null
    renderK(<ButtonLink href="#x" className="extra" ref={(n) => { el = n }}>Ссылка</ButtonLink>)
    expect(el).toBe(screen.getByRole('link'))
    expect(screen.getByRole('link')).toHaveClass('extra')
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<ButtonLink href="#x" size="s">Перейти</ButtonLink>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
