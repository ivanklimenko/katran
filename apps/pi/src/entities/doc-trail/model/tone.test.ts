import { toneOf } from './tone'

// Все коды, которые рисуются бейджем: из данных фейка (Task 7) и эталона (index.html:767–866). Новый код в данных — сюда.
const TONES: [string, 'ok' | 'bad' | 'wait'][] = [
  // решения комплаенса (мониторинг, подразделение, отрицательная нотификация)
  ['ALLOW', 'ok'], ['REVIEW', 'wait'], ['DENY', 'bad'],
  // нотификации
  ['OK', 'ok'], ['TIMEOUT', 'bad'],
  // стриминг и экспорт MPU
  ['SENT', 'ok'], ['RETRY', 'wait'], ['QUEUED', 'wait'],
  // статусы связанных документов: реестры (STATUSES) и эталон (NEW)
  ['DONE', 'ok'], ['EXPORTED', 'ok'], ['NEW', 'wait'], ['IN_PROGRESS', 'wait'], ['TO_EXPORT', 'wait'], ['PROCESSING', 'wait'],
  ['DEFERRED', 'wait'], ['ERROR', 'bad'], ['INVALID', 'bad'], ['REJECTED', 'bad'],
  // проверки аудита
  ['PASSED', 'ok'], ['PENDING', 'wait'],
]

describe('toneOf — одна таблица тонов на все вкладки', () => {
  it('каждый код данных фейка и эталона — свой тон', () => {
    for (const [code, tone] of TONES) expect(toneOf(code), code).toBe(tone)
  })
  it('bad: и коды отказа вне данных; прочее — wait', () => {
    for (const c of ['BLOCK', 'FAILED']) expect(toneOf(c), c).toBe('bad')
    for (const c of ['UNKNOWN', '']) expect(toneOf(c), c).toBe('wait')
  })
  it('регистр не важен', () => {
    expect(toneOf('allow')).toBe('ok')
    expect(toneOf('Timeout')).toBe('bad')
  })
})
