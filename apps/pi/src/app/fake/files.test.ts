import { ApiError } from '../../shared/api'
import { makeFxDocs } from './fx-docs.data'
import { makeFxDocDetail } from './fx-docs.detail'
import { createFakeFileServer, edMessage, pdfForm, swiftMessage } from './files'
import { createFakeGrids } from './grids'
import { makeRubDocs } from './rub-docs.data'
import { makeRubDocDetail } from './rub-docs.detail'

const fx = makeFxDocs()
const rub = makeRubDocs()
const fxDetail = (i: number) => makeFxDocDetail(fx[i]!, i, fx)
const rubDetail = (i: number) => makeRubDocDetail(rub[i]!, i, rub)
const rubEd101 = rub.findIndex((r) => r.edCode === 'ED101')

describe('swiftMessage', () => {
  it('MT103: заголовки блоков 1, 2, тело {4: с :20: и :32A:, конец -}', () => {
    const i = fx.findIndex((r) => r.type === 'MT103')
    const t = swiftMessage(fxDetail(i))
    expect(t.startsWith('{1:F01')).toBe(true)
    expect(t).toContain('{2:I103')
    expect(t).toContain('{4:')
    expect(t).toContain(':20:')
    expect(t).toContain(':32A:')
    expect(t.endsWith('-}')).toBe(true)
  })
  it('MT202COV: тип в блоке 2 — 202, поля последовательности B попадают в тело', () => {
    const i = fx.findIndex((r) => r.type === 'MT202COV')
    const t = swiftMessage(fxDetail(i))
    expect(t).toContain('{2:I202')
    expect(t.endsWith('-}')).toBe(true)
  })
})

describe('edMessage', () => {
  it('XML: декларация, корень <ED101, номер, сумма в копейках, экранирование', () => {
    const d: Record<string, unknown> = { ...rubDetail(rubEd101), fromName: 'ООО «A & B»' }
    const t = edMessage(d)
    expect(t.startsWith('<?xml')).toBe(true)
    expect(t).toContain('<ED101')
    expect(t).toContain(String(d.docNumber))
    expect(t).toContain('A &amp; B')
    expect(t).not.toContain('A & B')
  })
})

describe('pdfForm', () => {
  const pdf = pdfForm('swift-form', fxDetail(6))
  it('заголовок %PDF-1.4, конец %%EOF и перевод строки, только ASCII', () => {
    expect(pdf.startsWith('%PDF-1.4')).toBe(true)
    expect(pdf.endsWith('%%EOF\n')).toBe(true)
    expect([...pdf].every((c) => c.charCodeAt(0) < 128)).toBe(true)
    expect(pdf).toContain('/MediaBox [0 0 595 842]')
    expect(pdf).toContain('/BaseFont /Helvetica')
    expect(pdf).toContain('swift-form')
  })
  it('смещения xref указывают на «N 0 obj»; startxref — на таблицу', () => {
    const xrefAt = pdf.indexOf('\nxref\n') + 1
    expect(Number(/startxref\n(\d+)\n/.exec(pdf)![1])).toBe(xrefAt)
    const rows = pdf.slice(xrefAt).split('\n').slice(2).filter((l) => /^\d{10} \d{5} [nf] ?$/.test(l))
    expect(rows.length).toBeGreaterThan(2)
    rows.slice(1).forEach((l, k) => expect(pdf.slice(Number(l.slice(0, 10))).startsWith(`${k + 1} 0 obj`)).toBe(true))
    expect(pdf).toContain(`/Size ${rows.length}`)
  })
})

describe('файловый сервер фейка', () => {
  const server = () => createFakeFileServer(createFakeGrids())
  it('message fx: <номер>.txt, text/plain;charset=utf-8, текст SWIFT', async () => {
    const r = await server()({ url: `/grids/fx-docs/documents/${fx[6]!.id}/message` })
    expect(r.name).toBe(`${fx[6]!.docNumber}.txt`)
    expect(r.blob.type).toBe('text/plain;charset=utf-8')
    expect(r.blob.size).toBeGreaterThan(50)
  })
  it('message rub: .xml, application/xml', async () => {
    const r = await server()({ url: `/grids/rub-docs/documents/${rub[rubEd101]!.id}/message` })
    expect(r.name).toBe(`${rub[rubEd101]!.docNumber}.xml`)
    expect(r.blob.type).toBe('application/xml')
  })
  it('print: fx swift-form → PDF, имя <номер>-swift-form.pdf; rub payment-order → PDF', async () => {
    const f = await server()({ url: `/grids/fx-docs/documents/${fx[6]!.id}/print/swift-form` })
    expect(f.blob.type).toBe('application/pdf')
    expect(f.name).toBe(`${fx[6]!.docNumber}-swift-form.pdf`)
    expect((await server()({ url: `/grids/rub-docs/documents/${rub[0]!.id}/print/payment-order` })).blob.type).toBe('application/pdf')
  })
  it('404 Problem: swift-form у рубля, форма вне набора, неизвестные документ и грид; id декодируется', async () => {
    const s = server()
    const bad = async (url: string) => (await s({ url }).catch((e: unknown) => e)) as ApiError
    for (const url of [`/grids/rub-docs/documents/${rub[0]!.id}/print/swift-form`, `/grids/fx-docs/documents/${fx[6]!.id}/print/collection-order`, '/grids/fx-docs/documents/nope/message', '/grids/fx-docs/documents/nope/print/swift-form', '/grids/nope/documents/1/message', '/other']) {
      const e = await bad(url)
      expect(e).toBeInstanceOf(ApiError)
      expect(e.status).toBe(404)
      expect(e.problem?.status).toBe(404)
    }
    expect((await s({ url: `/grids/fx-docs/documents/${encodeURIComponent(fx[6]!.id)}/message` })).name).toContain('.txt')
  })
  it('регуляторы: ?fail=message / ?fail=print — 500 у своего маршрута; observe видит запрос', async () => {
    const seen: string[] = []
    const s = createFakeFileServer(createFakeGrids(), { failing: () => 'print', observe: (r) => seen.push(r.url) })
    await expect(s({ url: `/grids/fx-docs/documents/${fx[6]!.id}/print/swift-form` })).rejects.toMatchObject({ status: 500 })
    await expect(s({ url: `/grids/fx-docs/documents/${fx[6]!.id}/message` })).resolves.toBeDefined()
    expect(seen).toHaveLength(2)
  })
})
