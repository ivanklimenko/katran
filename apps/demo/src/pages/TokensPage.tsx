import { colors, contrastRatio, sizes } from '@katran/tokens'
import { Button, Input } from '@katran/ui'
import s from './Page.module.css'

export function TokensPage() {
  return (
    <>
      <h1 className={s.h1}>Токены</h1>
      <p className={s.note}>Единственный источник — <code>tokens.src.ts</code>. Размеры умножены на плотность: переключите её в шапке — все контролы ниже изменятся, координаты останутся честными.</p>

      {(['light', 'dark'] as const).map((theme) => (
        <section key={theme} data-theme={theme}>
          <h2 className={s.h2}>Палитра — {theme === 'light' ? 'светлая' : 'тёмная'} (контраст к paper)</h2>
          <div className={s.swatches}>
            {Object.entries(colors[theme]).map(([name, hex]) => (
              <div key={name} className={s.swatch}>
                <div className={s.swatchColor} style={{ background: hex }} />
                <div className={s.swatchMeta}>--k-{name}<br />{hex} · {contrastRatio(hex, colors[theme].paper).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <h2 className={s.h2}>Кегли</h2>
      <div className={[s.row, s.type].join(' ')}>
        {(['fs-h1', 'fs-1', 'fs-2', 'fs-3'] as const).map((k) => (
          <div key={k} style={{ fontSize: `var(--k-${k})` }}>--k-{k} · {sizes[k]} px · Платёжная инструкция MT202</div>
        ))}
      </div>

      <h2 className={s.h2}>Плотность</h2>
      <div className={s.row}>
        <Button size="s">24</Button><Button>28</Button><Button size="l">32</Button>
        <Input size="m" placeholder="Поле 28" />
      </div>
    </>
  )
}
