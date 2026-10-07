import type { ReactNode } from 'react'
import type { DrawerOpen, DrawerSlot } from '@katran/effector'
import type { FieldDef, FieldPresenter, FieldValue, FormEdit, FormSchema, HeroCell, PromptTone, SectionContent, StatusTone } from '@katran/ui'
import type { AccountItem, AccountSide, EditValue } from '../../api'

/** Вкладка деталки (эталон TABS/TAB_KEY, index.html:647–648). */
export type DetailTab = { id: string; label: string }
/** Иконка действия лейна — ключ набора widgets/doc-detail; 'edit' ушла вместе с «Редактировать» (спека 2d §3.4). */
export type ActionIcon = 'refresh' | 'doc' | 'download' | 'print' | 'link' | 'ban'
/** Пункт меню печати: подпись и код формы — сегмент пути GET …/print/{form} (план 2d, «Коды печатных форм»). */
export type PrintFormItem = { label: string; form: string }
/** Действие лейна (эталон ACTIONS, index.html:729): в 2a — заглушка с объявлением; menu — печатные формы. */
export type DetailAction = {
  id: string
  label: string
  icon: ActionIcon
  /** Горячая клавиша — только в подсказке (привязка — вместе с настоящими действиями, 2d). */
  hotkey?: string | undefined
  menu?: PrintFormItem[] | undefined
  /** За разделителем, красное при наведении («Аннулировать»). */
  danger?: boolean | undefined
}
/**
 * Действия лейна документа для виджета (план 2d §3.3): виджет не знает о модели действий, получает вид своего документа.
 * run — по id действия (refresh, link, down, print с формой; esid и ban — срез 2e, без действия); pending — действие в полёте
 * (кнопка недоступна).
 */
export type ActionsView = {
  run: (action: DetailAction, form?: PrintFormItem | undefined) => void
  pending: (actionId: string) => boolean
  /** Буфер обмена недоступен — ссылку показать для ручного копирования. */
  linkFallback: string | null
  closeLinkFallback: () => void
}
/** Шапка и лейн деталки: из загруженной детали или, до загрузки и при ошибке, из строки реестра (спека 2a §4.3). */
export type DetailSummary = {
  /** Доступное имя drawer: «Платёжная инструкция № 812345». */
  label: string
  uuid: string
  /** Дата создания, отформатированная. */
  created: string
  /** Тег типа в лейне: MT103, PAYDOCRU. */
  type: string
  status: { tone: StatusTone; label: string }
  /** «Клиентский перевод · Входящий от ЦБ». */
  kind: string
  /** Вкладки без данных — вторая группа полосы; до загрузки — пусто. */
  tabsOff: string[]
}
/** Контекст вида вкладки (спека 2b §3.3): что вкладка может сделать, не зная о виджете. */
export type TabContext = {
  /** id открытого документа — «ID платёжной инструкции» в «Комплаенсе». */
  docId: string
  /** Открыть документ в B (DrawerOpen { id, secondary: true }) — ID связанного документа. */
  openDocument: (id: string) => void
  announce: (message: string) => void
  /** Раскрытые ключи вкладки этого документа; null — пользователь не трогал: вид берёт свои умолчания. */
  expanded: string[] | null
  setExpanded: (keys: string[]) => void
}
/** Вкладка на данных детали («Общие», «Доп. поля») — без запроса. */
export type LocalTabView<D> = { kind: 'local'; render: (detail: D, ctx: TabContext) => ReactNode }
/** Вкладка со своим запросом (tabFx): data — результат parseTab того же id. */
export type RemoteTabView = {
  kind: 'remote'
  render: (data: unknown, ctx: TabContext) => ReactNode
  /** Строк скелетона: по умолчанию 4, у «Задач» 5 (эталон SK.tabBody). */
  skeletonRows?: number | undefined
}
export type TabView<D> = LocalTabView<D> | RemoteTabView
/** Всё доменное, что виджет деталки получает от сущности (спека 2a §4.3): widgets/doc-detail не импортирует entities. */
export type DetailDomain<D, Row> = {
  /** Заголовок шапки: «Платёжная инструкция». */
  title: string
  tabs: DetailTab[]
  actions: DetailAction[]
  fields: Record<string, FieldDef>
  optionLabels?: Record<string, string> | undefined
  present?: FieldPresenter | undefined
  schemaOf: (d: D) => FormSchema
  value: (d: D, tag: string) => FieldValue | null
  summary: (d: D) => DetailSummary
  rowSummary: (row: Row) => DetailSummary
  /** edit — правка этого документа (план 2c); нет (null или не передан) — только просмотр, как в 2b. Функции с двумя параметрами (рубль) совместимы. */
  renderHero: (d: D, id: string, edit?: EditContext | null) => HeroCell
  renderBlock: (d: D, id: string, edit?: EditContext | null) => ReactNode
  renderSection?: ((d: D, id: string) => SectionContent) | undefined
  /** Виды вкладок по id (спека 2b §3.3); нет вида — вкладка показывает заглушку 2a. */
  tabViews?: Record<string, TabView<D>> | undefined
  /** Правка полей «Общих данных» в ConfigForm (план 2c); нет — поля только для просмотра. */
  formEdit?: ((d: D, edit: EditContext) => FormEdit) | undefined
  /** Тело Prompt решения (план 2d): подпись цели, «было → стало» (PromptChange), автор и время записи; when — ISO записи, как с бека. */
  decisionNote?: ((d: D, target: string, when: string) => ReactNode) | undefined
}

