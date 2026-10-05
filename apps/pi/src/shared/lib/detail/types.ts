import type { ReactNode } from 'react'
import type { FieldDef, FieldPresenter, FieldValue, FormSchema, HeroCell, SectionContent, StatusTone } from '@katran/ui'

/** Вкладка деталки (эталон TABS/TAB_KEY, index.html:647–648). */
export type DetailTab = { id: string; label: string }
/** Иконка действия лейна — ключ набора widgets/doc-detail. */
export type ActionIcon = 'refresh' | 'edit' | 'doc' | 'download' | 'print' | 'link' | 'ban'
/** Действие лейна (эталон ACTIONS, index.html:729): в 2a — заглушка с объявлением; menu — печатные формы. */
export type DetailAction = {
  id: string
  label: string
  icon: ActionIcon
  /** Горячая клавиша — только в подсказке (привязка — вместе с настоящими действиями, 2d). */
  hotkey?: string | undefined
  menu?: string[] | undefined
  /** За разделителем, красное при наведении («Аннулировать»). */
  danger?: boolean | undefined
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
  renderHero: (d: D, id: string) => HeroCell
  renderBlock: (d: D, id: string) => ReactNode
  renderSection?: ((d: D, id: string) => SectionContent) | undefined
  /** Виды вкладок по id (спека 2b §3.3); нет вида — вкладка показывает заглушку 2a. */
  tabViews?: Record<string, TabView<D>> | undefined
}
