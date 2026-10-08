import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useUnit } from 'effector-react'
import {
  Button, ConfigForm, Drawer, DrawerStack, ErrorState, IconButton, Input, LinkValue, Menu, Prompt, Skeleton, StatusDot, TabPanel, Tabs, Tag,
  useKatran, useLoadingGate, useStableId, type DrawerStackItem,
} from '@katran/ui'
import {
  type ActionNotice, type ActionsView, type AnnulLane, type AnnulView, type DecisionState, type DetailAction, type DetailDomain, type DetailLookups, type DetailSummary, type EditContext,
  type NotifView, type PrintFormItem, type RemoteTabView, type TabContext,
} from '../../../shared/lib/detail'
import { ReasonField } from '../../../shared/ui'
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
  /**
   * Справочные запросы документа по id (спека 2e §3.5): «Курс», «Проверить баланс» — четвёртым аргументом renderHero/renderBlock
   * домена, виды сущностей рисуют по нему кнопки-ссылки и поповеры. Нет — null, ссылок нет (демо кита).
   */
  lookupsOf?: ((docId: string) => DetailLookups) | undefined
  /**
   * Аннулирование документа по id (спека 2e §3.5): кнопка лейна «Аннулировать» — состояние и запуск из lane по annulInfo домена,
   * плашка запроса — между лейном и вкладками, Prompt — в слое overlay drawer этого документа. Нет — «Аннулировать» объявляет себя заглушкой.
   */
  annulOf?: ((docId: string) => AnnulView) | undefined
  /**
   * Нотификации документа по id (спека 2e §3.5): переотправка и окно «Исходное сообщение» — полями resend, resendBusy, openMessage
   * TabContext вкладок. Нет — полей нет, вкладка «Нотификации» ведёт себя как в 2b (объявление-заглушка).
   */
  notifOf?: ((docId: string) => NotifView) | undefined
}

type OnAction = (a: DetailAction, form?: PrintFormItem) => void

/** Действие без модели (служебный документ): и при actionsOf — объявление-заглушка. «Аннулировать» — своя модель (annulOf). */
const LATER = ['esid']
/** Объявление действия без модели при actionsOf — тот же текст, что у заглушек вкладок истории (entities/doc-trail STUB). */
const LANE_STUB = 'Действие пока недоступно'
/**
 * Цель keydown, где F5 остаётся браузеру: поле ввода (спека 2d §4 п. 4). Поле только для чтения (запасная ссылка) — не ввод:
 * F5 в нём — «Обновить», а не перезагрузка страницы с потерей открытых деталок (финальное ревью 2d, I3).
 */
const FIELD = 'input:not([readonly]), textarea:not([readonly]), select, [contenteditable]:not([contenteditable="false"])'
/** Подсказка запасной ссылки — видимая и описание поля. */
const LINK_HINT = 'Скопируйте ссылку: Ctrl+C'

/** Состояние кнопки лейна: запрос в полёте (aria-busy), недоступна (aria-disabled), подсказка вместо подписи. */
type ButtonState = { pending: boolean; off: boolean; hint: string | null }
const FREE: ButtonState = { pending: false, off: false, hint: null }

