import { shortAccount } from './account'

describe('shortAccount', () => {
  it('8 … 3, код валюты — знаки 6–8', () => {
    expect(shortAccount('40702840500000012345')).toEqual({ head: '40702840', ccy: '840', tail: '345', short: true })
  })
  it('короткий счёт не сокращается', () => {
    expect(shortAccount('12345678901')).toEqual({ head: '12345678901', ccy: '678', tail: '', short: false })
  })
})
