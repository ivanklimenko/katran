import { Button, IconButton } from '@katran/ui'
import s from './Page.module.css'

const Gear = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2.5" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5 13 13M3 13l1.5-1.5M11.5 4.5 13 3" /></svg>

export function ButtonsPage() {
  return (
    <>
      <h1 className={s.h1}>Кнопки</h1>
      <p className={s.note}>Primary — одно главное действие на экран. Ghost — всё остальное. IconButton требует имя: у иконки текста нет.</p>
      <h2 className={s.h2}>Варианты и размеры</h2>
      <div className={s.row}>
        <Button variant="primary">Применить</Button><Button>Сбросить</Button><Button disabled>Недоступно</Button>
        <Button size="s">Малая</Button><Button size="l">Большая</Button>
      </div>
      <h2 className={s.h2}>Переключатель</h2>
      <div className={s.row}><Button pressed>Скелетоны</Button><Button>График</Button></div>
      <h2 className={s.h2}>Иконки</h2>
      <div className={s.row}><IconButton label="Настройки"><Gear /></IconButton><IconButton label="Настройки" size="s"><Gear /></IconButton><IconButton label="Настройки" pressed><Gear /></IconButton></div>
    </>
  )
}
