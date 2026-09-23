import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { KatranProvider } from '../provider'

export const renderK = (ui: ReactElement, o?: RenderOptions): RenderResult =>
  render(ui, { wrapper: ({ children }) => <KatranProvider>{children}</KatranProvider>, ...o })
