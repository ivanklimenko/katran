import styled from 'styled-components'
import { k } from '@katran/tokens'
import { Button, ButtonLink, Icon, IconButton, type IconName } from '@katran/ui'
import { H1, H2, Note, Row } from './parts'

const Gear = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2.5" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5 13 13M3 13l1.5-1.5M11.5 4.5 13 3" /></svg>

const iconNames = [
  'plus', 'edit', 'delete', 'alert', 'error', 'success', 'clock', 'search', 'info', 'doc', 'enter', 'drag',
  'arrow-up', 'arrow-down', 'monitoring', 'link', 'settings', 'check', 'refresh', 'copy', 'view-on',
  'show-menu', 'loading', 'stop', 'chevron-up', 'chevron-down', 'filter', 'cross', 'widget', 'clip-add',
] satisfies IconName[]

const Catalog = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(${k.swatch}, 1fr));
  gap: ${k.sp2};
  padding: ${k.sp3};
  margin: 0;
  list-style: none;
  border: 1px solid ${k.line};
  border-radius: ${k.rM};
  background: ${k.paper};
`

const Sample = styled.li`
  display: flex;
  align-items: center;
  gap: ${k.sp1};
  color: ${k.ink};
`

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
      <Row>
        <IconButton label="Настройки"><Gear /></IconButton>
        <IconButton label="Настройки" size="s"><Gear /></IconButton>
        <IconButton label="Настройки" pressed><Gear /></IconButton>
        <IconButton label="Редактировать" name="edit" />
      </Row>
      <H2>Каталог Icon (s и m)</H2>
      <Catalog>
        {iconNames.map((name) => (
          <Sample key={name}><Icon name={name} size="s" /><Icon name={name} /><code>{name}</code></Sample>
        ))}
      </Catalog>
    </>
  )
}
