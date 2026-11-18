import { useState } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RadioGroup, type RadioOption } from '../index'
import { renderK } from '../test/renderK'

const options: RadioOption[] = [
  { value: 'draft', label: 'Черновик' },
  { value: 'blocked', label: 'Закрыт', disabled: true },
  { value: 'ready', label: 'Готов' },
]

describe('RadioGroup', () => {
  it('передаёт имя, класс, нативные value и общий name без начального выбора', () => {
    renderK(<RadioGroup label="Статус" name="status" value={null} options={options} onChange={vi.fn()} className="extra" />)
    const group = screen.getByRole('radiogroup', { name: 'Статус' })
    expect(group).toHaveClass('extra')
    const radios = within(group).getAllByRole('radio')
    expect(radios).toHaveLength(options.length)
    for (const [index, radio] of radios.entries()) {
      expect(radio.tagName).toBe('INPUT')
      expect(radio).toHaveAttribute('name', 'status')
      expect(radio).toHaveAttribute('value', options[index]?.value)
      expect(radio).not.toBeChecked()
    }
  })

  it('выбирает по подписи и сообщает ровно об одной смене', async () => {
    const changed = vi.fn()
    function Controlled() {
      const [value, setValue] = useState<string | null>('draft')
      return <RadioGroup label="Статус" name="status" value={value} options={options} onChange={(next) => {
        changed(next)
        setValue(next)
      }} />
    }

    renderK(<Controlled />)
    const draft = screen.getByRole('radio', { name: 'Черновик' })
    const ready = screen.getByRole('radio', { name: 'Готов' })
    expect(draft).toBeChecked()

    await userEvent.click(screen.getByText('Готов'))
    await userEvent.click(ready)
    expect(ready).toBeChecked()
    expect(draft).not.toBeChecked()
    expect(changed).toHaveBeenCalledExactlyOnceWith('ready')
  })

  it('отключает пункт и все пункты группы', async () => {
    const changed = vi.fn()
    renderK(<>
      <RadioGroup label="Статус" name="status" value={null} options={options} onChange={changed} />
      <RadioGroup label="Архив" name="archive" value="ready" options={options} onChange={changed} disabled />
    </>)
    const status = within(screen.getByRole('radiogroup', { name: 'Статус' }))
    const closed = status.getByRole('radio', { name: 'Закрыт' })
    expect(closed).toBeDisabled()
    await userEvent.click(status.getByText('Закрыт'))
    expect(closed).not.toBeChecked()

    const archive = within(screen.getByRole('radiogroup', { name: 'Архив' }))
    for (const radio of archive.getAllByRole('radio')) expect(radio).toBeDisabled()
    await userEvent.click(archive.getByText('Черновик'))
    expect(archive.getByRole('radio', { name: 'Готов' })).toBeChecked()
    expect(changed).not.toHaveBeenCalled()
  })

  it('управляет группами с разными name независимо и снимает выбор по null', async () => {
    const changed = vi.fn()
    function Groups({ first }: { first: string | null }) {
      const [second, setSecond] = useState<string | null>('ready')
      return <>
        <RadioGroup label="Статус" name="status" value={first} options={options} onChange={changed} />
        <RadioGroup label="Архив" name="archive" value={second} options={options} onChange={setSecond} />
      </>
    }
    const { rerender } = renderK(<Groups first="draft" />)
    const statusDraft = within(screen.getByRole('radiogroup', { name: 'Статус' })).getByRole('radio', { name: 'Черновик' })
    const archiveDraft = within(screen.getByRole('radiogroup', { name: 'Архив' })).getByRole('radio', { name: 'Черновик' })

    await userEvent.click(archiveDraft)
    expect(statusDraft).toBeChecked()
    expect(archiveDraft).toBeChecked()
    expect(changed).not.toHaveBeenCalled()
    rerender(<Groups first={null} />)
    expect(statusDraft).not.toBeChecked()
    expect(archiveDraft).toBeChecked()
  })
})
