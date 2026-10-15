import { act, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { styled, ThemeProvider, useTheme } from '../styled'
import { k } from '@katran/tokens'
import { KatranProvider } from './KatranProvider'
import { useKatran } from './useKatran'

// Тема хоста так, как её типизирует хост: своё дополнение DefaultTheme. Ключ katran кита необязательный,
// поэтому тема хоста без katran проходит проверку типов (литерал { host: 'h' } ниже — без приведения)
declare module 'styled-components' {
  interface DefaultTheme {
    host?: string
  }
}

// Компонент «как у кита»: определён после корня провайдера (импорт выше) — его группа стилей позже
const Piece = styled.span`
  box-sizing: border-box;
`

/** Текст всех листов styled-components документа (в тестах — текстовые узлы, без CSSOM). */
const sheet = () => [...document.querySelectorAll('style[data-styled]')].map((n) => n.textContent ?? '').join('\n')

/** Правила листа: селектор (с префиксом @media, если правило внутри него) и тело. */
function rules() {
  const out: { media: string; selector: string; body: string; at: number }[] = []
  const text = sheet()
  const re = /(@media[^{]+)\{|([^{}]+)\{([^{}]*)\}|\}/g
  let media = ''
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m[1]) media = m[1].trim()
    else if (m[2] !== undefined) out.push({ media, selector: m[2].trim(), body: m[3] ?? '', at: m.index })
    else media = ''
  }
  return out
}

/** Класс корня, которым styled-components адресует его правила. */
function rootClass(root: Element) {
  const text = sheet()
  const cls = [...root.classList].find((c) => text.includes(`.${c}{`) || text.includes(`.${c},`))
  if (!cls) throw new Error('у корня нет класса со стилями')
  return cls
}

function Probe() {
  const k = useKatran()
  return (
    <div>
      <span data-testid="t">{k.theme}</span>
      <span data-testid="d">{k.density}</span>
      <button onClick={() => k.setTheme('dark')}>тёмная</button>
      <button onClick={() => k.setDensity(1.25)}>крупнее</button>
      <button onClick={() => k.announce('Скопировано')}>объявить</button>
    </div>
  )
}

/** Тема styled-components глазами кода приложения внутри провайдера. */
function ThemeProbe() {
  const theme = useTheme()
  return (
    <>
      <output data-testid="theme">{JSON.stringify(theme)}</output>
      <output data-testid="same">{String(theme.katran === k)}</output>
    </>
  )
}

