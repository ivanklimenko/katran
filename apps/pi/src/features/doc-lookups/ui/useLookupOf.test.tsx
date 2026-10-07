import { act, waitFor } from '@testing-library/react'
import { createEffect } from 'effector'
import { ApiError } from '../../../shared/api'
import type { LookupView } from '../../../shared/lib/detail'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { renderK } from '../../../shared/lib/test'
import { createLookup, type Lookup } from '../model/createLookup'
import { useLookupOf } from './useLookupOf'

// UI-тесты apps/pi идут на глобальном scope: модель — новая в каждом тесте; порт отвечает по сценарию
function setup(answer: (id: string) => Promise<string>) {
  const asked: string[] = []
  const fx = createEffect<string, string, ApiError>((id) => { asked.push(id); return answer(id) })
  const lifecycle = createPageLifecycle()
  const lookup = createLookup({ fx, lifecycle })
  const views: Record<string, LookupView<string>> = {}
  function Probe({ l }: { l: Lookup<string> }) {
    const of = useLookupOf(l)
    views.d1 = of('d1')
    views.d2 = of('d2')
    return null
  }
  renderK(<Probe l={lookup} />)
  act(() => { lifecycle.pageOpened() })
  return { views, asked, lookup, lifecycle }
}

describe('useLookupOf (спека 2e §3.3)', () => {
  it('нет записи — idle без значения; load документа — его запрос, затем ready', async () => {
    const { views, asked } = setup(async (id) => `курс ${id}`)
    expect(views.d1).toMatchObject({ state: 'idle', value: null, error: null })
    act(() => { views.d2!.load() })
    expect(asked).toEqual(['d2'])
    expect(views.d2!.state).toBe('loading')
    await waitFor(() => expect(views.d2).toMatchObject({ state: 'ready', value: 'курс d2', error: null }))
    expect(views.d1!.state).toBe('idle')
  })

  it('ошибка — error с текстом; retry — повтор; refresh готового — перезапрос с прежним значением', async () => {
    let n = 0
    const { views, asked } = setup(async () => {
      n += 1
      if (n === 1) throw new ApiError(500, { type: 'urn:katran:error', title: 'Ошибка', status: 500, detail: 'Остатки недоступны' }, 'Ошибка')
      if (n === 3) return new Promise<string>(() => undefined)
      return 'остатки'
    })
    act(() => { views.d1!.load() })
    await waitFor(() => expect(views.d1).toMatchObject({ state: 'error', value: null, error: 'Остатки недоступны' }))
    act(() => { views.d1!.retry() })
    await waitFor(() => expect(views.d1).toMatchObject({ state: 'ready', value: 'остатки' }))
    act(() => { views.d1!.refresh() })
    expect(asked).toEqual(['d1', 'd1', 'd1'])
    expect(views.d1).toMatchObject({ state: 'loading', value: 'остатки', error: null })
  })
})