function ActionButton({ action, onAction, state }: { action: DetailAction; onAction: OnAction; state: ButtonState }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const menu = action.menu
  const { pending, hint } = state
  const off = pending || state.off
  return (
    <>
      {action.danger && <span className={s.sep} aria-hidden="true" />}
      <IconButton
        ref={ref}
        label={action.label}
        // недоступная с причиной («Аннулировать», спека 2e §4 п. 1) — подсказка причины
        data-k-tip={hint ?? (action.hotkey ? `${action.label} · ${action.hotkey}` : action.label)}
        className={action.danger ? s.danger : undefined}
        aria-haspopup={menu ? 'menu' : undefined}
        aria-expanded={menu ? open : undefined}
        // запрос действия в полёте (скачать, печать, ссылка) — кнопка недоступна до ответа (спека 2d §4 п. 7):
        // aria-disabled, а не disabled — Chromium снимает фокус с отключённой кнопки в body (F5 деталки и место клавиатуры
        // терялись, Ruling R19); клик в полёте и по недоступной игнорируется
        aria-disabled={off || undefined}
        aria-busy={pending || undefined}
        onClick={() => {
          if (off) return
          if (menu) setOpen(true)
          else onAction(action)
        }}
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
function Lane({ summary, actions, onAction, stateOf }: {
  summary: DetailSummary | null
  actions: DetailAction[]
  onAction: OnAction
  stateOf: (actionId: string) => ButtonState
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
        {actions.map((a) => <ActionButton key={a.id} action={a} onAction={onAction} state={stateOf(a.id)} />)}
      </div>
    </div>
  )
}

/**
 * Буфер обмена недоступен (план 2d §3.3): ссылка в поле только для чтения, выделена и в фокусе — Ctrl+C копирует её.
 * Группа, а не живая область (в ней поле и кнопка): появление объявляется отдельно. Esc в группе закрывает её, а не деталку
 * (data-k-edit — свой Esc для DrawerStack кита). Закрытие возвращает фокус туда, где он был при появлении (кнопка
 * «Скопировать ссылку»), если тот элемент ещё в DOM.
 */
function LinkFallback({ link, onClose }: { link: string; onClose: () => void }) {
  const field = useRef<HTMLInputElement>(null)
  const hintId = useStableId()
  const { announce } = useKatran()
  useEffect(() => {
    const before = document.activeElement
    field.current?.focus()
    field.current?.select()
    announce(`Буфер обмена недоступен. ${LINK_HINT}`)
    return () => {
      if (before instanceof HTMLElement && before.isConnected) before.focus()
    }
  }, [link, announce])
  // Esc на поле и на кнопке (других фокусируемых в группе нет) — закрыть ссылку
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    onClose()
  }
  return (
    <div role="group" aria-label="Ссылка на документ" className={s.link} data-part="link-fallback" data-k-edit="">
      <Input ref={field} size="s" readOnly value={link} aria-label="Ссылка на документ" aria-describedby={hintId} className={s.linkField}
        onKeyDown={onKeyDown} />
      <span id={hintId} className={s.linkHint}>{LINK_HINT}</span>
      <Button size="s" aria-label="Закрыть ссылку" onClick={onClose} onKeyDown={onKeyDown}>Закрыть</Button>
    </div>
  )
}

/**
 * Уведомление действия под лейном (спека 2d §4 п. 7): текст отказа (detail Problem как есть) или успеха. Объявляет модель —
 * своей живой области у него нет (иначе текст прозвучал бы дважды); успех модель скрывает сама, отказ — по «Закрыть».
 */
function ActionNoticeBar({ notice, onClose }: { notice: ActionNotice; onClose: () => void }) {
  return (
    <div className={s.notice} data-part="action-notice" data-tone={notice.tone}>
      <span className={s.noticeText}>{notice.text}</span>
      <Button size="s" aria-label="Закрыть уведомление" onClick={onClose}>Закрыть</Button>
    </div>
  )
}

/**
 * Prompt решения второй руки (спека 2d §4 п. 1–2): утвердить — тело decisionNote домена; отклонить — плюс обязательное поле
 * «Причина» (ReasonField: до 140, счётчик в описании поля), «Отклонить» недоступна, пока причина пуста после trim. busy и error — модели.
 */
function DecisionPrompt({ decision, note, onResult, onReason, fallbackFocus }: {
  decision: DecisionState
  note: ReactNode
  onResult: (ok: boolean) => void
  onReason: (text: string) => void
  /** Кнопка решения пропала вместе с решённой правкой — фокус на карандаш цели или заголовок drawer (Ruling R19). */
  fallbackFocus: () => HTMLElement | null
}) {
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
      fallbackFocus={fallbackFocus}
    >
      {reject ? <ReasonField value={decision.reason} busy={decision.busy} onChange={onReason} /> : undefined}
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
  lookups: DetailLookups | null
}

/** Содержимое панели. Монтируется только у активной вкладки (TabPanel), поэтому view.tabView — её состояние. */
function Body<D, Row>({ view, domain, tabId, tabLabel, skeleton, ctx, mainExpanded, onMainExpanded, onRetry, onRetryTab, edit, lookups }: BodyProps<D, Row>) {
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
      renderHero={(id) => domain.renderHero(d, id, edit, lookups)}
      renderBlock={(id) => domain.renderBlock(d, id, edit, lookups)}
      renderSection={renderSection ? (id) => renderSection(d, id) : undefined}
      // M-g: раскрытое — в модели по `${id}:main`; до первого изменения undefined — форма берёт свои умолчания
      expanded={mainExpanded}
      onExpandedChange={onMainExpanded}
      edit={edit && domain.formEdit ? domain.formEdit(d, edit) : undefined}
    />
  )
}

