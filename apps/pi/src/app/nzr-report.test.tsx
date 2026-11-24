import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { App } from './App'
import './transport'

afterEach(() => { window.location.hash = '' })

it('opens the report from its URL and shows write-offs only when their placement expands', async () => {
  window.location.hash = '#/nzr-report'
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Отчёт НЗР' })).toBeInTheDocument()
  await screen.findByText('47422840000000000101')
  expect(screen.queryByText(/Дочерние документы ·/)).toBeNull()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск по постановкам' }), { target: { value: 'a0000400' } })
  fireEvent.click(await screen.findByRole('button', { name: 'Показать дочерние документы постановки 400' }))
  expect(screen.getByText('Дочерние документы · 1')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Открыть документ 1400' }))
  expect(await screen.findByText(/Списание · к постановке № 400/)).toBeInTheDocument()
})

it('applies the account set independently of account filters and opens the remaining account', async () => {
  window.location.hash = '#/nzr-report'
  render(<App />)
  await screen.findByText('47422840000000000101')
  fireEvent.click(screen.getByRole('button', { name: /Набор счетов/ }))
  const chooser = within(screen.getByRole('dialog', { name: 'Набор счетов НЗР' }))
  fireEvent.click(chooser.getByRole('button', { name: 'Снять выбор' }))
  fireEvent.change(chooser.getByRole('searchbox'), { target: { value: '47422840000000000202' } })
  fireEvent.click(chooser.getByRole('button', { name: 'Выбрать все найденные · 1' }))
  fireEvent.click(chooser.getByRole('button', { name: 'Применить набор' }))
  expect(screen.getByText('1 из 1')).toBeInTheDocument()
  expect(screen.getByText('47422840000000000202')).toBeInTheDocument()
})

it('saves the draft across visits and restores all accounts without clicking the catalogue again', async () => {
  window.location.hash = '#/nzr-report'
  const firstVisit = render(<App />)
  await screen.findByText('47422840000000000101')
  fireEvent.click(screen.getByRole('button', { name: /Набор счетов/ }))
  const chooser = within(screen.getByRole('dialog', { name: 'Набор счетов НЗР' }))
  fireEvent.click(chooser.getByRole('button', { name: 'Снять выбор' }))
  fireEvent.change(chooser.getByRole('searchbox'), { target: { value: '47422840000000000202' } })
  fireEvent.click(chooser.getByRole('button', { name: 'Выбрать все найденные · 1' }))
  const name = await chooser.findByRole('textbox', { name: 'Название набора' })
  fireEvent.change(name, { target: { value: 'Утренняя смена' } })
  fireEvent.click(chooser.getByRole('button', { name: 'Сохранить набор' }))
  await chooser.findByRole('option', { name: 'Утренняя смена · 1' })
  firstVisit.unmount()

  render(<App />)
  await screen.findByText('47422840000000000101')
  fireEvent.click(screen.getByRole('button', { name: /Набор счетов/ }))
  const reopened = within(screen.getByRole('dialog', { name: 'Набор счетов НЗР' }))
  const saved = await reopened.findByRole('option', { name: 'Утренняя смена · 1' })
  fireEvent.change(reopened.getByRole('combobox', { name: 'Сохранённые наборы' }), { target: { value: (saved as HTMLOptionElement).value } })
  fireEvent.click(reopened.getByRole('button', { name: 'Применить набор' }))
  expect(screen.getByText('1 из 1')).toBeInTheDocument()
  expect(screen.getByText('47422840000000000202')).toBeInTheDocument()
})
