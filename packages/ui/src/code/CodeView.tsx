import { useMemo, type CSSProperties } from 'react'
import { tokenizeJson } from './json'
import { tokenizeSwift } from './swift'
import { layoutXml } from './xml'
import type { CodeLine, CodeToken } from './types'
import s from './CodeView.module.css'

export type CodeLanguage = 'json' | 'xml' | 'swift' | 'text'
export type CodeViewProps = {
  code: string
  language: CodeLanguage
  /** Доступное имя области: «ED244 · XML», «audit · commonSection». */
  label: string
}

// Роль выражением: jsx-a11y (no-noninteractive-tabindex) не считает region интерактивным, а прокручиваемая
// область обязана быть доступна с клавиатуры (WCAG 2.1.1, axe scrollable-region-focusable) — фокус нужен ради прокрутки стрелками.
const REGION = 'region'

// Класс подсветки по виду куска; неизвестный вид — без подсветки
const KIND: Record<string, string | undefined> = {
  key: s.key, str: s.str, num: s.num, lit: s.lit, punct: s.punct,
  blk: s.blk, tag: s.tag, uetr: s.uetr,
  xp: s.xp, xt: s.xt, xns: s.xns, xa: s.xa, xans: s.xans, xv: s.xv, xx: s.xx,
}

// Только React-элементы: текст бека попадает в DOM текстовыми узлами, разметка в нём не исполняется
const tokens = (list: CodeToken[]) => list.map((t, i) => {
  const cls = KIND[t.kind]
  return cls === undefined ? t.text : <span key={i} className={cls}>{t.text}</span>
})

const rawLines = (code: string): CodeLine[] => code.split('\n').map((text) => ({ depth: 0, tokens: [{ kind: '', text }] }))

/**
 * Просмотр кода вкладок деталки (спека 2b §2, эталон pre.sw / .sw.xml, index.html:347–361; jsonHtml, swiftHtml, xmlHtml).
 * JSON и SWIFT — подсветка в pre; XML — строки с отступом по глубине и номером строки CSS-счётчиком
 * (номера не попадают в текст: копирование и скринридер их не видят); битый XML — сырой текст по строкам.
 */
export function CodeView({ code, language, label }: CodeViewProps) {
  const body = useMemo(() => {
    if (language === 'xml') {
      const lines = layoutXml(code) ?? rawLines(code)
      return (
        <div className={s.xml}>
          {lines.map((l, i) => (
            <div key={i} className={s.xl} style={{ '--k-d': String(l.depth), '--k-a': String(l.align ?? 0) } as CSSProperties}>
              {tokens(l.tokens)}
            </div>
          ))}
        </div>
      )
    }
    const list = language === 'json' ? tokenizeJson(code) : language === 'swift' ? tokenizeSwift(code) : [{ kind: '', text: code }]
    return <pre className={s.pre}>{tokens(list)}</pre>
  }, [code, language])
  return (
    <div role={REGION} aria-label={label} tabIndex={0} className={s.code} data-lang={language}>
      {body}
    </div>
  )
}
