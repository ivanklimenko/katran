import { copyText } from './clipboard'

describe('copyText', () => {
  it('пишет через navigator.clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    expect(await copyText('abc')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('abc')
  })
  it('при отказе возвращает false', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('нет')) } })
    expect(await copyText('abc')).toBe(false)
  })
})
