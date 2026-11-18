import { screen } from '@testing-library/react'
import { Text, type TextVariant, type TextWeight } from '../index'
import { renderK } from '../test/renderK'

describe('Text', () => {
  it.each<[TextVariant, string, TextWeight]>([
    ['body', 'P', 'regular'],
    ['subhead', 'H2', 'medium'],
    ['caption', 'SPAN', 'regular'],
    ['meta', 'SPAN', 'regular'],
    ['inline', 'SPAN', 'regular'],
  ])('вариант %s выбирает тег %s и вес %s', (variant, tag, weight) => {
    renderK(<Text variant={variant}>Образец</Text>)
    const element = screen.getByText('Образец')

    expect(element.tagName).toBe(tag)
    expect(element).toHaveAttribute('data-variant', variant)
    expect(element).toHaveAttribute('data-weight', weight)
  })

  it('по умолчанию рендерит body цвета ink', () => {
    renderK(<Text>Платёж проведён</Text>)
    const element = screen.getByText('Платёж проведён')

    expect(element.tagName).toBe('P')
    expect(element).toHaveAttribute('data-variant', 'body')
    expect(element).toHaveAttribute('data-tone', 'ink')
  })

  it('позволяет выбрать тег, тон, вес и класс корня', () => {
    renderK(<Text variant="caption" as="div" tone="muted" weight="bold" className="extra">Подпись</Text>)
    const element = screen.getByText('Подпись')

    expect(element.tagName).toBe('DIV')
    expect(element).toHaveAttribute('data-tone', 'muted')
    expect(element).toHaveAttribute('data-weight', 'bold')
    expect(element).toHaveClass('extra')
  })

  it('заменяет вложенные теги на span на любой глубине внутри Text-абзаца', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      renderK(
        <Text variant="meta" as="p">
          Начало <Text variant="subhead">Заголовок <Text as="p">Абзац</Text></Text>
        </Text>,
      )
      expect(screen.getByText('Начало').tagName).toBe('P')
      expect(screen.getByText('Заголовок').tagName).toBe('SPAN')
      expect(screen.getByText('Абзац').tagName).toBe('SPAN')
      expect(errors).not.toHaveBeenCalled()
    } finally {
      errors.mockRestore()
    }
  })
})
