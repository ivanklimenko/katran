import { createEffect } from 'effector'

/**
 * Записать текст в буфер обмена — общий побочный эффект: «Скопировать ссылку» лейна (features/doc-actions, при отказе —
 * поле для ручного копирования) и «Скопировать» окна «Исходное сообщение» (features/doc-notif, итог — событием copied).
 * Нет Clipboard API (не https, старый браузер) или отказ — отказ эффекта. Уровень модуля: тесты подменяют navigator.clipboard
 * или обработчик через fork({ handlers }).
 */
export const writeClipboardFx = createEffect<string, void, Error>(async (text) => {
  const clip = navigator.clipboard as Clipboard | undefined
  if (clip === undefined || typeof clip.writeText !== 'function') throw new Error('Буфер обмена недоступен')
  await clip.writeText(text)
})
