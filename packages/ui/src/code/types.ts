/** Кусок подсвеченного текста: kind — класс подсветки, '' — без подсветки. Рендер — только React-элементы, текст экранирует React. */
export type CodeToken = { kind: string; text: string }
/** Строка разобранного XML: глубина (отступ 2ch на уровень) и выравнивание атрибута столбиком (в ch). */
export type CodeLine = { depth: number; tokens: CodeToken[]; align?: number | undefined }
