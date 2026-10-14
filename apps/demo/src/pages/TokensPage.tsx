import styled from 'styled-components'
import { colors, contrastRatio, k, sizes } from '@katran/tokens'
import { Button, Input } from '@katran/ui'
import { H1, H2, Note, Row } from './parts'

const Swatches = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${k.swatch}, 1fr));
  gap: ${k.sp2};
`

const Swatch = styled.div`
  border: 1px solid ${k.line};
  border-radius: ${k.rM};
  overflow: hidden;
  background: ${k.paper};
`

const SwatchColor = styled.div`
  height: ${k.sp8};
`

const SwatchMeta = styled.div`
  padding: ${k.sp1} ${k.sp2};
  font: 400 ${k.fs3} / ${k.lh3} ${k.mono};
  color: ${k.ink2};
`

/* Кегли — рамка примеров сеткой: группа определена позже Row и перебивает её display (прежние .row.type) */
const TypeRow = styled(Row)`
  display: grid;
  gap: ${k.sp1};
`

export function TokensPage() {
  return (
    <>
      <H1>Токены</H1>
      <Note>Единственный источник — <code>tokens.src.ts</code>. Размеры умножены на плотность: переключите её в шапке — все контролы ниже изменятся, координаты останутся честными.</Note>

      {(['light', 'dark'] as const).map((theme) => (
        <section key={theme} data-theme={theme}>
          <H2>Палитра — {theme === 'light' ? 'светлая' : 'тёмная'} (контраст к paper)</H2>
          <Swatches>
            {Object.entries(colors[theme]).map(([name, hex]) => (
              <Swatch key={name}>
                <SwatchColor style={{ background: hex }} />
                <SwatchMeta>--k-{name}<br />{hex} · {contrastRatio(hex, colors[theme].paper).toFixed(2)}</SwatchMeta>
              </Swatch>
            ))}
          </Swatches>
        </section>
      ))}

      <H2>Кегли</H2>
      <TypeRow>
        {(['fs-h1', 'fs-1', 'fs-2', 'fs-3'] as const).map((k) => (
          <div key={k} style={{ fontSize: `var(--k-${k})` }}>--k-{k} · {sizes[k]} px · Платёжная инструкция MT202</div>
        ))}
      </TypeRow>

      <H2>Плотность</H2>
      <Row>
        <Button size="s">24</Button><Button>28</Button><Button size="l">32</Button>
        <Input size="m" placeholder="Поле 28" />
      </Row>
    </>
  )
}
