import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { KatranProvider } from '@katran/ui'

/** Рендер под провайдером кита — как renderK в packages/ui. Корень контейнера — провайдер, искать по ролям. */
export const renderK = (ui: ReactElement, o?: RenderOptions): RenderResult =>
  render(ui, { wrapper: ({ children }) => <KatranProvider>{children}</KatranProvider>, ...o })
