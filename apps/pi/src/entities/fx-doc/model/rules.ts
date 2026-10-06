import { isEmptyValue, type FieldDef, type FieldRef, type FormPart } from '@katran/ui'
import type { EditValue } from '../../../shared/api'
import type { FxDocDetail, SwiftValue } from './detail'
import { fieldTarget } from './edit'
import { FX_FIELDS, fxSchemaOf } from './swift'

/** Набор SWIFT X (эталон validate(), index.html:1481): ASCII, поэтому прописные после нормализации той же длины. */
const X = /^[A-Z0-9/\-?:().,'+ ]*$/i
const ACC = /^[A-Z0-9]*$/i
const ACC_MAX = 34
/** 20 исх (эталон txtCommit, index.html:1335): набор и длина, «/» по краям и «//». */
const REF = /^[A-Z0-9/\-?:().,'+ ]{1,16}$/
const REF_SLASH = /^\/|\/$|\/\//
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const FIELD = 'field:'

const sizeOf = (def: FieldDef) => ({ n: def.lines ?? 4, w: def.width ?? 35 })
const baseTag = (tag: string) => tag.replace(/^B\./, '')

/**
 * Первая ошибка черновика поля SWIFT (эталон validate(), index.html:1480–1489) — по сырому черновику: по строкам длина, затем набор;
 * затем счёт стороны; затем «Всего n символов, максимум N·W» (достижимо, только когда строк больше N — например, с бека).
 */
export function validateSwiftField(def: FieldDef, v: SwiftValue): string | null {
  const { n, w } = sizeOf(def)
  const errors: string[] = []
  v.lines.forEach((line, k) => {
    if (line.length > w) errors.push(`Строка ${k + 1}: ${line.length} символов, максимум ${w}`)
    if (!X.test(line)) errors.push(`Строка ${k + 1}: недопустимые символы (только латиница, цифры и / - ? : ( ) . , ' +)`)
  })
  const acc = v.acc ?? ''
  if (acc.length > ACC_MAX || !ACC.test(acc)) errors.push(`Счёт: до ${ACC_MAX} символов, только латиница и цифры`)
  const total = v.lines.reduce((sum, line) => sum + line.length, 0)
  if (total > n * w) errors.push(`Всего ${total} символов, максимум ${n * w}`)
  return errors[0] ?? null
}

/** Ошибка 20 исх (эталон txtCommit, index.html:1333–1340) — по trim().toUpperCase() значения. */
export function validateRefOut(v: string): string | null {
  const t = v.trim().toUpperCase()
  if (!t) return 'Референс не может быть пустым'
  if (!REF.test(t) || REF_SLASH.test(t)) return 'Недопустимый референс: латиница, цифры, / - ? : ( ) . , \' + ; не начинать и не заканчивать «/»'
  return null
}

/**
 * Проверка черновика цели (её же повторяет бек — фейк): поля — validateSwiftField по FX_FIELDS базы тега, 20 исх — validateRefOut,
 * дата валютирования — ГГГГ-ММ-ДД. Счета — null: «только из списка» держат SuggestInput и бек (Ruling S3).
 */
export function validateFxEdit(target: string, v: EditValue): string | null {
  if (target.startsWith(FIELD)) {
    const def = FX_FIELDS[baseTag(target.slice(FIELD.length))]
    return def && typeof v !== 'string' ? validateSwiftField(def, v) : null
  }
  if (target === 'refOut') return typeof v === 'string' ? validateRefOut(v) : null
  if (target === 'valueDate') return typeof v === 'string' && ISO_DAY.test(v) ? null : 'Дата валютирования — в формате ГГГГ-ММ-ДД'
  return null
}

/**
 * Нормализация перед сохранением (эталон Save, index.html:1458–1471): поля — строки trim+upper, хвостовые пустые прочь (внутренние
 * остаются), счёт trim без upper, пустые опция и счёт — без ключа; 20 исх — trim+upper; счета — только цифры; дата — как есть.
 */
export function normalizeFxEdit(target: string, v: EditValue): EditValue {
  if (typeof v !== 'string') {
    const lines = v.lines.map((line) => line.trim().toUpperCase())
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
    const acc = (v.acc ?? '').trim()
    return { ...(v.opt ? { opt: v.opt } : {}), ...(acc ? { acc } : {}), lines }
  }
  if (target === 'refOut') return v.trim().toUpperCase()
  if (target === 'accDt' || target === 'accKt') return v.replace(/\D/g, '')
  return v
}

/** Подвал редактора поля: «{N} строк по {W} символов, набор SWIFT X[, счёт до 34]» (эталон editor(), index.html:993). */
export function fxEditRule(def: FieldDef): string {
  const { n, w } = sizeOf(def)
  return `${n} строк по ${w} символов, набор SWIFT X${def.kind === 'party' ? `, счёт до ${ACC_MAX}` : ''}`
}

/** Цели с подтверждением Prompt «commit» перед запросом. */
export const FX_CONFIRM_TARGETS: string[] = ['valueDate']

const partRefs = (p: FormPart | undefined): FieldRef[] => [
  ...(p?.grid ?? []).flatMap((row) => row.filter((r): r is FieldRef => r !== null)),
  ...(p?.text ?? []),
]

/**
 * Правимые цели документа (спека 2c §1.1): поля сетки, текста и последовательности B схемы профиля с FX_FIELDS[база].editable —
 * поле с hideIfEmpty (56 у MT103) только заполненное или уже с правками (Ruling S5); затем 20 исх, Дт, Кт и дата валютирования
 * (у MT199 её нет). Ею же фейк проверяет цель правки.
 */
export function fxEditableTargets(d: FxDocDetail): string[] {
  const schema = fxSchemaOf(d)
  const fields = [...partRefs(schema), ...partRefs(schema.seqB)].flatMap((r) => {
    const tag = typeof r === 'string' ? r : r.tag
    if (FX_FIELDS[baseTag(tag)]?.editable !== true) return []
    const target = fieldTarget(tag)
    const value = d.fields[tag]
    const hidden = typeof r !== 'string' && r.hideIfEmpty === true && (!value || isEmptyValue(value)) && !d.edits[target]
    return hidden ? [] : [target]
  })
  return [...fields, 'refOut', 'accDt', 'accKt', ...(d.type === 'MT199' ? [] : ['valueDate'])]
}
