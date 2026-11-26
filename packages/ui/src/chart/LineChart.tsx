import type { CSSProperties } from 'react'
import { k } from '@katran/tokens'
import { useStableId } from '../compat/useStableId'
import { Sr } from '../form/parts'
import { styled } from '../styled'

export type ChartPoint = { x: string; y: number | null }
export type ChartSeries = { id: string; label: string; points: ChartPoint[] }
export type LineChartProps = {
  label: string
  series: ChartSeries[]
  /** Высота области графика в CSS-пикселях. */
  height?: number | undefined
  className?: string | undefined
}

const seriesTones = ['val', 'ok', 'warn', 'opt'] as const
const top = 8
const bottom = 92
const emptyText = 'Нет данных'

const Root = styled.div`
  width: 100%;
  min-width: 0;

  & [data-series-tone='val'] { color: ${k.val}; }
  & [data-series-tone='ok'] { color: ${k.ok}; }
  & [data-series-tone='warn'] { color: ${k.warn}; }
  & [data-series-tone='opt'] { color: ${k.opt}; }
`

const Axes = styled.div`
  display: grid;
  grid-template-columns: fit-content(35%) minmax(0, 1fr);
  direction: ltr;
  column-gap: ${k.sp2};
  color: ${k.muted};
  font: ${k.fs3} / ${k.lh3} ${k.sans};
`

const YLabels = styled.div`
  display: grid;
  grid-template-rows: 16% 1fr 16%;
  align-items: center;
  text-align: right;
  min-width: 0;
  font-variant-numeric: tabular-nums;

  & > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  & [data-middle] {
    grid-row: 2;
  }
`

const Categories = styled.ul`
  grid-column: 2;
  display: flex;
  padding: 0;
  margin: 0;
  list-style: none;

  & > li {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const Plot = styled.svg`
  display: block;
  width: 100%;
  height: var(--k-chart-h, ${k.side});

  & line {
    stroke: ${k.line};
  }

  & line[data-axis] {
    stroke: ${k.muted};
  }

  & polyline {
    fill: none;
    stroke: currentcolor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  & circle {
    r: ${k.sp1};
    fill: currentcolor;
  }
`

const Empty = styled.div`
  display: grid;
  place-items: center;
  height: var(--k-chart-h, ${k.side});
  color: ${k.muted};
`

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${k.sp1} ${k.sp3};
  margin-top: ${k.sp2};
  overflow-wrap: anywhere;
  font: ${k.fs3} / ${k.lh3} ${k.sans};

  & > span {
    min-width: 0;
  }
`

type Coordinate = { x: number; y: number }

function chartLayout(series: ChartSeries[]) {
  const categorySet = new Set<string>()
  let min = Infinity
  let max = -Infinity

  const rows = series.map(({ id, label, points }, index) => {
    const values = new Map<string, number | null>()
    let low = Infinity
    let high = -Infinity
    for (const { x, y } of points) {
      if (values.has(x)) continue
      categorySet.add(x)
      const finite = y !== null && Number.isFinite(y) ? y : null
      values.set(x, finite)
      if (finite === null) continue
      low = Math.min(low, finite)
      high = Math.max(high, finite)
    }
    min = Math.min(min, low)
    max = Math.max(max, high)
    return { id, label, low, high, values, tone: seriesTones[index % seriesTones.length]! }
  })

  const categories = Array.from(categorySet)
  // Разность противоположных конечных экстремумов может переполнить Number.
  const divisor = Number.isFinite(max - min) ? 1 : 2
  const span = max / divisor - min / divisor
  const lines = rows.map(({ values, ...row }) => {
    const segments: Coordinate[][] = []
    let segment: Coordinate[] | undefined
    categories.forEach((category, index) => {
      const value = values.get(category)
      if (value == null) {
        segment = undefined
        return
      }
      if (segment === undefined) {
        segment = []
        segments.push(segment)
      }
      segment.push({
        x: (index + 0.5) / categories.length * 100,
        y: span === 0 ? 50 : bottom - (value / divisor - min / divisor) / span * (bottom - top),
      })
    })
    return { ...row, segments }
  })

  return { categories, lines, min, max }
}

export function LineChart({ label, series, height, className }: LineChartProps) {
  const descriptionId = useStableId()
  const { categories, lines, min, max } = chartLayout(series)
  const style: (CSSProperties & { '--k-chart-h': string }) | undefined =
    height !== undefined && Number.isFinite(height) && height > 0 ? { '--k-chart-h': height + 'px' } : undefined
  const description = lines.map(({ label: name, low, high }) =>
    low > high ? name + ': ' + emptyText + '.' : name + ': минимум ' + low + ', максимум ' + high + '.',
  ).join(' ') || emptyText

  return (
    <Root className={className} style={style}>
      <div role="img" aria-label={label} aria-describedby={descriptionId}>
        {min > max ? <Empty>{emptyText}</Empty> : (
          <Axes>
            <YLabels aria-hidden="true">
              {min === max ? <span data-middle="" title={String(min)}>{min}</span> : <>
                <span title={String(max)}>{max}</span><span data-middle="" /><span title={String(min)}>{min}</span>
              </>}
            </YLabels>
            <Plot aria-hidden="true">
              <line x1="0" x2="100%" y1={top + '%'} y2={top + '%'} />
              <line x1="0" x2="100%" y1="50%" y2="50%" />
              <line x1="0" x2="100%" y1={bottom + '%'} y2={bottom + '%'} data-axis="" />
              <line x1="0" x2="0" y1={top + '%'} y2={bottom + '%'} data-axis="" />
              <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                {lines.map(({ id, tone, segments }) => (
                  <g key={id} data-series-tone={tone}>
                    {segments.filter((segment) => segment.length > 1).map((segment) => (
                      <polyline key={segment[0]!.x} vectorEffect="non-scaling-stroke"
                        points={segment.map(({ x, y }) => x + ',' + y).join(' ')} />
                    ))}
                  </g>
                ))}
              </svg>
              {lines.map(({ id, tone, segments }) => (
                <g key={id} data-series-tone={tone}>
                  {segments.filter((segment) => segment.length === 1).map(([point]) => (
                    <circle key={point!.x} cx={point!.x + '%'} cy={point!.y + '%'} />
                  ))}
                </g>
              ))}
            </Plot>
            <Categories aria-label="Категории">
              {categories.map((category) => <li key={category} dir="auto" title={category}>{category}</li>)}
            </Categories>
          </Axes>
        )}
        {lines.length > 0 && (
          <Legend>
            {lines.map(({ id, label: name, tone }) => <span key={id} data-series-tone={tone}>{name}</span>)}
          </Legend>
        )}
      </div>
      <Sr id={descriptionId} aria-hidden="true">{description}</Sr>
    </Root>
  )
}
