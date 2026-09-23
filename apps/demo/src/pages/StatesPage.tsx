import { useState } from 'react'
import { Button, EmptyState, ErrorState, ProgressBar, Skeleton, dimClass, useLoadingGate } from '@katran/ui'
import s from './Page.module.css'

export function StatesPage() {
  const [loading, setLoading] = useState(false)
  const show = useLoadingGate(loading)
  const simulate = (ms: number) => { setLoading(true); setTimeout(() => setLoading(false), ms) }
  return (
    <>
      <h1 className={s.h1}>Состояния</h1>
      <p className={s.note}>Скелетон показывается только если загрузка дольше 200 мс и держится не меньше 400 мс — быстрый ответ не мигает. Нажмите «100 мс» и «800 мс».</p>
      <div className={s.row}>
        <Button onClick={() => simulate(100)}>Загрузка 100 мс</Button><Button onClick={() => simulate(800)}>Загрузка 800 мс</Button>
        <span style={{ minWidth: 'var(--k-swatch)' }}>{show ? <Skeleton.Line lines={2} width="60%" /> : <span className={loading ? dimClass : ''}>Данные показаны</span>}</span>
      </div>
      <h2 className={s.h2}>Прогресс обновления</h2>
      <div className={s.row} style={{ display: 'block', padding: 0 }}><ProgressBar label="Обновление данных" /></div>
      <h2 className={s.h2}>Пусто и ошибка</h2>
      <div className={s.row}><EmptyState title="По заданным условиям документов нет" action={{ label: 'Сбросить фильтр', onClick: () => {} }} /></div>
      <div className={s.row}><ErrorState title="Не удалось загрузить реестр" text="Сервис не ответил за 10 с" retry={() => {}} /></div>
    </>
  )
}
