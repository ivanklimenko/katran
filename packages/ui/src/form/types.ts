import type { ReactNode } from 'react'

/** Описание поля из реестра полей приложения (у валюты — FIELDS стенда, index.html:597). Ключ реестра — тег. */
export type FieldDef = {
  /** Название поля — в подсказке номера: «50 · Приказодатель». */
  label: string
  kind: 'ref' | 'amount' | 'short' | 'party' | 'bank' | 'text'
  /** Допустимые буквы опции (правка — срез 2c). */
  opts?: string[] | undefined
  /** Текстовое поле: строк всего и знаков в строке (70 — 4×35, 72 — 6×35, 79 — 35×50). */
  lines?: number | undefined
  width?: number | undefined
  /** Сколько строк текстового поля видно до раскрытия; по умолчанию lines, не больше 4. */
  show?: number | undefined
}

/** Поле в схеме: тег или тег с условием; префикс «B.» — поле последовательности B (MT202COV), описание — по тегу без префикса. */
export type FieldRef = string | { tag: string; hideIfEmpty?: boolean | undefined }

/** Значение поля: буква опции, счёт (у сторон), строки. */
export type FieldValue = { opt?: string | undefined; acc?: string | undefined; lines: string[] }

export type FormPart = {
  /** Пары строк сетки: слева 50–54, справа 55–59; null — пустое место. */
  grid?: [FieldRef | null, FieldRef | null][] | undefined
  /** Текстовые поля под сеткой; одно — во всю ширину. */
  text?: FieldRef[] | undefined
  /** Короткие поля одной строкой под сеткой. */
  extra?: FieldRef[] | undefined
}

/** Сворачиваемая секция после полей; содержимое — renderSection приложения. collapsed по умолчанию true (эталон: все свёрнуты). */
export type FormSection = { id: string; title: string; collapsed?: boolean | undefined }

/** Схема «Общих данных» — данные приложения (профиль типа документа), ConfigForm — механизм. */
export type FormSchema = FormPart & {
  /** Ячейки сводки; содержимое каждой — renderHero(id). */
  hero?: string[] | undefined
  /** Именованные блоки между сводкой и полями; рендерит приложение. */
  blocks?: string[] | undefined
  /** Заголовок полей («Поля MT103») и подсказка раскладки («50–54 слева · 55–59 справа»). */
  fieldsTitle?: string | undefined
  fieldsHint?: string | undefined
  /** Вторая группа полей со своим заголовком (MT202COV — последовательность B). */
  seqB?: (FormPart & { title: string }) | undefined
  sections?: FormSection[] | undefined
  /** Заголовок над секциями; по умолчанию «Дополнительные блоки». */
  sectionsTitle?: string | undefined
}

/** Ячейка сводки: подпись (с подсказкой), значение, выравнивание суммы вправо. */
export type HeroCell = { label: ReactNode; value: ReactNode; align?: 'right' | undefined; tip?: string | undefined }

/** Содержимое секции; null — секция без данных: бледный заголовок, не раскрывается (состав блоков не прыгает между документами). */
export type SectionContent = { body: ReactNode; count?: number | undefined } | null
