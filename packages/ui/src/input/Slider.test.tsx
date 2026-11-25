import { fireEvent, screen } from '@testing-library/react'
import { Slider, type SliderProps } from '../index'
import { renderK } from '../test/renderK'

const slider = () => screen.getByRole<HTMLInputElement>('slider', { name: 'Объём' })

describe('Slider', () => {
  it.each([
    { min: 10, max: 20, step: undefined, value: -2, expected: 10, fill: '0%' },
    { min: 0.1, max: 0.3, step: 0.1, value: 0.3, expected: 0.3, fill: '100%' },
    { min: 0.2, max: 1, step: 0.3, value: 1, expected: 0.8, fill: '75%' },
    { min: -0.2, max: 0.5, step: 0.2, value: 0.3, expected: 0.4, fill: '85.7143%' },
    { min: 10, max: 5, step: 0, value: NaN, expected: 10, fill: '0%' },
    { min: -Infinity, max: 5, step: Infinity, value: Infinity, expected: 0, fill: '0%' },
    { min: 8, max: Infinity, step: -2, value: 8, expected: 8, fill: '0%' },
  ])('нормализует значение $value для диапазона $min–$max', ({ min, max, step, value, expected, fill }) => {
    const onChange = vi.fn()
    renderK(<Slider label="Объём" min={min} max={max} step={step} value={value} onChange={onChange} />)
    expect(slider()).toHaveAttribute('type', 'range')
    expect(slider()).toHaveValue(String(expected))
    expect(slider().parentElement?.style.getPropertyValue('--k-slider')).toBe(fill)
    if (value !== expected) expect(onChange).toHaveBeenCalledExactlyOnceWith(expected)
    else expect(onChange).not.toHaveBeenCalled()
  })

  it('сообщает коррекцию один раз даже при замене callback', () => {
    const first = vi.fn()
    const second = vi.fn()
    const props: SliderProps = { label: 'Объём', min: 0, max: 10, value: NaN, onChange: first }
    const { rerender } = renderK(<Slider {...props} />)
    expect(first).toHaveBeenCalledExactlyOnceWith(0)
    rerender(<Slider {...props} onChange={second} />)
    expect(second).not.toHaveBeenCalled()
    rerender(<Slider {...props} min={2} onChange={second} />)
    expect(second).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('показывает число рядом со шкалой и передаёт нативное значение', () => {
    const onChange = vi.fn()
    renderK(<Slider label="Объём" min={0} max={100} value={40} className="volume" onChange={onChange} />)
    expect(slider().parentElement).toHaveClass('volume')
    expect(slider()).toHaveAttribute('step', '1')
    expect(screen.getByText('40')).toBeVisible()
    expect(screen.getByText('0')).toBeVisible()
    expect(screen.getByText('100')).toBeVisible()
    fireEvent.change(slider(), { target: { value: '61' } })
    expect(onChange).toHaveBeenCalledExactlyOnceWith(61)
  })

  it('приводит округлённое браузером число к шагу перед вызовом onChange', () => {
    const onChange = vi.fn()
    const step = 0.1 + 0.2
    renderK(<Slider label="Объём" min={0} max={1} step={step} value={0} onChange={onChange} />)
    fireEvent.change(slider(), { target: { value: '0.3' } })
    expect(onChange).toHaveBeenCalledExactlyOnceWith(step)
  })

  it('подавляет ввод и коррекцию в disabled', () => {
    const onChange = vi.fn()
    const props: SliderProps = { label: 'Объём', min: 0, max: 10, value: 12, onChange }
    const { rerender } = renderK(<Slider {...props} disabled />)
    expect(slider()).toBeDisabled()
    expect(slider()).toHaveValue('10')
    fireEvent.change(slider(), { target: { value: '4' } })
    expect(onChange).not.toHaveBeenCalled()
    rerender(<Slider {...props} />)
    expect(onChange).toHaveBeenCalledExactlyOnceWith(10)
  })
})
