// Справочники правки — со стенда pi-constructor@e065bfb дословно (обезличен; данные вымышленные).

/** Счёт справочника стенда: acc — номер (в контракте — account), ccy — валюта, kind — вид. */
export type FakeAccount = { acc: string; ccy: string; kind: string }

/** Счета Кт — «Карточка клиента» (CLIENT_ACCOUNTS, index.html:671–678): фильтр по валюте документа. */
export const CLIENT_ACCOUNTS: readonly FakeAccount[] = [
  { acc: '40817840100050017762', ccy: 'USD', kind: 'Текущий' }, { acc: '40817840400050017763', ccy: 'USD', kind: 'Текущий' },
  { acc: '40820840700050017764', ccy: 'USD', kind: 'Текущий (нерез.)' }, { acc: '42301840200050017765', ccy: 'USD', kind: 'Депозит' },
  { acc: '40817840500050017766', ccy: 'USD', kind: 'Транзитный' }, { acc: '47422840800050017767', ccy: 'USD', kind: 'Конверсионный' },
  { acc: '40817978100050017768', ccy: 'EUR', kind: 'Текущий' }, { acc: '40817978400050017769', ccy: 'EUR', kind: 'Транзитный' }, { acc: '42301978700050017770', ccy: 'EUR', kind: 'Депозит' },
  { acc: '40817810000050017771', ccy: 'RUB', kind: 'Текущий' }, { acc: '40817810300050017772', ccy: 'RUB', kind: 'Текущий' }, { acc: '42301810600050017773', ccy: 'RUB', kind: 'Депозит' },
  { acc: '40817156900050017774', ccy: 'CNY', kind: 'Текущий' },
]

/** Счета Дт — счета банка (BANK_ACCOUNTS, index.html:679–684). */
export const BANK_ACCOUNTS: readonly FakeAccount[] = [
  { acc: '30110840700000001842', ccy: 'USD', kind: 'Ностро · NRDIRUMMXXX' }, { acc: '30114840900000000517', ccy: 'USD', kind: 'Ностро · BCLHLV22XXX' },
  { acc: '30110840000000002210', ccy: 'USD', kind: 'Ностро · HSTBDEHHXXX' }, { acc: '47422840500000000311', ccy: 'USD', kind: 'Конверсионный' },
  { acc: '70601840100000000519', ccy: 'USD', kind: 'Доходы · комиссии' }, { acc: '30110978300000001845', ccy: 'EUR', kind: 'Ностро · CESEDEFFXXX' },
  { acc: '30110810600000001848', ccy: 'RUB', kind: 'Корсчёт ЦБ' },
]

/** Маршрут документа: тип, счёт, BIC получателя, описание счёта и правило. */
export type FakeRoute = { type: string; acc: string; desc: string; recv: string; text: string }

/** Пул маршрутов (ROUTES, index.html:742–746): после смены счёта Кт маршрут пересчитывается — в фейке следующий по кругу (Р11). */
export const ROUTES: readonly FakeRoute[] = [
  { type: 'NOSTRO', acc: '30114840900000000517', desc: 'Счёт ностро в Baltic Clearing Bank (Рига), USD', recv: 'BCLHLV22XXX', text: 'Маршрут через Baltic Clearing по правилу для USD от контрагентов ЕС' },
  { type: 'NOSTRO', acc: '30110840000000002210', desc: 'Счёт ностро в Hanseatic Trade Bank (Гамбург), USD', recv: 'HSTBDEHHXXX', text: 'Прямой корсчёт с HSTBDEHH — правило для клиентов сегмента КИБ' },
  { type: 'LORO', acc: '30109840300000000731', desc: 'Счёт лоро Meridian Intermediary Bank, USD', recv: 'MRDNGB2LXXX', text: 'Зачисление через лоро-счёт посредника, правило LORO_USD_V2' },
  { type: 'INTERNAL', acc: '47422840500000000311', desc: 'Внутрибанковский конверсионный счёт', recv: 'VKRBRU8KXXX', text: 'Внутренний маршрут: счёт Кт открыт в нашем банке, внешний перевод не требуется' },
]
