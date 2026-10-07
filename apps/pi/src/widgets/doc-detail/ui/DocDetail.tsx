import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useUnit } from 'effector-react'
import {
  Button, ConfigForm, Drawer, DrawerStack, ErrorState, IconButton, Input, LinkValue, Menu, Prompt, Skeleton, StatusDot, TabPanel, Tabs, Tag,
  useKatran, useLoadingGate, useStableId, type DrawerStackItem,
} from '@katran/ui'
import type {
  ActionsView, DecisionState, DetailAction, DetailDomain, DetailSummary, EditContext, PrintFormItem, RemoteTabView, TabContext,
} from '../../../shared/lib/detail'
import type { Detail, DetailSlot, TabSlot } from '../lib/createDetail'
import { ActionGlyph } from './icons'
import s from './DocDetail.module.css'

export type DocDetailProps<D, Row> = {
  detail: Detail<D>
  /** Всё доменное — схема, поля, вкладки и их виды, действия, блоки (спека 2a §4.3, 2b §3.3): виджет не импортирует сущности. */
  domain: DetailDomain<D, Row>
  /** Строка реестра по id — шапка и лейн до загрузки и при ошибке (номер, статус). */
  rowOf?: ((id: string) => Row | null) | undefined
  /** Куда вернуть фокус при закрытии: кнопка открытия записи, её нет — грид (gridFocusTarget кита). */
  returnFocus?: ((id: string) => HTMLElement | null) | undefined
  /**
   * Правка документа по id (план 2c §3.4): контекст уходит видам домена (renderHero/renderBlock, formEdit для ConfigForm),
   * его confirm — Prompt в слое overlay drawer этого документа. Нет — только просмотр, как в 2b.
   */
  editOf?: ((docId: string) => EditContext) | undefined
  /**
   * Действия лейна документа по id (план 2d §3.5): кнопки вызывают run, действие в полёте — кнопка недоступна, F5 — «Обновить»,
   * запасная ссылка — уведомление под лейном. Нет — действия объявляют себя заглушкой, как в 2a (демо кита).
   */
  actionsOf?: ((docId: string) => ActionsView) | undefined
}

type OnAction = (a: DetailAction, form?: PrintFormItem) => void

/** Действия среза 2e: у модели действий их нет — и при actionsOf объявление-заглушка 2a. */
const LATER = ['esid', 'ban']
/** Длина причины отклонения — REJECT_MAX правки (features/doc-edit; виджет features не импортирует). */
const REASON_MAX = 140
/** Цель keydown, где F5 остаётся браузеру: поле ввода (спека 2d §4 п. 4). */
const FIELD = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

function ActionButton({ action, onAction, pending }: { action: DetailAction; onAction: OnAction; pending: boolean }) {
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
        // запрос действия в полёте (скачать, печать, ссылка) — кнопка недоступна до ответа (спека 2d §4 п. 7)
        disabled={pending || undefined}
        aria-busy={pending || undefined}
        onClick={() => (menu ? setOpen(true) : onAction(action))}
      >
        <ActionGlyph icon={action.icon} />
      </IconButton>
      {menu && (
        <Menu open={open} anchor={ref} onClose={() => setOpen(false)} title={`${action.label} — печатная форма`}
          items={menu.map((f) => ({ id: f.form, label: f.label, onSelect: () => onAction(action, f) }))} />
      )}
    </>
  )
}

/** Лейн (эталон laneHtml, index.html:1034): тег типа, статус, «название · направление», действия; «Аннулировать» — за разделителем. */
function Lane({ summary, actions, onAction, pending }: {
  summary: DetailSummary | null
  actions: DetailAction[]
  onAction: OnAction
  pending: (actionId: string) => boolean
}) {
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
        {actions.map((a) => <ActionButton key={a.id} action={a} onAction={onAction} pending={pending(a.id)} />)}
      </div>
    </div>
  )
}

/**
 * Буфер обмена недоступен (план 2d §3.3): ссылка в поле только для чтения, выделена и в фокусе — Ctrl+C копирует её.
 * Закрытие возвращает фокус туда, где он был при появлении (кнопка «Скопировать ссылку»), если тот элемент ещё в DOM.
 */
