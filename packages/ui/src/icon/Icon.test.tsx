import { screen } from '@testing-library/react'
import { Icon, type IconName } from '../index'
import { renderK } from '../test/renderK'

const names = [
  'plus', 'edit', 'delete', 'alert', 'error', 'success', 'clock', 'search', 'info', 'doc', 'enter', 'drag',
  'arrow-up', 'arrow-down', 'monitoring', 'link', 'settings', 'check', 'refresh', 'copy', 'view-on',
  'show-menu', 'loading', 'stop', 'chevron-up', 'chevron-down', 'filter', 'cross', 'widget', 'clip-add',
] satisfies IconName[]

describe('Icon', () => {
  it('рисует все 30 знаков с доступными именами', () => {
    renderK(<>{names.map((name) => <Icon key={name} name={name} label={name} />)}</>)
    expect(screen.getAllByRole('img')).toHaveLength(30)
    for (const name of names) {
      const svg = screen.getByRole('img', { name })
      expect(svg.tagName).toBe('svg')
      expect(svg.firstElementChild).not.toBeNull()
    }
  })

  it('декоративный SVG скрыт и принимает className и размер', () => {
    const { container } = renderK(<Icon name="plus" size="s" className="consumer" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('consumer')
    expect(svg).toHaveAttribute('data-size', 's')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('img')).toBeNull()
  })
})
