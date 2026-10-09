import { useState } from 'react'

/**
 * Запасной фокус окна страницы (Prompt, «Исходное сообщение»): заголовок drawer, из которого окно открыли. Окно открывается
 * кнопкой вкладки — фокус в момент первого рендера ещё на ней; кнопка пропала к закрытию (вкладку перезапросили после 409) —
 * фокус уходит на заголовок этого drawer, а не в body (как fallbackFocus 2d, Ruling R19).
 */
export function useDrawerFallback(): () => HTMLElement | null {
  const [drawer] = useState(() => {
    const active = document.activeElement
    return active instanceof HTMLElement ? active.closest<HTMLElement>('[data-k-drawer]') : null
  })
  return () => (drawer !== null && drawer.isConnected ? drawer.querySelector<HTMLElement>('h2[tabindex]') : null)
}
