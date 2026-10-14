export { ED_BY_TYPE, ED_CODES, RUB_TYPES, TYPE_NAME, type RubDoc, type RubType } from './model/rubDoc'
export { rubAnnulPorts, rubDocPorts } from './api/ports'
/** Раскладка колонок реестра и стили своих элементов её ячеек (правило 2): страница монтирует RubCellStyles рядом с реестром. */
export { RubCellStyles, rubDocLayout } from './ui/layout'
export type { RubAgent, RubDocDetail, RubEd107, RubParty } from './model/detail'
export {
  ED107_GROUPS, RFIELDS, RSECTION_TITLE, RUB_ACTIONS, RUB_DETAIL_TITLE, RUB_OPERATION, RUB_PARTY, RUB_PROFILES, RUB_SECTIONS, RUB_TABS, rubSchemaOf,
  type RubFieldMeta, type RubSectionId,
} from './model/profiles'
export { parseRubDocDetail } from './api/detail.mapper'
export { RUB_DETAIL_EXAMPLE } from './api/detail.example'
export { rubBlock, rubDocDetailDomain, rubDocSummary, rubHero, rubRowSummary, rubSection, statusLabelOf } from './ui/detail'
