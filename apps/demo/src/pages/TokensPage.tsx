import { colors, sizes } from '@katran/tokens'
import { Button, Input } from '@katran/ui'
import s from './Page.module.css'

// Контраст к paper считается прямо здесь, чтобы страница не зависела от внутренностей пакета токенов
const lum = (hex: string) => {
  const [r, g, b] = hex.replace('#', '').match(/.{2}/g)!.map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => { const x = lum(a), y = lum(b); return ((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2) }

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
                <div className={s.swatchMeta}>--k-{name}<br />{hex} · {ratio(hex, colors[theme].paper)}</div>
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
