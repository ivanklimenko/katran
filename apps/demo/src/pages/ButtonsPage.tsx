import { Button, ButtonLink, IconButton } from '@katran/ui'
import { H1, H2, Note, Row } from './parts'

const Gear = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2.5" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5 13 13M3 13l1.5-1.5M11.5 4.5 13 3" /></svg>

export function ButtonsPage() {
  return (
    <>
      <H1>Кнопки</H1>
      <Note>Primary — одно главное действие на экран. Ghost — всё остальное. IconButton требует имя: у иконки текста нет.</Note>
      <H2>Варианты и размеры</H2>
      <Row>
        <Button variant="primary">Применить</Button><Button>Сбросить</Button><Button disabled>Недоступно</Button>
        <Button size="s">Малая</Button><Button size="l">Большая</Button>
      </Row>
      <H2>Переключатель</H2>
      <Row><Button pressed>Скелетоны</Button><Button>График</Button></Row>
      <H2>Ссылка-кнопка</H2>
      <Note>ButtonLink — переход, а не действие: тот же вид, что у Button (варианты и размеры), но &lt;a href&gt;; новая вкладка — target="_blank" с rel="noopener".</Note>
      <Row>
        <ButtonLink href="#/buttons" size="s">Перейти (малая)</ButtonLink><ButtonLink href="#/buttons">Перейти</ButtonLink>
        <ButtonLink href="#/buttons" variant="primary" target="_blank" rel="noopener">В новой вкладке</ButtonLink>
      </Row>
      <H2>Иконки</H2>
      <Row><IconButton label="Настройки"><Gear /></IconButton><IconButton label="Настройки" size="s"><Gear /></IconButton><IconButton label="Настройки" pressed><Gear /></IconButton></Row>
    </>
  )
}
