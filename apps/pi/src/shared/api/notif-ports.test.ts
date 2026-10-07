import { parseNotifMessage } from './notif-ports'

describe('parseNotifMessage', () => {
  it('три contentType разбираются', () => {
    for (const contentType of ['application/json', 'application/xml', 'text/plain'] as const) {
      expect(parseNotifMessage({ contentType, body: 'тело' })).toEqual({ contentType, body: 'тело' })
    }
  })
  it('text/html — ошибка с путём ответ.contentType', () => {
    expect(() => parseNotifMessage({ contentType: 'text/html', body: '<b>' })).toThrow('ответ.contentType: недопустимое значение «text/html»')
  })
  it('нет body или не объект — ошибка с путём', () => {
    expect(() => parseNotifMessage({ contentType: 'text/plain' })).toThrow('ответ.body: ожидалась строка')
    expect(() => parseNotifMessage('x')).toThrow('ответ: ожидался объект')
  })
})
