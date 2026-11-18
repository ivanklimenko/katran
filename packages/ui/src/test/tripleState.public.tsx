import { TripleState, type TripleStateProps, type TripleStateValue } from '../index'

const value: TripleStateValue = 'unset'
const props: TripleStateProps = {
  value, onChange: (next) => next.toUpperCase(), icon: 'filter', label: 'Фильтр',
  hints: { unset: 'Не задано', on: 'Включено', off: 'Выключено' },
}

export const tripleState = <TripleState {...props} />

// @ts-expect-error Для каждого положения нужна подсказка.
export const missingHint = <TripleState {...props} hints={{ unset: 'Не задано', on: 'Включено' }} />
