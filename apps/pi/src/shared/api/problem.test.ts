import { ApiError, contractError, toApiError } from './problem'

describe('toApiError', () => {
  it('Problem Details: title и detail в message, problem сохраняется', () => {
    const body = { type: 'urn:vtb:grid:filter-validation', title: 'Некорректный фильтр', status: 400, detail: '1 условие не прошло проверку',
      errors: [{ path: 'filter.conditions[0].op', code: 'OPERATOR_NOT_ALLOWED', message: 'Оператор CONTAINS недопустим' }] }
    const e = toApiError(400, body)
    expect(e).toBeInstanceOf(ApiError)
    expect(e).toBeInstanceOf(Error)
    expect(e.status).toBe(400)
    expect(e.problem?.errors?.[0]?.code).toBe('OPERATOR_NOT_ALLOWED')
    expect(e.message).toBe('Некорректный фильтр: 1 условие не прошло проверку')
  })
  it('тело не Problem Details — общий текст со статусом', () => {
    expect(toApiError(502, '<html>').message).toBe('Ошибка запроса (статус 502)')
    expect(toApiError(500, null).problem).toBeNull()
  })
  it('contractError — статус 0 и тип urn:katran:contract', () => {
    const e = contractError('content[0].id: ожидалась строка')
    expect(e.status).toBe(0)
    expect(e.problem?.type).toBe('urn:katran:contract')
    expect(e.message).toBe('Ответ не по контракту: content[0].id: ожидалась строка')
  })
})
