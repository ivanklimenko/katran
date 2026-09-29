import { shortAccount } from './account'

describe('shortAccount', () => {
  const acc = '40702810999377318571'
  it('по умолчанию 8…4', () => {
    expect(shortAccount(acc)).toEqual({ head: '40702810', ccy: '810', tail: '8571', short: true })
  })
  it('tail 3 — 8…3 (рублёвый реестр)', () => {
    expect(shortAccount(acc, 3)).toEqual({ head: '40702810', ccy: '810', tail: '571', short: true })
  })
  it('короткий счёт не сокращается', () => {
    expect(shortAccount('40702810123', 4)).toEqual({ head: '40702810123', ccy: '810', tail: '', short: false })
  })
  // Граница — ровно 8 + tail знаков: до неё сокращать нечего (многоточие ничего бы не спрятало).
  it('tail 4: 12 знаков не сокращается, 13 — сокращается', () => {
    expect(shortAccount('407028101234', 4)).toEqual({ head: '407028101234', ccy: '810', tail: '', short: false })
    expect(shortAccount('4070281012345', 4)).toEqual({ head: '40702810', ccy: '810', tail: '2345', short: true })
  })
  it('tail 3: 11 знаков не сокращается, 12 — сокращается', () => {
    expect(shortAccount('40702810123', 3)).toEqual({ head: '40702810123', ccy: '810', tail: '', short: false })
    expect(shortAccount('407028101234', 3)).toEqual({ head: '40702810', ccy: '810', tail: '234', short: true })
  })
})
