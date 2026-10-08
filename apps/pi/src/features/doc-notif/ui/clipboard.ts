import { createEffect } from 'effector'

/**
 * Записать текст в буфер обмена — побочный эффект вида окна «Исходное сообщение» (итог он сообщает модели событием copied).
 * Нет Clipboard API (не https, старый браузер) или отказ — отказ эффекта. Уровень модуля: тесты подменяют navigator.clipboard
 * или обработчик через fork({ handlers }).
 */
export const writeClipboardFx = createEffect<string, void, Error>(async (text) => {
  const clip = navigator.clipboard as Clipboard | undefined
  if (clip === undefined || typeof clip.writeText !== 'function') throw new Error('Буфер обмена недоступен')
  await clip.writeText(text)
})
