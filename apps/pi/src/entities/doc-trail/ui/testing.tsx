import { screen, type RenderResult } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { vi, type Mock } from 'vitest'
import type { TabContext } from '../../../shared/lib/detail'
import { renderK } from '../../../shared/lib/test'

export type CtxSpies = {
  openDocument: Mock<(id: string) => void>
  announce: Mock<(message: string) => void>
  setExpanded: Mock<(keys: string[]) => void>
}

/** id открытого документа в контексте вкладки (TabContext.docId). */
export const TEST_DOC_ID = '03e8b84b-d1c5-4f07-aa49-8be3e9e4c8e8'

function Stateful({ spies, init, view }: { spies: CtxSpies; init: string[] | null; view: (ctx: TabContext) => ReactNode }) {
  const [expanded, setState] = useState<string[] | null>(init)
  const ctx: TabContext = {
    docId: TEST_DOC_ID,
    openDocument: spies.openDocument,
    announce: spies.announce,
    expanded,
    setExpanded: (keys) => { spies.setExpanded(keys); setState(keys) },
  }
  return <>{view(ctx)}</>
}

/** Вкладка под провайдером кита: контекст со шпионами и живым раскрытием (как $expanded виджета, Task 11). */
export function renderTab(view: (ctx: TabContext) => ReactNode, init: string[] | null = null): RenderResult & { spies: CtxSpies } {
  const spies: CtxSpies = {
    openDocument: vi.fn<(id: string) => void>(),
    announce: vi.fn<(message: string) => void>(),
    setExpanded: vi.fn<(keys: string[]) => void>(),
  }
  const result = renderK(<Stateful spies={spies} init={init} view={view} />)
  return { ...result, spies }
}

/** Текст есть в документе и не внутри скрытой панели (свёрнутое тело строки или аккордеона). */
export const shown = (text: string | RegExp): boolean => {
  const el = screen.queryByText(text)
  return el !== null && el.closest('[hidden]') === null
}

/** Переключатели раскрываемых строк MiniTable (кнопка-шеврон в последней ячейке), по порядку строк. */
export const toggles = (): HTMLElement[] => screen.getAllByRole('button', { name: /^(Раскрыть|Свернуть)/ })
