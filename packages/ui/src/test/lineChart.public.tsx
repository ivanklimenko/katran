import { LineChart, type ChartPoint, type ChartSeries, type LineChartProps } from '../index'

const point: ChartPoint = { x: 'Пн', y: 50 }
const series: ChartSeries = { id: 'payments', label: 'Платежи', points: [point, { x: 'Вт', y: null }] }
const props: LineChartProps = { label: 'За неделю', series: [series] }
export const lineChart = <LineChart {...props} />

// @ts-expect-error Значение точки — число или null.
export const invalidPoint: ChartPoint = { x: 'Ср', y: '50' }
