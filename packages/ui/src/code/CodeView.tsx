import { useMemo, type CSSProperties } from 'react'
import { tokenizeJson } from './json'
import { tokenizeSwift } from './swift'
import { layoutXml } from './xml'
import { k } from '@katran/tokens'
import { styled } from '../styled'
import type { CodeLine, CodeToken } from './types'

export type CodeLanguage = 'json' | 'xml' | 'swift' | 'text'
export type CodeViewProps = {
  code: string
  language: CodeLanguage
  /** Доступное имя области: «ED244 · XML», «audit · commonSection». */
  label: string
  className?: string | undefined
}

// Роль выражением: jsx-a11y (no-noninteractive-tabindex) не считает region интерактивным, а прокручиваемая
// область обязана быть доступна с клавиатуры (WCAG 2.1.1, axe scrollable-region-focusable) — фокус нужен ради прокрутки стрелками.
const REGION = 'region'

// Виды кусков с подсветкой; неизвестный вид — без подсветки
const KINDS = new Set(['key', 'str', 'num', 'lit', 'punct', 'blk', 'tag', 'uetr', 'xp', 'xt', 'xns', 'xa', 'xans', 'xv', 'xx'])

// Только React-элементы: текст бека попадает в DOM текстовыми узлами, разметка в нём не исполняется.
// Кусок — обычный span с видом в data-tok (прежде класс вида): правила — в шаблоне Code под :where(), специфичность (0,1,0)
const tokens = (list: CodeToken[]) => list.map((t, i) =>
  KINDS.has(t.kind) ? <span key={i} data-tok={t.kind}>{t.text}</span> : t.text)

/* просмотр кода (спека 2b §2, эталон pre.sw / .sw.xml, index.html:347–361): моно 11.5 / 1.45 на фоне sunk */
const Code = styled.div`
  box-sizing: border-box;
  overflow: auto;
  background: ${k.sunk};
  font: ${k.fsPre} / 1.45 ${k.mono};
  color: ${k.ink2};

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: -2px;
  }

  /* JSON (эталон .au pre .k/.s/.num/.nul); пунктуация — цветом текста */
  & :where([data-tok='punct']) {
    color: ${k.ink2};
  }

  & :where([data-tok='key']) {
    color: ${k.bad};
  }

  & :where([data-tok='str']) {
    color: ${k.ok};
  }

  & :where([data-tok='num']) {
    color: ${k.val};
  }

  & :where([data-tok='lit']) {
    color: ${k.muted};
  }

  /* SWIFT (эталон .sw .blk/.tag4/.uetr) */
  & :where([data-tok='blk']) {
    color: ${k.muted};
  }

  & :where([data-tok='tag']) {
    font-weight: 600;
    color: ${k.bad};
  }

  & :where([data-tok='uetr']) {
    color: ${k.val};
  }

  /* XML */
  & :where([data-tok='xp']) {
    color: ${k.faint};
  }

  & :where([data-tok='xt']) {
    font-weight: 600;
    color: ${k.ink};
  }

  & :where([data-tok='xns']) {
    color: ${k.muted};
  }

  & :where([data-tok='xa']) {
    color: ${k.muted};
  }

  & :where([data-tok='xans']) {
    color: ${k.faint};
  }

  & :where([data-tok='xv']) {
    color: ${k.val};
  }

  & :where([data-tok='xx']) {
    color: ${k.ink};
  }
`

const Pre = styled.pre`
  margin: 0;
  padding: ${k.codePt} ${k.codePx} ${k.sp2} ${k.codePl};
  font: inherit;
  white-space: pre-wrap;
  word-break: break-all;
`

/* XML: строка — блок с отступом по глубине (--k-d) и выравниванием атрибута (--k-a) в ch;
   перенос длинной строки уходит под начало её содержимого (висячий отступ 2ch), номер строки — в поле слева */
const Xml = styled.div`
  padding: ${k.codePt} ${k.codePx} ${k.sp2} 0;
  counter-reset: xl;
`

const XmlLine = styled.div`
  position: relative;
  padding-left: calc(${k.codeGutter} + var(--k-d, 0) * 2ch + var(--k-a, 0) * 1ch + 2ch);
  overflow-wrap: anywhere;
  text-indent: -2ch;
  white-space: pre-wrap;
  counter-increment: xl;

  &::before {
    content: counter(xl);
    position: absolute;
    left: 0;
    width: ${k.codeNum};
    font-size: ${k.fs3};
    color: ${k.faint};
    text-align: right;
    text-indent: 0;
    user-select: none;
  }

  &:hover {
    background: ${k.hover};
  }
`

const rawLines = (code: string): CodeLine[] => code.split(/\r?\n/).map((text) => ({ depth: 0, tokens: [{ kind: '', text }] }))

// Разбор недоверенного текста бека не должен ронять рендер (в React 17 исключение без границы ошибок размонтирует корень):
// любое исключение разборщика — например, переполнение стека на враждебно глубоком XML — откат на сырой текст, как у битого XML
const safely = <T,>(parse: () => T, fallback: () => T): T => {
  try {
    return parse()
  } catch {
    return fallback()
  }
}

/**
 * Просмотр кода вкладок деталки (спека 2b §2, эталон pre.sw / .sw.xml, index.html:347–361; jsonHtml, swiftHtml, xmlHtml).
 * JSON и SWIFT — подсветка в pre; XML — строки с отступом по глубине и номером строки CSS-счётчиком
 * (номера не попадают в текст: копирование и скринридер их не видят); битый XML и сбой разборщика — сырой текст.
 */
export function CodeView({ code, language, label, className }: CodeViewProps) {
  const body = useMemo(() => {
    if (language === 'xml') {
      const lines = safely(() => layoutXml(code), () => null) ?? rawLines(code)
      return (
        <Xml>
          {lines.map((l, i) => (
            <XmlLine key={i} style={{ '--k-d': String(l.depth), '--k-a': String(l.align ?? 0) } as CSSProperties}>
              {tokens(l.tokens)}
            </XmlLine>
          ))}
        </Xml>
      )
    }
    const raw = (): CodeToken[] => [{ kind: '', text: code }]
    const list = language === 'json' ? safely(() => tokenizeJson(code), raw) : language === 'swift' ? safely(() => tokenizeSwift(code), raw) : raw()
    return <Pre>{tokens(list)}</Pre>
  }, [code, language])
  return (
    <Code role={REGION} aria-label={label} tabIndex={0} className={className} data-lang={language}>
      {body}
    </Code>
  )
}
