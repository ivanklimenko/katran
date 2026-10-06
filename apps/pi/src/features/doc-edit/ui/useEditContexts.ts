import { useCallback, useEffect, useRef } from 'react'
import { useUnit } from 'effector-react'
import { useKatran } from '@katran/ui'
import type { EditValue } from '../../../shared/api'
import type { EditConfirmView, EditContext } from '../../../shared/lib/detail'
import { DISCARD_VIEW, editKey, editScope, targetOf, type DocEdit } from '../model/createDocEdit'

/**
 * Контексты правки по документам (план 2c §3.2): деталка получает EditContext своего документа, не зная о модели.
 * Состояние редактора (цель, черновик, ошибки, Prompt) видно только документу, которому принадлежит ключ открытого редактора.
 * Команды cancel/save/onConfirm действуют только из документа, которому принадлежат редактор и Prompt.
 * Рост $savedCount — объявление «Изменения сохранены» в живой области (на монтировании — без объявления).
 *
 * commitView получает initial модели (нормализованное текущее) и черновик как он есть, без нормализации: запрос уйдёт с
 * normalize(черновик). Для единственной цели с Prompt «commit» — даты валютирования ГГГГ-ММ-ДД из DateInput — это одно и то же.
 */
export function useEditContexts<D extends { id: string }>(
  edit: DocEdit<D>,
  commitView: (target: string, was: EditValue, now: EditValue) => EditConfirmView,
): (docId: string) => EditContext {
  const { model } = edit
  const [editing, drafts, errors, saving, saveError, confirm, accounts, savedCount] = useUnit([
    model.$editing, model.$drafts, model.$errors, model.$saving, model.$saveError, model.$confirm, edit.$accounts, edit.$savedCount,
  ])
  const [open, change, cancel, save, submit, confirmResult, loadAccounts] = useUnit([
    model.open, model.change, model.cancel, model.save, model.submit, model.confirmResult, edit.loadAccounts,
  ])
  const { announce } = useKatran()

  const seen = useRef(savedCount)
  useEffect(() => {
    if (savedCount > seen.current) announce('Изменения сохранены')
    seen.current = savedCount
  }, [savedCount, announce])

  return useCallback((docId: string): EditContext => {
    const scope = editScope(docId)
    const own = editing !== null && editing.key.startsWith(scope) ? editing : null
    const key = own?.key ?? null
    const draft = key !== null ? drafts[key] ?? null : null
    const ownConfirm = confirm !== null && confirm.key.startsWith(scope)
    let view: EditConfirmView | null = null
    if (confirm !== null && ownConfirm) {
      if (confirm.kind === 'discard') view = DISCARD_VIEW
      else if (own !== null && draft !== null) view = commitView(targetOf(own.key), own.initial, draft)
    }
    return {
      docId,
      editing: key !== null ? targetOf(key) : null,
      draft,
      error: key !== null ? errors[key] ?? null : null,
      saving,
      // прежний отказ не висит под редактором, пока идёт новое сохранение
      saveError: key !== null && !saving ? saveError : null,
      confirm: view,
      onConfirm: (ok) => { if (ownConfirm) confirmResult(ok) },
      open: (target, current) => open({ key: editKey(docId, target), initial: current }),
      change: (next) => { if (key !== null) change({ key, draft: next }) },
      cancel: () => { if (key !== null) cancel() },
      save: () => { if (key !== null) save() },
      revert: (target, current, original) => submit({ key: editKey(docId, target), initial: current, draft: original }),
      accounts: (side) => accounts[`${docId}:${side}`] ?? null,
      retryAccounts: (side) => loadAccounts({ id: docId, side }),
    }
  }, [editing, drafts, errors, saving, saveError, confirm, accounts, commitView, open, change, cancel, save, submit, confirmResult, loadAccounts])
}