describe('KatranProvider', () => {
  beforeEach(() => localStorage.clear())

  it('по умолчанию system и плотность 1; корень несёт переменную плотности', () => {
    const { container } = render(<KatranProvider><Probe /></KatranProvider>)
    expect(screen.getByTestId('t')).toHaveTextContent('system')
    expect(screen.getByTestId('d')).toHaveTextContent('1')
    const root = container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue('--k-density')).toBe('1')
    expect(root).not.toHaveAttribute('data-theme')
    expect(root).toHaveAttribute('data-k-root')
  })

  it('setTheme / setDensity меняют атрибуты и сохраняются по storageKey', () => {
    const { container } = render(<KatranProvider storageKey="t"><Probe /></KatranProvider>)
    act(() => screen.getByText('тёмная').click())
    act(() => screen.getByText('крупнее').click())
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveAttribute('data-theme', 'dark')
    expect(root.style.getPropertyValue('--k-density')).toBe('1.25')
    expect(localStorage.getItem('t:theme')).toBe('dark')
    expect(localStorage.getItem('t:density')).toBe('1.25')
  })

  it('читает сохранённое при монтировании', () => {
    localStorage.setItem('t:density', '1.1')
    render(<KatranProvider storageKey="t"><Probe /></KatranProvider>)
    expect(screen.getByTestId('d')).toHaveTextContent('1.1')
  })

  it('управляемый режим: props важнее внутреннего состояния', () => {
    const { container } = render(<KatranProvider theme="light" density={1.1}><Probe /></KatranProvider>)
    act(() => screen.getByText('тёмная').click())
    expect(container.firstElementChild).toHaveAttribute('data-theme', 'light')
  })

  it('announce пишет в живую область', async () => {
    render(<KatranProvider><Probe /></KatranProvider>)
    await act(async () => {
      screen.getByText('объявить').click()
      await new Promise((r) => requestAnimationFrame(r))
    })
    expect(screen.getByRole('status')).toHaveTextContent('Скопировано')
  })

  it('корень объявляет светлую палитру, тёмную — по data-theme="dark" на корне и на потомках', () => {
    const { container } = render(<KatranProvider><Probe /></KatranProvider>)
    const c = rootClass(container.firstElementChild as Element)
    const light = rules().filter((r) => !r.media && r.body.includes('--k-paper:#FFFFFF'))
    const dark = rules().filter((r) => !r.media && r.body.includes('--k-paper:#161B26'))
    expect(light.map((r) => r.selector)).toContain(`.${c},.${c}[data-theme='light'],.${c} [data-theme='light']`)
    expect(dark.map((r) => r.selector)).toContain(`.${c}[data-theme='dark'],.${c} [data-theme='dark']`)
  })

  it('корень объявляет базу и размеры с плотностью — var(--k-density) резолвится на корне', () => {
    const { container } = render(<KatranProvider><Probe /></KatranProvider>)
    const c = rootClass(container.firstElementChild as Element)
    const own = rules().filter((r) => !r.media && r.selector === `.${c}`).map((r) => r.body).join('')
    expect(own).toContain('--k-density:1;')
    expect(own).toContain('--k-sp-1:calc(4px * var(--k-density));')
    expect(own).toContain('--k-z-modal:150;')
  })

  it('системная тема: тёмная палитра под prefers-color-scheme — на корне без data-theme="light", потомок с light остаётся светлым', () => {
    const { container } = render(<KatranProvider><Probe /></KatranProvider>)
    const c = rootClass(container.firstElementChild as Element)
    const sys = rules().filter((r) => r.media.includes('prefers-color-scheme:dark'))
    // правило на корне, а не на :root; потомки без data-theme наследуют его значения
    expect(sys.map((r) => r.selector)).toEqual([`.${c}:not([data-theme='light'])`])
    expect(sys[0]?.body).toContain('--k-paper:#161B26')
    // потомок с data-theme="light" получает светлую палитру собственным объявлением, а не наследованием
    const light = rules().find((r) => !r.media && r.body.includes('--k-paper:#FFFFFF'))
    expect(light?.selector.split(',')).toContain(`.${c} [data-theme='light']`)
  })

  it('изоляция от хоста — в шаблоне корня: content-box под корнем, border-box контролов, типографика контролов', () => {
    const { container } = render(<KatranProvider><Probe /></KatranProvider>)
    const root = container.firstElementChild as Element
    const c = rootClass(root)
    // классов CSS Modules на корне нет: все классы корня — styled-components (sc-… и класс стилей)
    expect([...root.classList].every((x) => x.startsWith('sc-') || sheet().includes(`.${x}`))).toBe(true)
    const all = rules().filter((r) => !r.media)
    const at = (selector: string) => all.find((r) => r.selector === selector)
    // специфичность (0,1,0) перебивает `*` хоста; псевдоэлементы — отдельными селекторами
    expect(at(`.${c},.${c} *,.${c} *::before,.${c} *::after`)?.body).toBe('box-sizing:content-box;')
    const controls = `:where(button,select,input[type='checkbox'],input[type='radio'],input[type='button'],input[type='submit'],input[type='reset'])`
    expect(at(`.${c} ${controls}`)?.body).toBe('box-sizing:border-box;')
    // stylis добавляет к letter-spacing вендорные префиксы — проверяются сами объявления
    const typo = at(`.${c} :where(button,input,select,textarea)`)?.body
    expect(typo).toMatch(/^text-transform:none;/)
    expect(typo).toMatch(/(^|;)letter-spacing:normal;$/)
  })

  it('сброс изоляции стоит в листе раньше правил компонентов: при равной специфичности (0,1,0) компоненты его перебивают', () => {
    const { container } = render(<KatranProvider><Piece>часть</Piece></KatranProvider>)
    const c = rootClass(container.firstElementChild as Element)
    const piece = rootClass(screen.getByText('часть'))
    const all = rules()
    const reset = all.find((r) => r.selector.startsWith(`.${c},.${c} *`))
    const own = all.find((r) => r.selector === `.${piece}`)
    // border-box у Piece — после content-box корня: в браузере у части будет border-box
    expect(reset && own && reset.at < own.at).toBe(true)
    expect(own?.body).toBe('box-sizing:border-box;')
  })

  it('живая область скрыта визуально и помечена data-part="live"', () => {
    const { container } = render(<KatranProvider><Probe /></KatranProvider>)
    const c = rootClass(container.firstElementChild as Element)
    expect(screen.getByRole('status')).toHaveAttribute('data-part', 'live')
    expect(rules().find((r) => r.selector === `.${c} > [data-part='live']`)?.body).toContain('clip-path:inset(50%)')
  })

  it('правила корня стоят в листе раньше правил компонентов, определённых позже (порядок групп)', () => {
    const { container } = render(<KatranProvider><Piece>часть</Piece></KatranProvider>)
    const c = rootClass(container.firstElementChild as Element)
    const piece = rootClass(screen.getByText('часть'))
    const all = rules()
    const root = all.find((r) => r.selector === `.${c}`)
    const own = all.find((r) => r.selector === `.${piece}`)
    expect(root && own && root.at < own.at).toBe(true)
  })

  it('тема хоста сохраняется, токены кита — под ключом katran', () => {
    render(<ThemeProvider theme={{ host: 'h' }}><KatranProvider><ThemeProbe /></KatranProvider></ThemeProvider>)
    expect(JSON.parse(screen.getByTestId('theme').textContent ?? '')).toEqual({ host: 'h', katran: k })
    expect(screen.getByTestId('same')).toHaveTextContent('true')
  })

  it('без темы хоста useTheme().katran — объект токенов k', () => {
    render(<KatranProvider><ThemeProbe /></KatranProvider>)
    expect(JSON.parse(screen.getByTestId('theme').textContent ?? '')).toEqual({ katran: k })
    expect(screen.getByTestId('same')).toHaveTextContent('true')
  })

  it('без нарушений axe', async () => {
    const { container } = render(<KatranProvider><Probe /></KatranProvider>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
