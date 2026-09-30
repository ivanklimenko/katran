import { useRef, useState } from 'react'
import { useUnit } from 'effector-react'
import {
  ConfigForm, Drawer, DrawerStack, ErrorState, IconButton, LinkValue, Menu, Skeleton, StatusDot, TabPanel, Tabs, Tag,
  useKatran, useLoadingGate, type DrawerStackItem,
} from '@katran/ui'
import type { DetailAction, DetailDomain, DetailSummary } from '../../../shared/lib/detail'
import type { Detail, DetailSlot } from '../lib/createDetail'
import { ActionGlyph } from './icons'
import s from './DocDetail.module.css'

export type DocDetailProps<D, Row> = {
  detail: Detail<D>
  /** Всё доменное — схема, поля, вкладки, действия, блоки (спека 2a §4.3): виджет не импортирует сущности. */
  domain: DetailDomain<D, Row>
  /** Строка реестра по id — шапка и лейн до загрузки и при ошибке (номер, статус). */
  rowOf?: ((id: string) => Row | null) | undefined
  /** Куда вернуть фокус при закрытии: кнопка открытия записи, её нет — грид (gridFocusTarget кита). */
  returnFocus?: ((id: string) => HTMLElement | null) | undefined
}

type OnAction = (a: DetailAction, form?: string) => void

function ActionButton({ action, onAction }: { action: DetailAction; onAction: OnAction }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const menu = action.menu
  return (
    <>
      {action.danger && <span className={s.sep} aria-hidden="true" />}
      <IconButton
        ref={ref}
        label={action.label}
        data-k-tip={action.hotkey ? `${action.label} · ${action.hotkey}` : action.label}
        className={action.danger ? s.danger : undefined}
        aria-haspopup={menu ? 'menu' : undefined}
        aria-expanded={menu ? open : undefined}
        onClick={() => (menu ? setOpen(true) : onAction(action))}
      >
        <ActionGlyph icon={action.icon} />
      </IconButton>
      {menu && (
        <Menu open={open} anchor={ref} onClose={() => setOpen(false)} title={`${action.label} — печатная форма`}
          items={menu.map((f) => ({ id: f, label: f, onSelect: () => onAction(action, f) }))} />
      )}
    </>
  )
}

/** Лейн (эталон laneHtml, index.html:1034): тег типа, статус, «название · направление», действия; «Аннулировать» — за разделителем. */
function Lane({ summary, actions, onAction }: { summary: DetailSummary | null; actions: DetailAction[]; onAction: OnAction }) {
  return (
    <div className={s.lane} data-part="lane">
      {summary && (
        <>
          <Tag tone="mt">{summary.type}</Tag>
          <span className={s.status}><StatusDot tone={summary.status.tone} size="s" />{summary.status.label}</span>
          <span className={s.kind}>{summary.kind}</span>
        </>
      )}
      <div role="group" aria-label="Действия с документом" className={s.acts}>
        {actions.map((a) => <ActionButton key={a.id} action={a} onAction={onAction} />)}
      </div>
    </div>
  )
}

function FormSkeleton() {
  return (
    <div className={s.skeleton} data-part="skeleton" aria-busy="true">
      <span className={s.sr}>Загрузка документа</span>
      <Skeleton.Block height={44} />
      <Skeleton.Block height={60} />
      <Skeleton.Line lines={3} width="60%" />
      <Skeleton.Block height={120} />
    </div>
  )
}

type BodyProps<D, Row> = { view: DetailSlot<D>; domain: DetailDomain<D, Row>; skeleton: boolean; tabLabel: string; first: boolean; onRetry: () => void }

