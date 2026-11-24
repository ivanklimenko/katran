import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import styled from 'styled-components'
import { k } from '@katran/tokens'
import { Drawer, type DrawerProps } from '@katran/ui'

const Events = styled.div`
  display: contents;
`

const Frame = styled(Drawer)`
  &[data-slot] {
    width: min(100vw, calc(${k.drawer} / 0.62));
  }

  & > [data-part='layout'] {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 38%);
    grid-template-rows: minmax(0, 1fr);
  }

  ${Events}[data-comparing] > &[data-slot] {
    width: min(${k.drawer}, 50vw);
  }

  ${Events}[data-comparing] > & > [data-part='layout'] {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 3fr) minmax(0, 2fr);
  }

  /* stylelint-disable-next-line unit-disallowed-list, media-feature-range-notation -- брейкпоинт окна в синтаксисе Chromium 88 */
  @media (max-width: 960px) {
    & > [data-part='layout'] {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 3fr) minmax(0, 2fr);
    }
  }
`

const Inspector = styled.section`
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-left: 1px solid ${k.line};
  border-top: 1px solid ${k.line};
  background: ${k.sunk};
`

const InspectorHead = styled.div`
  padding: ${k.sp2} ${k.dwPad};
  border-bottom: 1px solid ${k.line};
`

const Heading = styled.h3`
  margin: 0;
  font: 600 ${k.fs3} / ${k.lh3} ${k.sans};
`

const Paths = styled.div`
  display: grid;
  flex: none;
  max-height: 30%;
  overflow: auto;
  padding: ${k.sp1} ${k.sp2};
  border-bottom: 1px solid ${k.line};
  background: ${k.paper};
`

const Path = styled.button`
  padding: ${k.sp1};
  border: 0;
  border-radius: ${k.rS};
  background: transparent;
  color: ${k.val};
  font: ${k.fs2} / ${k.lh2} ${k.mono};
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: ${k.valSoft};
  }
`

const CodeScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
`

const Code = styled.pre`
  margin: 0;
  padding: ${k.sp2} 0;
  font: ${k.fs2} / ${k.lh2} ${k.mono};
  white-space: pre-wrap;
  overflow-wrap: anywhere;

  & > span {
    display: block;
    padding: 0 ${k.dwPad};
    border-left: 3px solid transparent;
  }

  & > [data-json-highlighted] {
    border-left-color: ${k.val};
    background: ${k.valSoft};
    color: ${k.ink};
  }
`

type JsonLine = { text: string; path?: string }

function indexJson(response: Record<string, unknown>) {
  const lines: JsonLine[] = []
  const indexes = new Map<string, number>()

  function visit(value: unknown, path: string, indent: string, prefix: string, comma: string) {
    const array = Array.isArray(value)
    const object = typeof value === 'object' && value !== null
    const start = array ? '[' : '{'
    const end = array ? ']' : '}'
    const entries = object ? Object.entries(value) : []
    indexes.set(path, lines.length)
    if (!entries.length) {
      const literal = object ? start + end : JSON.stringify(value)
      lines.push({ path, text: indent + prefix + literal + comma })
      return
    }
    lines.push({ path, text: indent + prefix + start })
    entries.forEach(([key, child], index) => {
      const quotedKey = JSON.stringify(key)
      const segment = /^[a-z_$][\w$]*$/i.test(key) ? `.${key}` : `[${quotedKey}]`
      visit(
        child,
        path + (array ? `[${key}]` : segment),
        indent + '  ',
        array ? '' : `${quotedKey}: `,
        index < entries.length - 1 ? ',' : '',
      )
    })
    lines.push({ text: indent + end + comma })
  }

  visit(response, '$', '', '', '')
  return { lines, indexes }
}

function JsonInspector({ response, tip, tools }: {
  response: Record<string, unknown> | undefined; tip: string; tools: ReactNode
}) {
  const { lines, indexes } = useMemo(() => response ? indexJson(response) : { lines: [], indexes: new Map<string, number>() }, [response])
  const matches = new Map<string, number>()
  for (const path of tip.split('\n')) {
    const index = indexes.get(path)
    if (index !== undefined) matches.set(path, index)
  }
  const viewport = useRef<HTMLDivElement>(null)
  const code = useRef<HTMLPreElement>(null)
  const first = matches.values().next().value
  useLayoutEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0
  }, [response])

  const scrollToLine = (index: number) => {
    const area = viewport.current
    const row = code.current?.children.item(index)
    if (area && row) {
      area.scrollTop += row.getBoundingClientRect().top - area.getBoundingClientRect().top - area.clientHeight / 3
    }
  }
  useLayoutEffect(() => {
    if (first !== undefined) scrollToLine(first)
  }, [first, indexes, tip])

  return (
    <Inspector aria-label="Исходный JSON">
      <InspectorHead>
        <Heading>Исходный JSON</Heading>
        {tools}
      </InspectorHead>
      {matches.size > 0 && (
        <Paths role="group" aria-label="Пути в JSON">
          {Array.from(matches, ([path, index]) => <Path key={path} type="button" onClick={() => scrollToLine(index)}>{path}</Path>)}
        </Paths>
      )}
      {response && <CodeScroll ref={viewport} tabIndex={0} role="group" aria-label="Ответ API">
        <Code ref={code}>
          {lines.map(({ text, path }, index) => (
            <span key={index} data-json-highlighted={path && matches.has(path) ? '' : undefined}>{text}</span>
          ))}
        </Code>
      </CodeScroll>}
    </Inspector>
  )
}

type MappingDrawerProps = DrawerProps & {
  response?: Record<string, unknown> | undefined
  comparing?: boolean | undefined
  tools?: ReactNode
}

export function MappingDrawer({ response, comparing, tools, ...drawer }: MappingDrawerProps) {
  const [hover, setHover] = useState<{ response: typeof response; tip: string } | null>(null)
  const follow = (target: EventTarget) => {
    const trigger = target instanceof Element ? target.closest<HTMLElement>('[data-k-tip]') : null
    if (!trigger) return
    // Тот же источник, который читает TooltipLayer. Обычные подсказки путей не содержат.
    const text = trigger.dataset.kTip ?? ''
    const tip = text.startsWith('$') ? text : ''
    setHover((previous) => previous?.response === response && previous?.tip === tip ? previous : { response, tip })
  }
  return (
    <Events data-comparing={comparing ? '' : undefined} onPointerOver={(e) => follow(e.target)} onFocus={(e) => follow(e.target)}>
      <Frame {...drawer} sidePanel={<JsonInspector response={response} tip={hover?.response === response ? hover?.tip ?? '' : ''} tools={tools} />} />
    </Events>
  )
}