/**
 * Уход из документа, который ждёт ответа на «Отменить правку?» (план 2c, Р6): закрыть слот или открыть другой документ.
 * refresh (план 2d) — «Обновить» поверх правки: деталь не уходит, leave его игнорирует, перезапрос делает refreshDoc страницы.
 */
export type LeaveIntent = { kind: 'close'; slot: DrawerSlot } | { kind: 'open'; open: DrawerOpen } | { kind: 'refresh'; id: string }
/** Справочник счетов стороны документа: null у EditContext.accounts — ещё не запрашивался. */
export type AccountsSlot = { state: 'loading' | 'ready' | 'error'; items: AccountItem[]; error: string | null }
/** Текст Prompt правки (отмена черновика, подтверждение даты валютирования) — ложится на PromptProps кита. */
export type EditConfirmView = { title: string; note?: ReactNode | undefined; okLabel: string; cancelLabel: string; tone: PromptTone }
/** Решение второй руки по чужой правке (план 2d §3.3). */
export type DecisionKind = 'confirm' | 'reject'
/** Prompt решения документа: цель и время записи правки, причина отклонения, запрос в полёте, текст отказа. */
export type DecisionState = { kind: DecisionKind; target: string; when: string; reason: string; busy: boolean; error: string | null }
/** Правка одного документа для видов сущности (план 2c §3.2): состояние редактора и команды, без знания о модели. */
export type EditContext = {
  docId: string
  /** Цель открытого редактора в этом документе ('field:57', 'refOut', 'accKt', 'valueDate'), иначе null. */
  editing: string | null
  draft: EditValue | null
  /** Ошибка валидации черновика. */
  error: string | null
  saving: boolean
  saveError: string | null
  /** Prompt этого документа — его рисует DocDetail в Drawer.overlay. */
  confirm: EditConfirmView | null
  onConfirm: (ok: boolean) => void
  open: (target: string, current: EditValue) => void
  change: (draft: EditValue) => void
  cancel: () => void
  save: () => void
  /** ↺: сохранение «стало = исходное» без редактора. */
  revert: (target: string, current: EditValue, original: EditValue) => void
  /** null — ещё не запрашивались. */
  accounts: (side: AccountSide) => AccountsSlot | null
  retryAccounts: (side: AccountSide) => void
  /** Prompt решения этого документа (утвердить/отклонить чужую правку), иначе null. */
  decision: DecisionState | null
  /** Можно ли сейчас решать по цели: canConfirm цели && нет открытого редактора документа && нет decision && не saving. */
  canDecide: (target: string, canConfirm: boolean) => boolean
  /** «Утвердить» у записи правки цели (when — время записи) — Prompt решения. */
  confirmEdit: (target: string, when: string) => void
  /** «Отклонить» у записи правки цели — Prompt решения с полем «Причина». */
  rejectEdit: (target: string, when: string) => void
  changeReason: (text: string) => void
  /** Ответ Prompt решения: true — запрос, false — закрыть (при запросе в полёте игнорируется). */
  onDecision: (ok: boolean) => void
}