type PaneProps<D, Row> = Omit<DocDetailProps<D, Row>, 'detail'> & { detail: Detail<D>; view: DetailSlot<D>; focusKey: number; quiet: boolean }

function DetailPane<D, Row>({ view, detail, domain, rowOf, returnFocus, editOf, actionsOf, lookupsOf, annulOf, notifOf, focusKey, quiet }: PaneProps<D, Row>) {
  const [close, setTab, retry, retryTab, open, setExpanded, expanded] = useUnit([
    detail.close, detail.setTab, detail.retry, detail.retryTab, detail.open, detail.setExpanded, detail.$expanded,
  ])
  const { announce } = useKatran()
  const skeleton = useLoadingGate(view.state === 'loading')
  const edit = editOf?.(view.id) ?? null
  const actions = actionsOf?.(view.id) ?? null
  const lookups = lookupsOf?.(view.id) ?? null
  const annul = annulOf?.(view.id) ?? null
  const notif = notifOf?.(view.id) ?? null
  // доменное для аннулирования — из загруженной детали; до загрузки и при ошибке — null (кнопка недоступна, плашки нет)
  const annulInfo = view.data !== null && domain.annulInfo ? domain.annulInfo(view.data) : null
  const lane: AnnulLane | null = annul ? annul.lane(annulInfo) : null
  // «плашка отклонённого запроса закрыта» — состояние drawer по ключу id + annul.when: новый запрос снова виден,
  // закрытие деталки (размонтирование drawer) сбрасывает (спека 2e §3.5)
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const bannerKey = annulInfo?.annul ? `${view.id}:${annulInfo.annul.when}` : null
  const laneBox = useRef<HTMLDivElement>(null)
  // «Закрыть» пропала вместе с плашкой — фокус из body на заголовок своего drawer (Ruling R19)
  useEffect(() => {
    if (dismissedKey === null) return
    const at = document.activeElement
    if (at === null || at === document.body) laneBox.current?.closest<HTMLElement>('[data-k-drawer]')?.querySelector<HTMLElement>('h2[tabindex]')?.focus()
  }, [dismissedKey])
  const banner = annul && annulInfo ? annul.banner(annulInfo, bannerKey !== null && bannerKey === dismissedKey, () => setDismissedKey(bannerKey)) : null
  const annulPrompt = annul ? annul.prompt(annulInfo) : null
  const row = view.data === null && rowOf ? rowOf(view.id) : null
  const summary = view.data !== null ? domain.summary(view.data) : row !== null ? domain.rowSummary(row) : null
  const label = summary?.label ?? domain.title
  const off = summary?.tabsOff ?? []
  const tabsId = `doc-detail-${view.slot}`
  const onAction: OnAction = (a, form) => {
    if (a.id === 'ban' && lane) {
      if (!lane.disabled) lane.run()
    } else if (actions && a.id !== 'ban' && !LATER.includes(a.id)) actions.run(a, form)
    // действие без модели: при actionsOf — заглушка 2e, без него — объявление 2a (демо кита)
    else announce(actions ? LANE_STUB : form ? `${a.label}: ${form.label} · ${label}` : `${a.label} · ${label}`)
  }
  const stateOf = (actionId: string): ButtonState => {
    if (actionId === 'ban' && lane) return { pending: lane.busy, off: lane.disabled, hint: lane.disabled ? lane.hint : null }
    return actions ? { ...FREE, pending: actions.pending(actionId) } : FREE
  }
  // один Prompt на документ: правки 2c (отмена черновика, дата валютирования), решения второй руки или аннулирования
  // (правка и аннулирование документа взаимно блокируются моделями — вместе не открываются)
  const decision = edit?.confirm ? null : edit?.decision ?? null
  // в момент закрытия Prompt: карандаш цели (домен), иначе заголовок drawer — фокус не уходит в body (Ruling R19)
  const decisionFocus = (target: string): HTMLElement | null => {
    const root = laneBox.current?.closest<HTMLElement>('[data-k-drawer]') ?? null
    if (!root) return null
    return domain.decisionFocus?.(root, target) ?? root.querySelector<HTMLElement>('h2[tabindex]')
  }
  const overlay = edit?.confirm
    ? <Prompt open {...edit.confirm} onResult={edit.onConfirm} />
    : edit && decision
      ? (
        <DecisionPrompt
          decision={decision}
          note={view.data !== null ? domain.decisionNote?.(view.data, decision.target, decision.when) : undefined}
          onResult={edit.onDecision}
          onReason={edit.changeReason}
          fallbackFocus={() => decisionFocus(decision.target)}
        />
      )
      : annulPrompt ?? undefined
  const refresh = domain.actions.find((a) => a.id === 'refresh')
  // F5 — «Обновить» (спека 2d §4 п. 4): только чистое F5, не из поля ввода, без открытого редактора и Prompt документа (правки и аннулирования)
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'F5' || e.ctrlKey || e.altKey || e.shiftKey || e.metaKey || !actions || !refresh) return
    if (e.target instanceof Element && e.target.closest(FIELD) !== null) return
    if (edit && (edit.editing !== null || edit.confirm !== null || edit.decision !== null)) return
    if (annulPrompt !== null && annulPrompt !== undefined) return
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
    // нотификации (срез 2e) — только если страница передала notifOf
    ...(notif ? { resend: notif.resend, resendBusy: notif.resendBusy, openMessage: notif.openMessage } : {}),
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
      // Prompt этого документа (правка 2c, решение 2d, аннулирование 2e) — поверх панели, только этого drawer
      overlay={overlay}
      onKeyDown={onKeyDown}
    >
      <div ref={laneBox} className={s.laneBox}>
        <Lane summary={summary} actions={domain.actions} onAction={onAction} stateOf={stateOf} />
        {/* плашка запроса на аннулирование — под лейном, над вкладками (спека 2e §4 п. 4); уведомления действий — поверх под ней */}
        {banner !== null && banner !== undefined && <div className={s.annul} data-part="annul-banner">{banner}</div>}
        {actions && (actions.linkFallback || actions.notice) && (
          <div className={s.under}>
            {actions.notice && <ActionNoticeBar notice={actions.notice} onClose={actions.closeNotice} />}
            {actions.linkFallback && <LinkFallback link={actions.linkFallback} onClose={actions.closeLinkFallback} />}
          </div>
        )}
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
            lookups={lookups}
          />
        </TabPanel>
      ))}
    </Drawer>
  )
}

/** Деталка документа (спека 2a §4.3, 2b §3.3): DrawerStack кита, в слоте — шапка, лейн, вкладки с переполнением и их виды. */
export function DocDetail<D, Row>({ detail, domain, rowOf, returnFocus, editOf, actionsOf, lookupsOf, annulOf, notifOf }: DocDetailProps<D, Row>) {
  const [slots, focus, quiet, closeTop] = useUnit([detail.$slots, detail.$focus, detail.$quiet, detail.closeTop])
  const items: DrawerStackItem[] = []
  for (const slot of ['a', 'b'] as const) {
    const view = slots[slot]
    if (view) {
      items.push({
        key: view.id,
        slot,
        node: <DetailPane view={view} detail={detail} domain={domain} rowOf={rowOf} returnFocus={returnFocus} editOf={editOf} actionsOf={actionsOf} lookupsOf={lookupsOf} annulOf={annulOf} notifOf={notifOf} focusKey={focus[view.id] ?? 0} quiet={quiet[view.id] === true} />,
      })
    }
  }
  return <DrawerStack items={items} onEscape={closeTop} />
}
