import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Disclosure } from './Disclosure'

describe('Disclosure', () => {
  it('кнопка заголовка с aria-expanded управляет панелью; по умолчанию свёрнут', async () => {
    renderK(<Disclosure title="Транзакции" count={6} aside={<a href="#x">txId</a>}><p>Проводки</p></Disclosure>)
    const btn = screen.getByRole('button', { name: 'Транзакции' })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Проводки')).not.toBeVisible()
    expect(screen.getByText('6')).toBeInTheDocument()
    await userEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Проводки')).toBeVisible()
    expect(document.getElementById(btn.getAttribute('aria-controls')!)).toHaveTextContent('Проводки')
  })

  it('шеврон справа тоже переключает (мышь), из порядка Tab исключён', async () => {
    renderK(<Disclosure title="Маршрут" defaultOpen><p>Правило</p></Disclosure>)
    const chev = document.querySelector('[data-part="chevron"]') as HTMLButtonElement
    expect(chev).toHaveAttribute('tabindex', '-1')
    expect(chev).toHaveAttribute('aria-hidden', 'true')
    await userEvent.click(chev)
    expect(screen.getByRole('button', { name: 'Маршрут' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('управляемый: open/onOpenChange', async () => {
    function Host() {
      const [o, setO] = useState(true)
      return <><Disclosure title="Бюджетные реквизиты" open={o} onOpenChange={setO}><p>101</p></Disclosure><span>{o ? 'открыт' : 'закрыт'}</span></>
    }
    renderK(<Host />)
    await userEvent.click(screen.getByRole('button', { name: 'Бюджетные реквизиты' }))
    expect(screen.getByText('закрыт')).toBeInTheDocument()
  })

  it('без данных — бледный заголовок «нет данных», не раскрывается', () => {
    renderK(<Disclosure title="Посредник" empty />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Посредник' })).toBeInTheDocument()
    expect(screen.getByText('нет данных')).toBeInTheDocument()
  })

  it('вложенный уровень — заголовок h4', () => {
    renderK(<Disclosure title="Информация о банке-плательщике" level="sub" defaultOpen><p>BIC</p></Disclosure>)
    expect(screen.getByRole('heading', { level: 4, name: 'Информация о банке-плательщике' })).toBeInTheDocument()
  })

  it('без нарушений axe', async () => {
    const { container } = renderK(<><Disclosure title="Транзакции" count={2}><p>x</p></Disclosure><Disclosure title="Посредник" empty /></>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
