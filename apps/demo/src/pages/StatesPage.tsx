import { useState } from 'react'
import { Banner, Button, EmptyState, ErrorState, ProgressBar, Skeleton, dimClass, useLoadingGate } from '@katran/ui'
import { H1, H2, Note, Row } from './parts'

export function StatesPage() {
  const [loading, setLoading] = useState(false)
  const [shown, setShown] = useState(true)
  const show = useLoadingGate(loading)
  const simulate = (ms: number) => { setLoading(true); setTimeout(() => setLoading(false), ms) }
  return (
    <>
      <H1>Состояния</H1>
      <Note>Скелетон показывается только если загрузка дольше 200 мс и держится не меньше 400 мс — быстрый ответ не мигает. Нажмите «100 мс» и «800 мс».</Note>
      <Row>
        <Button onClick={() => simulate(100)}>Загрузка 100 мс</Button><Button onClick={() => simulate(800)}>Загрузка 800 мс</Button>
        <span style={{ minWidth: 'var(--k-swatch)' }}>{show ? <Skeleton.Line lines={2} width="60%" /> : <span className={loading ? dimClass : ''}>Данные показаны</span>}</span>
      </Row>
      <H2>Прогресс обновления</H2>
      <Row style={{ display: 'block', padding: 0 }}><ProgressBar label="Обновление данных" /></Row>
      <H2>Пусто и ошибка</H2>
      <Row><EmptyState title="По заданным условиям документов нет" action={{ label: 'Сбросить фильтр', onClick: () => {} }} /></Row>
      <Row><ErrorState title="Не удалось загрузить реестр" text="Сервис не ответил за 10 с" retry={() => {}} /></Row>
      <H2>Banner</H2>
      <Note>Плашка состояния во всю ширину: текст — в role="status", кнопки — вне него. По примеру на свойство.</Note>
      <Row style={{ display: 'grid', gap: 'var(--k-sp-2)' }}>
        <Banner tone="neutral">tone="neutral" — нейтральное сообщение</Banner>
        <Banner tone="warn">tone="warn" — запрос ожидает утверждения</Banner>
        <Banner tone="bad">tone="bad" — запрос отклонён</Banner>
        <Banner tone="ok">tone="ok" — документ аннулирован</Banner>
        <Banner tone="warn" actions={<><Button size="s">Утвердить</Button><Button size="s">Отклонить</Button></>}>actions — кнопки справа, вне статуса</Banner>
        {shown
          ? <Banner tone="bad" onClose={() => setShown(false)}>onClose — крестик «Закрыть»</Banner>
          : <Button onClick={() => setShown(true)}>Показать плашку снова</Button>}
        <Banner tone="neutral" onClose={() => undefined} closeLabel="Закрыть уведомление">closeLabel — подпись крестика «Закрыть уведомление»</Banner>
      </Row>
    </>
  )
}
