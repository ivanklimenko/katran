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
})
