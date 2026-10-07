import { toApiError, type FileRequest, type FileResponse } from '../../shared/api'
import type { FakeGrid } from './grid'

type Detail = Record<string, unknown>
type Field = { opt?: string; acc?: string; lines: string[] }

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback)
const yymmdd = (iso: string) => iso.slice(2, 10).replace(/-/g, '')
/** 11-значный BIC → 12-значный адрес LT: филиал «A» перед кодом филиала. */
const lt = (bic: string) => `${bic.slice(0, 8)}A${bic.slice(8, 11)}`

/**
 * Текст SWIFT MT из детали: заголовок {1:}, {2:} по типу и получателю, тело {4:} — :20:, :32A: и заполненные поля детали, «-}».
 * Данные вымышленные; поля последовательности B (MT202COV) идут после основных с тегом без префикса.
 */
export function swiftMessage(detail: Detail): string {
  const type = str(detail.type)
  const fields = (detail.fields ?? {}) as Record<string, Field | undefined>
  const ref = fields['20']?.lines[0] ?? `FX${str(detail.docNumber)}`
  const date = yymmdd(str(detail.vdDt, str(detail.created)))
  const body = [`:20:${ref}`, `:32A:${date}${str(detail.currency)}${Number(detail.amount).toFixed(2).replace('.', ',')}`]
  for (const [tag, f] of Object.entries(fields)) {
    if (!f || tag === '20' || f.lines.length === 0) continue
    const lines = f.acc ? [`/${f.acc}`, ...f.lines] : f.lines
    body.push(`:${tag.replace(/^B\./, '')}${f.opt ?? ''}:${lines.join('\n')}`)
  }
  const head = `{1:F01${lt(str(detail.sender))}0000000000}{2:I${type.slice(2, 5)}${lt(str(detail.receiver))}N}`
  return `${head}{4:\n${body.join('\n')}\n-}`
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** Минимальный ED XML рублёвого документа: код ED в корне, номер, дата, сумма в копейках, плательщик и получатель. Данные вымышленные. */
export function edMessage(detail: Detail): string {
  const ed = str(detail.edCode, 'ED101')
  const kop = Math.round(Number(detail.amount) * 100)
  const party = (tag: string, p: { name: string; acc: string; inn: string; kpp: string; bic: string; bank: string }) =>
    `  <${tag} PersonalAcc="${esc(p.acc)}" INN="${esc(p.inn)}" KPP="${esc(p.kpp)}">\n    <Name>${esc(p.name)}</Name>\n    <Bank BIC="${esc(p.bic)}">${esc(p.bank)}</Bank>\n  </${tag}>`
  const side = (k: 'from' | 'to') => ({ name: str(detail[`${k}Name`]), acc: str(detail[`${k}Acc`]), inn: str(detail[`${k}Inn`]), kpp: str(detail[`${k}Kpp`]), bic: str(detail[`${k}Bic`]), bank: str(detail[`${k}Bank`]) })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<${ed} xmlns="urn:fake:ed" EDNo="${esc(str(detail.docNumber))}" EDDate="${esc(str(detail.numDate))}" Sum="${kop}">`,
    party('Payer', side('from')),
    party('Payee', side('to')),
    `  <Purpose>${esc(str(detail.purpose))}</Purpose>`,
    `</${ed}>`,
    '',
  ].join('\n')
}

const pdfText = (s: string) => s.replace(/[^\x20-\x7E]/g, '?').replace(/[\\()]/g, '\\$&')
/**
 * Минимальный PDF 1.4 строкой, без зависимостей: каталог, страницы, страница A4 (595×842), шрифт Helvetica, поток BT … Tj … ET.
 * Только латиница (код формы, номер, дата, сумма и валюта); xref — по фактическим смещениям (вся строка ASCII, смещение = индекс).
 */
export function pdfForm(form: string, detail: Detail): string {
  const lines = [`Form: ${form}`, `Document No: ${str(detail.docNumber)}`, `Date: ${str(detail.numDate)}`, `Amount: ${Number(detail.amount).toFixed(2)} ${str(detail.currency, 'RUB')}`]
  const stream = `BT\n/F1 14 Tf\n72 770 Td\n${lines.map((l, i) => `${i === 0 ? '' : '0 -24 Td\n'}(${pdfText(l)}) Tj`).join('\n')}\nET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  let out = '%PDF-1.4\n'
  const offsets = objects.map((o, i) => {
    const at = out.length
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
    return at
  })
  const xrefAt = out.length
  const row = (n: number, gen: string, kind: string) => `${String(n).padStart(10, '0')} ${gen} ${kind} \n`
  out += `xref\n0 ${objects.length + 1}\n${row(0, '65535', 'f')}${offsets.map((o) => row(o, '00000', 'n')).join('')}`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`
  return out
}

export type FakeFileServerOptions = {
  delayMs?: (() => number) | undefined
  /** ?fail=message / ?fail=print — 500 у своего маршрута. */
  failing?: (() => string | null) | undefined
  /** Каждый пришедший запрос — до задержки и регуляторов (как у createFakeServer). */
  observe?: ((req: FileRequest) => void) | undefined
}

const FILE = /^\/grids\/([^/]+)\/documents\/([^/]+)\/(?:(message)|print\/([^/]+))$/
const fail = (status: number, title: string, detail: string): never => {
  throw toApiError(status, { type: 'urn:katran:fake', title, status, detail })
}
const MIME = { txt: 'text/plain;charset=utf-8', xml: 'application/xml' } as const

/** Обработчик requestFileFx на контракте pi-api §1.9–1.10: тело файла и имя (транспорт стенда — без заголовков, имя отдаёт сам); ошибки — Problem Details. */
export function createFakeFileServer(grids: Record<string, FakeGrid>, opts: FakeFileServerOptions = {}) {
  return async (req: FileRequest): Promise<FileResponse> => {
    opts.observe?.(req)
    const delay = opts.delayMs?.() ?? 0
    if (delay > 0) await new Promise((r) => setTimeout(r, delay))
    const m = FILE.exec(req.url)
    if (!m) return fail(404, 'Не найдено', `Нет маршрута GET ${req.url}`)
    const [, gridId = '', rawId = '', message, rawForm] = m
    const grid = grids[gridId]
    if (!grid) return fail(404, 'Неизвестный грид', gridId)
    const id = decodeURIComponent(rawId)
    if (message) {
      if (!grid.message) return fail(404, 'Не найдено', `Нет маршрута GET ${req.url}`)
      if (opts.failing?.() === 'message') return fail(500, 'Сбой сервера', 'Регулятор ?fail=message')
      const file = grid.message(id)
      if (!file) return fail(404, 'Документ не найден', `${gridId}/${id}`)
      return { blob: new Blob([file.text], { type: MIME[file.ext] }), name: `${file.number}.${file.ext}` }
    }
    const form = decodeURIComponent(rawForm ?? '')
    if (!grid.print || !grid.printForms?.includes(form)) return fail(404, 'Форма не найдена', `${gridId}: ${form}`)
    if (opts.failing?.() === 'print') return fail(500, 'Сбой сервера', 'Регулятор ?fail=print')
    const pdf = grid.print(id, form)
    if (!pdf) return fail(404, 'Документ не найден', `${gridId}/${id}`)
    return { blob: new Blob([pdf.text], { type: 'application/pdf' }), name: `${pdf.number}-${form}.pdf` }
  }
}