function LinkFallback({ link, onClose }: { link: string; onClose: () => void }) {
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const before = document.activeElement
    field.current?.focus()
    field.current?.select()
    return () => {
      if (before instanceof HTMLElement && before.isConnected) before.focus()
    }
  }, [link])
  return (
    <div role="status" className={s.link} data-part="link-fallback">
      <Input ref={field} size="s" readOnly value={link} aria-label="Ссылка на документ" className={s.linkField} />
      <span className={s.linkHint}>Скопируйте ссылку: Ctrl+C</span>
      <Button size="s" onClick={onClose}>Закрыть</Button>
    </div>
  )
}

/**
 * Prompt решения второй руки (спека 2d §4 п. 1–2): утвердить — тело decisionNote домена; отклонить — плюс обязательное поле
 * «Причина» (до 140, счётчик в описании поля), «Отклонить» недоступна, пока причина пуста после trim. busy и error — модели.
 */
function DecisionPrompt({ decision, note, onResult, onReason }: {
  decision: DecisionState
  note: ReactNode
  onResult: (ok: boolean) => void
  onReason: (text: string) => void
}) {
  const reasonId = useStableId()
  const countId = useStableId()
  const reject = decision.kind === 'reject'
  return (
    <Prompt
      open
      title={reject ? 'Отклонить правку?' : 'Утвердить правку?'}
      note={note}
      okLabel={reject ? 'Отклонить' : 'Утвердить'}
      cancelLabel="Отмена"
      tone={reject ? 'danger' : 'neutral'}
      okDisabled={reject && decision.reason.trim() === ''}
      busy={decision.busy}
      error={decision.error ?? undefined}
      onResult={onResult}
    >
      {reject ? (
        <div className={s.reason}>
          <label htmlFor={reasonId} className={s.reasonLabel}>Причина</label>
          <textarea
            id={reasonId}
            className={s.reasonField}
            rows={3}
            maxLength={REASON_MAX}
            required
            // запрос в полёте — причину уже не меняют (модель тоже игнорирует ввод при busy)
            readOnly={decision.busy}
            aria-describedby={countId}
            value={decision.reason}
            onChange={(e) => onReason(e.target.value)}
          />
          <span id={countId} className={s.reasonCount}>{decision.reason.length}/{REASON_MAX}</span>
        </div>
      ) : undefined}
    </Prompt>
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

/** Скелетон нелокальной вкладки (эталон skeleton.js): полоса шапки таблицы и rows строк (у вида — skeletonRows, по умолчанию 4). */
function TabSkeleton({ rows }: { rows: number }) {
  return (
    <div className={s.skeleton} data-part="tab-skeleton" data-rows={rows} aria-busy="true">
      <span className={s.sr}>Загрузка вкладки</span>
      <Skeleton.Block height={22} />
      {Array.from({ length: rows }, (_, i) => <Skeleton.Block key={i} height={24} />)}
    </div>
  )
}

/** Вкладка без вида в домене: для fx/rub недостижимо (полноту tabViews проверяет страница), виджет — общий. */
function Stub({ label }: { label: string }) {
  return <div className={s.stub}>Вкладка «{label}» не подключена</div>
}

/**
 * Нелокальная вкладка (спека 2b §3.3): свои скелетон (порог и минимум — ворота кита, как у грида: не короче 400 мс),
 * ошибка с текстом ApiError и «Повторить», вид домена на готовых данных. Детали не касается.
 */
function RemoteBody({ tab, view, ctx, onRetry }: { tab: TabSlot; view: RemoteTabView; ctx: TabContext; onRetry: () => void }) {
  const skeleton = useLoadingGate(tab.state === 'loading')
  if (skeleton) return <TabSkeleton rows={view.skeletonRows ?? 4} />
  if (tab.state === 'error') return <ErrorState title="Не удалось загрузить вкладку" text={tab.error ?? undefined} retry={onRetry} />
  if (tab.state === 'loading') return null
  return <>{view.render(tab.data, ctx)}</>
}

const never = () => false

type BodyProps<D, Row> = {
  view: DetailSlot<D>
  domain: DetailDomain<D, Row>
  tabId: string
  tabLabel: string
  skeleton: boolean
  ctx: TabContext
  mainExpanded: string[] | undefined
  onMainExpanded: (keys: string[]) => void
  onRetry: () => void
  onRetryTab: () => void
  edit: EditContext | null
}

/** Содержимое панели. Монтируется только у активной вкладки (TabPanel), поэтому view.tabView — её состояние. */
function Body<D, Row>({ view, domain, tabId, tabLabel, skeleton, ctx, mainExpanded, onMainExpanded, onRetry, onRetryTab, edit }: BodyProps<D, Row>) {
  const first = tabId === domain.tabs[0]?.id
  const tv = first ? undefined : domain.tabViews?.[tabId]
  // нелокальная вкладка не зависит от загрузки детали: свой запрос, свои скелетон и ошибка
  if (tv?.kind === 'remote') return view.tabView ? <RemoteBody tab={view.tabView} view={tv} ctx={ctx} onRetry={onRetryTab} /> : <Stub label={tabLabel} />
  // ворота скелетона держат его минимум sk-min (400 мс, как у грида) — данные и ошибка до этого не показываются
  if (skeleton) return <FormSkeleton />
  if (view.state === 'error') return <ErrorState title="Не удалось загрузить документ" text={view.error ?? undefined} retry={onRetry} />
  const d = view.data
  if (d === null) return null
  if (tv?.kind === 'local') return <>{tv.render(d, ctx)}</>
  if (!first) return <Stub label={tabLabel} />
  const renderSection = domain.renderSection
  return (
    <ConfigForm
      schema={domain.schemaOf(d)}
      fields={domain.fields}
      value={(tag) => domain.value(d, tag)}
      present={domain.present}
      optionLabels={domain.optionLabels}
      renderHero={(id) => domain.renderHero(d, id, edit)}
      renderBlock={(id) => domain.renderBlock(d, id, edit)}
      renderSection={renderSection ? (id) => renderSection(d, id) : undefined}
      // M-g: раскрытое — в модели по `${id}:main`; до первого изменения undefined — форма берёт свои умолчания
      expanded={mainExpanded}
      onExpandedChange={onMainExpanded}
      edit={edit && domain.formEdit ? domain.formEdit(d, edit) : undefined}
    />
  )
}

type PaneProps<D, Row> = Omit<DocDetailProps<D, Row>, 'detail'> & { detail: Detail<D>; view: DetailSlot<D>; focusKey: number; quiet: boolean }

function DetailPane<D, Row>({ view, detail, domain, rowOf, returnFocus, editOf, actionsOf, focusKey, quiet }: PaneProps<D, Row>) {
  const [close, setTab, retry, retryTab, open, setExpanded, expanded] = useUnit([
    detail.close, detail.setTab, detail.retry, detail.retryTab, detail.open, detail.setExpanded, detail.$expanded,
  ])
  const { announce } = useKatran()
  const skeleton = useLoadingGate(view.state === 'loading')
  const edit = editOf?.(view.id) ?? null
  const actions = actionsOf?.(view.id) ?? null
  const row = view.data === null && rowOf ? rowOf(view.id) : null
  const summary = view.data !== null ? domain.summary(view.data) : row !== null ? domain.rowSummary(row) : null
  const label = summary?.label ?? domain.title
  const off = summary?.tabsOff ?? []
  const tabsId = `doc-detail-${view.slot}`
  const onAction: OnAction = (a, form) => {
    if (actions && !LATER.includes(a.id)) actions.run(a, form)
    else announce(form ? `${a.label}: ${form.label} · ${label}` : `${a.label} · ${label}`)
  }
  // один Prompt на документ: правки 2c (отмена черновика, дата валютирования) или решения второй руки
  const decision = edit?.confirm ? null : edit?.decision ?? null
  const overlay = edit?.confirm
    ? <Prompt open {...edit.confirm} onResult={edit.onConfirm} />
    : edit && decision
      ? (
        <DecisionPrompt
          decision={decision}
          note={view.data !== null ? domain.decisionNote?.(view.data, decision.target, decision.when) : undefined}
          onResult={edit.onDecision}
          onReason={edit.changeReason}
        />
      )
      : undefined
  const refresh = domain.actions.find((a) => a.id === 'refresh')
  // F5 — «Обновить» (спека 2d §4 п. 4): только чистое F5, не из поля ввода, без открытого редактора и Prompt документа
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'F5' || e.ctrlKey || e.altKey || e.shiftKey || e.metaKey || !actions || !refresh) return
    if (e.target instanceof Element && e.target.closest(FIELD) !== null) return
    if (edit && (edit.editing !== null || edit.confirm !== null || edit.decision !== null)) return
    e.preventDefault()
    actions.run(refresh)
  }
  const firstTab = domain.tabs[0]?.id ?? 'main'
  // M-f: вкладка, выбранная до загрузки (tabsOff строки реестра пуст), оказалась без данных — слот возвращается на первую.
  // Здесь, а не в модели: tabsOff — знание домена (summary), модель деталки домена не получает (решение Task 11, п. 5)
  const offActive = view.data !== null && off.includes(view.tab)
  useEffect(() => {
    if (offActive) setTab({ slot: view.slot, tab: firstTab })
  }, [offActive, view.slot, firstTab, setTab])
  const keyOf = (tab: string) => `${view.id}:${tab}`
  const ctxOf = (tab: string): TabContext => ({
    docId: view.id,
    // связанный документ — в B; уже открытый в любом слоте повторно не открывается, фокус в его drawer (правило 2a)
    openDocument: (id) => open({ id, secondary: true }),
    announce,
    expanded: expanded[keyOf(tab)] ?? null,
    setExpanded: (keys) => setExpanded({ id: view.id, tab, keys }),
  })
  return (
    <Drawer
      label={label}
      title={domain.title}
      meta={summary ? <><LinkValue name={summary.uuid} value={summary.uuid} /><span>{summary.created}</span></> : undefined}
      badge={view.slot === 'b' ? { text: 'B · сравнение', tone: 'b' } : { text: 'A', tone: 'a' }}
      onClose={() => close(view.slot)}
      returnFocus={returnFocus ? () => returnFocus(view.id) : undefined}
      focusKey={focusKey}
      // R10: автооткрытие (quiet) фокус не забирает — он остаётся в реестре, как на стенде
      initialFocus={!quiet}
      // Prompt этого документа (правка 2c или решение 2d) — поверх панели, только этого drawer
      overlay={overlay}
      onKeyDown={onKeyDown}
    >
      <div className={s.laneBox}>
        <Lane summary={summary} actions={domain.actions} onAction={onAction} pending={actions ? actions.pending : never} />
        {actions?.linkFallback && <LinkFallback link={actions.linkFallback} onClose={actions.closeLinkFallback} />}
      </div>
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
          <Body
            view={view}
            domain={domain}
            tabId={t.id}
            tabLabel={t.label}
            skeleton={skeleton}
            ctx={ctxOf(t.id)}
            mainExpanded={expanded[keyOf(t.id)]}
            onMainExpanded={(keys) => setExpanded({ id: view.id, tab: t.id, keys })}
            onRetry={() => retry(view.slot)}
            onRetryTab={() => retryTab(view.slot)}
            edit={edit}
          />
        </TabPanel>
      ))}
    </Drawer>
  )
}

/** Деталка документа (спека 2a §4.3, 2b §3.3): DrawerStack кита, в слоте — шапка, лейн, вкладки с переполнением и их виды. */
export function DocDetail<D, Row>({ detail, domain, rowOf, returnFocus, editOf, actionsOf }: DocDetailProps<D, Row>) {
  const [slots, focus, quiet, closeTop] = useUnit([detail.$slots, detail.$focus, detail.$quiet, detail.closeTop])
  const items: DrawerStackItem[] = []
  for (const slot of ['a', 'b'] as const) {
    const view = slots[slot]
    if (view) {
      items.push({
        key: view.id,
        slot,
        node: <DetailPane view={view} detail={detail} domain={domain} rowOf={rowOf} returnFocus={returnFocus} editOf={editOf} actionsOf={actionsOf} focusKey={focus[view.id] ?? 0} quiet={quiet[view.id] === true} />,
      })
    }
  }
  return <DrawerStack items={items} onEscape={closeTop} />
}
