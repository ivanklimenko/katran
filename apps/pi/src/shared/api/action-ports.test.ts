import { allSettled, fork } from 'effector'
import { createActionPorts } from './action-ports'
import { requestFileFx, type FileRequest } from './request'

describe('createActionPorts', () => {
  it('printFx: GET …/documents/{id}/print/{form} через requestFileFx, id и form кодируются', async () => {
    const reqs: FileRequest[] = []
    const file = { blob: new Blob(['x']), name: 'p.pdf' }
    const scope = fork({ handlers: [[requestFileFx, async (r: FileRequest) => { reqs.push(r); return file }]] })
    const r = await allSettled(createActionPorts('rub-docs').printFx, { scope, params: { id: 'a/b', form: 'payment-order' } })
    expect(reqs).toEqual([{ url: '/grids/rub-docs/documents/a%2Fb/print/payment-order' }])
    expect(r).toEqual({ status: 'done', value: file })
  })
  it('messageFx: GET …/documents/{id}/message', async () => {
    const reqs: FileRequest[] = []
    const scope = fork({ handlers: [[requestFileFx, async (r: FileRequest) => { reqs.push(r); return { blob: new Blob(), name: null } }]] })
    await allSettled(createActionPorts('fx-docs').messageFx, { scope, params: 'a/b' })
    expect(reqs).toEqual([{ url: '/grids/fx-docs/documents/a%2Fb/message' }])
  })
})
