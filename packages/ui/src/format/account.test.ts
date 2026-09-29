import { shortAccount } from './account'

describe('shortAccount', () => {
  it('8 … 4, код валюты — знаки 6–8', () => {
    expect(shortAccount('40702840999377318571')).toEqual({ head: '40702840', ccy: '840', tail: '8571', short: true })
  })
  it('граница: 12 знаков не сокращаются, 13 — сокращаются', () => {
    expect(shortAccount('407028401234')).toEqual({ head: '407028401234', ccy: '840', tail: '', short: false })
    expect(shortAccount('4070284012345')).toEqual({ head: '40702840', ccy: '840', tail: '2345', short: true })
  })
  it('короткий счёт не сокращается', () => {
    expect(shortAccount('40702840123')).toEqual({ head: '40702840123', ccy: '840', tail: '', short: false })
  })
})