function Body<D, Row>({ view, domain, skeleton, tabLabel, first, onRetry }: BodyProps<D, Row>) {
  // ворота скелетона держат его минимум sk-min (400 мс, как у грида) — данные и ошибка до этого не показываются
  if (skeleton) return <FormSkeleton />
  if (view.state === 'error') return <ErrorState title="Не удалось загрузить документ" text={view.error ?? undefined} retry={onRetry} />
  const d = view.data
  if (d === null) return null
  if (!first) return <div className={s.stub}>Вкладка «{tabLabel}» — будет в срезе 2b</div>
  const renderSection = domain.renderSection
  return (
    <ConfigForm
      schema={domain.schemaOf(d)}
      fields={domain.fields}
      value={(tag) => domain.value(d, tag)}
      present={domain.present}
      optionLabels={domain.optionLabels}
      renderHero={(id) => domain.renderHero(d, id)}
      renderBlock={(id) => domain.renderBlock(d, id)}
      renderSection={renderSection ? (id) => renderSection(d, id) : undefined}
    />
  )
}

type PaneProps<D, Row> = Omit<DocDetailProps<D, Row>, 'detail'> & { detail: Detail<D>; view: DetailSlot<D>; focusKey: number }

function DetailPane<D, Row>({ view, detail, domain, rowOf, returnFocus, focusKey }: PaneProps<D, Row>) {
  const [close, setTab, retry] = useUnit([detail.close, detail.setTab, detail.retry])
  const { announce } = useKatran()
  const skeleton = useLoadingGate(view.state === 'loading')
  const row = view.data === null && rowOf ? rowOf(view.id) : null
  const summary = view.data !== null ? domain.summary(view.data) : row !== null ? domain.rowSummary(row) : null
  const label = summary?.label ?? domain.title
  const off = summary?.tabsOff ?? []
  const tabsId = `doc-detail-${view.slot}`
  const onAction: OnAction = (a, form) => announce(form ? `${a.label}: ${form} · ${label}` : `${a.label} · ${label}`)
  const tabLabel = domain.tabs.find((t) => t.id === view.tab)?.label ?? view.tab
  return (
    <Drawer
      label={label}
      title={domain.title}
      meta={summary ? <><LinkValue name={summary.uuid} value={summary.uuid} /><span>{summary.created}</span></> : undefined}
      badge={view.slot === 'b' ? { text: 'B · сравнение', tone: 'b' } : { text: 'A', tone: 'a' }}
      onClose={() => close(view.slot)}
      returnFocus={returnFocus ? () => returnFocus(view.id) : undefined}
      focusKey={focusKey}
    >
      <Lane summary={summary} actions={domain.actions} onAction={onAction} />
      <div className={s.tabs} data-part="tabs">
        <Tabs
          id={tabsId}
          label="Разделы документа"
          variant="line"
          overflow
          value={view.tab}
          onChange={(tab) => setTab({ slot: view.slot, tab })}
          items={domain.tabs.map((t) => ({ id: t.id, label: t.label, disabled: off.includes(t.id), hint: off.includes(t.id) ? 'Нет данных' : undefined }))}
        />
      </div>
      {domain.tabs.map((t) => (
        <TabPanel key={t.id} tabsId={tabsId} tabId={t.id} active={t.id === view.tab} className={s.body}>
          <Body view={view} domain={domain} skeleton={skeleton} tabLabel={tabLabel} first={t.id === domain.tabs[0]?.id} onRetry={() => retry(view.slot)} />
        </TabPanel>
      ))}
    </Drawer>
  )
}

/** Деталка документа (спека 2a §4.3): DrawerStack кита, в слоте — шапка, лейн, вкладки с переполнением, «Общие данные» по схеме. */
export function DocDetail<D, Row>({ detail, domain, rowOf, returnFocus }: DocDetailProps<D, Row>) {
  const [slots, focus, closeTop] = useUnit([detail.$slots, detail.$focus, detail.closeTop])
  const items: DrawerStackItem[] = []
  for (const slot of ['a', 'b'] as const) {
    const view = slots[slot]
    if (view) {
      items.push({
        key: view.id,
        slot,
        node: <DetailPane view={view} detail={detail} domain={domain} rowOf={rowOf} returnFocus={returnFocus} focusKey={focus[view.id] ?? 0} />,
      })
    }
  }
  return <DrawerStack items={items} onEscape={closeTop} />
}
