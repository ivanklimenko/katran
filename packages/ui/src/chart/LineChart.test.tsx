import { screen, within } from '@testing-library/react'
import { LineChart, type ChartSeries } from '../index'
import { renderK } from '../test/renderK'

const chart = () => screen.getByRole('img', { name: 'Платежи' })
const points = (values: (number | null)[]) => values.map((y, i) => ({ x: String(i + 1), y }))

describe('LineChart', () => {
  it('даёт видимое и доступное сообщение для пустого графика', () => {
    renderK(<LineChart label="Платежи" series={[]} />)
    expect(chart()).toHaveAccessibleDescription('Нет данных')
    expect(within(chart()).getByText('Нет данных')).toBeVisible()
    expect(chart().querySelector('polyline, circle')).toBeNull()
  })

  it('описывает ряд, если все его значения пропущены или неконечны', () => {
    renderK(<LineChart label="Платежи" series={[{ id: 'a', label: 'Пустой ряд', points: points([null, NaN, Infinity]) }]} />)
    expect(chart()).toHaveAccessibleDescription('Пустой ряд: Нет данных.')
    expect(chart().querySelector('polyline, circle')).toBeNull()
  })

  it('рисует два ряда на общей шкале и продлевает палитру по кругу', () => {
    const series: ChartSeries[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(i), label: 'Ряд ' + i, points: points(i < 2 ? [i * 5, i * 5 + 5] : []),
    }))
    renderK(<LineChart label="Платежи" series={series} />)
    expect(chart().querySelectorAll('polyline')).toHaveLength(2)
    expect(chart()).toHaveAccessibleDescription(/Ряд 0: минимум 0, максимум 5\. Ряд 1: минимум 5, максимум 10\./)
    const legend = within(chart()).getByText('Ряд 4')
    expect(legend).toHaveAttribute('data-series-tone', 'val')
    expect(chart().querySelector('polyline')?.getAttribute('points')).not.toEqual(chart().querySelectorAll('polyline')[1]?.getAttribute('points'))
  })

  it('собирает категории по первому появлению и привязывает точки по x', () => {
    renderK(<LineChart label="Платежи" series={[
      { id: 'a', label: 'Первый', points: [{ x: 'ср', y: 0 }, { x: 'пн', y: 10 }, { x: 'пн', y: 99 }] },
      { id: 'b', label: 'Второй', points: [{ x: 'пн', y: 20 }, { x: 'ср', y: 5 }, { x: 'пт', y: 30 }] },
    ]} />)
    const labels = within(chart()).getByRole('list', { name: 'Категории' })
    expect(within(labels).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['ср', 'пн', 'пт'])
    const lines = chart().querySelectorAll('polyline')
    expect(lines[1]?.getAttribute('points')?.split(' ')).toHaveLength(3)
    expect(chart()).toHaveAccessibleDescription(/Первый: минимум 0, максимум 10\. Второй: минимум 5, максимум 30\./)
  })

  it('разрывает линии на null, неконечном числе и отсутствующей категории', () => {
    const all = points([0, 1, 2, 3, 4, 5, 6, 7, 8])
    renderK(<LineChart label="Платежи" series={[
      { id: 'a', label: 'Категории', points: all.map(({ x }) => ({ x, y: null })) },
      { id: 'b', label: 'Разрывы', points: points([1, 2, null, 3, 4, -Infinity, 5, 6, 7]).filter(({ x }) => x !== '8') },
    ]} />)
    expect([...chart().querySelectorAll('polyline')].map((line) => line.getAttribute('points')?.split(' ').length)).toEqual([2, 2])
    expect(chart().querySelectorAll('circle')).toHaveLength(2)
  })

  it('показывает одиночную точку на середине и плоский ряд по центру', () => {
    const { rerender } = renderK(<LineChart label="Платежи" series={[{ id: 'a', label: 'Один', points: points([4]) }]} />)
    expect(chart().querySelector('circle')).toHaveAttribute('cx', '50%')
    expect(chart().querySelector('circle')).toHaveAttribute('cy', '50%')
    rerender(<LineChart label="Платежи" series={[{ id: 'a', label: 'Ровный', points: points([4, 4]) }]} />)
    expect(chart().querySelector('polyline')).toHaveAttribute('points', '25,50 75,50')
  })

  it('поддерживает противоположные конечные экстремумы и сдвиг высоты', () => {
    const series = [{ id: 'a', label: 'Крайние числа', points: points([-Number.MAX_VALUE, Number.MAX_VALUE]) }]
    const { rerender } = renderK(<LineChart label="Платежи" series={series} className="report" height={180} />)
    const root = chart().parentElement!
    expect(root).toHaveClass('report')
    expect(root.style.getPropertyValue('--k-chart-h')).toBe('180px')
    expect(chart().querySelector('polyline')).toHaveAttribute('points', '25,92 75,8')
    rerender(<LineChart label="Платежи" series={series} height={NaN} />)
    expect(root.style.getPropertyValue('--k-chart-h')).toBe('')
  })
})
