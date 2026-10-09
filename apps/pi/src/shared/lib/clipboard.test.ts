import { allSettled, fork } from 'effector'
import { vi } from 'vitest'
import { writeClipboardFx } from './clipboard'

describe('writeClipboardFx (общий эффект буфера обмена: ссылка документа, исходное сообщение)', () => {
  afterEach(() => { Reflect.deleteProperty(navigator, 'clipboard') })

  it('navigator.clipboard.writeText(text); отказ API — отказ эффекта с той же ошибкой', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await writeClipboardFx('L')
    expect(writeText).toHaveBeenCalledWith('L')
    writeText.mockRejectedValueOnce(new Error('NotAllowedError'))
    await expect(writeClipboardFx('L')).rejects.toThrow('NotAllowedError')
  })

  it('нет Clipboard API (не https, старый браузер) или нет writeText — отказ «Буфер обмена недоступен»', async () => {
    expect('clipboard' in navigator && navigator.clipboard !== undefined).toBe(false)
    await expect(writeClipboardFx('L')).rejects.toThrow('Буфер обмена недоступен')
    Object.defineProperty(navigator, 'clipboard', { value: {}, configurable: true })
    await expect(writeClipboardFx('L')).rejects.toThrow('Буфер обмена недоступен')
  })

  it('подменяется через fork({ handlers })', async () => {
    const copied: string[] = []
    const scope = fork({ handlers: [[writeClipboardFx, async (text: string) => { copied.push(text) }]] })
    await allSettled(writeClipboardFx, { scope, params: 'текст' })
    expect(copied).toEqual(['текст'])
  })
})
