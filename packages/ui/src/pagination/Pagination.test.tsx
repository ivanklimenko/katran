import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Pagination, pageWindow } from './Pagination'

describe('pageWindow', () => {
  it('мало страниц — все', () => expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]))
  it('середина — края и соседи с пропусками', () => expect(pageWindow(5, 10)).toEqual([1, '…', 4, 5, 6, '…', 10]))
  it('у края — без лишнего пропуска', () => expect(pageWindow(2, 10)).toEqual([1, 2, 3, '…', 10]))
})

describe('Pagination', () => {
  it('диапазон, текущая страница, переходы', async () => {
    const onPage = vi.fn()
    renderK(<Pagination page={2} pageSize={20} total={87} onPage={onPage} />)
    expect(screen.getByText('21–40 из 87')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Страница 2' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(screen.getByRole('button', { name: 'Вперёд' }))
    expect(onPage).toHaveBeenCalledWith(3)
    await userEvent.click(screen.getByRole('button', { name: 'Страница 5' }))
    expect(onPage).toHaveBeenCalledWith(5)
  })
  it('на последней странице Вперёд недоступна; пусто — 0 из 0', () => {
    const { rerender } = renderK(<Pagination page={5} pageSize={20} total={87} onPage={() => {}} />)
    expect(screen.getByRole('button', { name: 'Вперёд' })).toBeDisabled()
    rerender(<Pagination page={1} pageSize={20} total={0} onPage={() => {}} />)
    expect(screen.getByText('0 из 0')).toBeInTheDocument()
  })
  it('размер страницы', async () => {
    const onPageSize = vi.fn()
    renderK(<Pagination page={1} pageSize={20} total={87} onPage={() => {}} pageSizes={[20, 50]} onPageSize={onPageSize} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'На странице' }), '50')
    expect(onPageSize).toHaveBeenCalledWith(50)
  })
  it('пустой список размеров — селектора нет', () => {
    renderK(<Pagination page={1} pageSize={20} total={87} onPage={() => {}} pageSizes={[]} onPageSize={() => {}} />)
    expect(screen.queryByRole('combobox')).toBeNull()
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<Pagination page={1} pageSize={20} total={87} onPage={() => {}} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
