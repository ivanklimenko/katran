import { createStore, type Store } from 'effector'

/** Набор ключей — Record<string, true> (документы с операцией: $busyDocs, $blockedDocs фич). */
export type KeySet = Record<string, true>

const sameKeys = (a: KeySet, b: KeySet): boolean => {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every((k) => b[k] === true)
}

/**
 * Набор ключей со стабильной ссылкой: пока набор тот же, стор хранит прежний объект и не обновляется. Источник пересчитывается
 * на каждое изменение своих сторов (ввод причины, черновик), а подписчики набора (виды правки и аннулирования) — нет
 * (ревью Task 7 среза 2e).
 * Ограничение: стартовое значение — `source.getState()` при создании (умолчание источника). В `fork({ values })` с предзаданным
 * источником (или его родительскими сторами) этот стор синхронизируется только после первого обновления источника в scope —
 * до него он держит умолчание. В приложении и тестах источники стартуют с умолчания, поэтому расхождения нет.
 */
export function stableKeySet(source: Store<KeySet>): Store<KeySet> {
  return createStore<KeySet>(source.getState()).on(source, (prev, next) => (sameKeys(prev, next) ? prev : next))
}
