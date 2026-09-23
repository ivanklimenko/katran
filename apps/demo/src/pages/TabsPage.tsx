import { useState } from 'react'
import { TabPanel, Tabs } from '@katran/ui'
import s from './Page.module.css'

const reg = [{ id: 'docs', label: 'Документы', count: 84 }, { id: 'archive', label: 'Архив документов' }, { id: 'research', label: 'Исследование' }]
const prio = [{ id: 'system', label: 'По системе-инициатору' }, { id: 'urgency', label: 'По срочности' }, { id: 'amount', label: 'По сумме' }, { id: 'threshold', label: 'Управление порогом' }]

export function TabsPage() {
  const [r, setR] = useState('docs')
  const [p, setP] = useState('urgency')
  return (
    <>
      <h1 className={s.h1}>Табы</h1>
      <p className={s.note}>Ручная активация: стрелки двигают фокус, Enter выбирает — переключение реестра грузит данные, и автоматика дёргала бы запросы. Горизонтальные — переключение реестров в одном блоке, вертикальные — группа близких справочников в одном федеративном блоке.</p>
      <h2 className={s.h2}>Горизонтальные</h2>
      <div className={s.row} style={{ display: 'block' }}>
        <Tabs id="reg" label="Разделы реестра" items={reg} value={r} onChange={setR} />
        {reg.map((it) => <TabPanel key={it.id} tabsId="reg" tabId={it.id} active={r === it.id}><p>Здесь будет реестр «{it.label}».</p></TabPanel>)}
      </div>
      <h2 className={s.h2}>Вертикальные</h2>
      <div className={s.row} style={{ display: 'flex', alignItems: 'stretch', padding: 0, gap: 0 }}>
        <Tabs id="prio" label="Управление приоритетами" items={prio} value={p} onChange={setP} orientation="vertical" />
        {prio.map((it) => <TabPanel key={it.id} tabsId="prio" tabId={it.id} active={p === it.id} className={s.content}><p>Справочник «{it.label}»: таблица порогов и весов.</p></TabPanel>)}
      </div>
    </>
  )
}
