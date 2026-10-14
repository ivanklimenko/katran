import { useState } from 'react'
import styled from 'styled-components'
import { k } from '@katran/tokens'
import { TabPanel, Tabs } from '@katran/ui'
import { H1, H2, Note, Row } from './parts'

/* Панель вертикальных табов растягивается на остаток рамки */
const PrioPanel = styled(TabPanel)`
  padding: ${k.sp4};
  flex: 1;
`

const reg = [{ id: 'docs', label: 'Документы', count: 84 }, { id: 'archive', label: 'Архив документов' }, { id: 'research', label: 'Исследование' }]
const prio = [{ id: 'system', label: 'По системе-инициатору' }, { id: 'urgency', label: 'По срочности' }, { id: 'amount', label: 'По сумме' }, { id: 'threshold', label: 'Управление порогом' }]

export function TabsPage() {
  const [r, setR] = useState('docs')
  const [p, setP] = useState('urgency')
  return (
    <>
      <H1>Табы</H1>
      <Note>Ручная активация: стрелки двигают фокус, Enter выбирает — переключение реестра грузит данные, и автоматика дёргала бы запросы. Горизонтальные — переключение реестров в одном блоке, вертикальные — группа близких справочников в одном федеративном блоке.</Note>
      <H2>Горизонтальные</H2>
      <Row style={{ display: 'block' }}>
        <Tabs id="reg" label="Разделы реестра" items={reg} value={r} onChange={setR} />
        {reg.map((it) => <TabPanel key={it.id} tabsId="reg" tabId={it.id} active={r === it.id}><p>Здесь будет реестр «{it.label}».</p></TabPanel>)}
      </Row>
      <H2>Вертикальные</H2>
      <Row style={{ display: 'flex', alignItems: 'stretch', padding: 0, gap: 0 }}>
        <Tabs id="prio" label="Управление приоритетами" items={prio} value={p} onChange={setP} orientation="vertical" />
        {prio.map((it) => <PrioPanel key={it.id} tabsId="prio" tabId={it.id} active={p === it.id}><p>Справочник «{it.label}»: таблица порогов и весов.</p></PrioPanel>)}
      </Row>
    </>
  )
}
