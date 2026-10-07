import type { ReactElement } from 'react'
import type { ActionIcon } from '../../../shared/lib/detail'

// Пиктограммы действий — символы стенда (grid.html, <symbol id="i-…">), viewBox 24
const PATHS: Record<ActionIcon, ReactElement> = {
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />,
  doc: <path d="M14 3H6v18h12V7l-4-4zM14 3v4h4M12 11v6M9 14h6" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  print: <path d="M7 9V4h10v5M7 17H4v-7h16v7h-3M7 14h10v6H7z" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  ban: <><circle cx="12" cy="12" r="8" /><path d="M6.5 6.5l11 11" /></>,
}

export function ActionGlyph({ icon }: { icon: ActionIcon }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{PATHS[icon]}</svg>
}
