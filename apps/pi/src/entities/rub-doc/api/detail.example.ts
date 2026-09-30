/** Пример ответа GET /grids/rub-docs/documents/{id} (PAYDOCRU, данные вымышленные, со стенда). Источник примера в pi-api.md. */
export const RUB_DETAIL_EXAMPLE = {
  id: 'r1', docNumber: '3741', uuid: '72aa73fb-dae6-4672-8d09-e15afc0a523d', txId: '03d45fed-f505-4fca-a267-60cba12b82f2', docRef: 'ED101-5210472026066',
  created: '2026-09-24T11:08:14', changed: '2026-09-24T11:08:20',
  type: 'PAYDOCRU', edCode: 'ED101', direction: 'IN', dirTxt: 'входящий от ЦБ на клиента', amount: 76394.81, queue: 5, prio: 0,
  fromName: 'ООО «ХУРЫГУПЯ»', fromAcc: '40702810064578557830', fromInn: '4340195751', fromKpp: '473897776', fromBic: '049597373', fromBank: 'АО «ЗОДО БАНК»',
  toName: 'ИП ТЫСЫЛИОВ ГИБАС ЗУДЫОВИЧ', toAcc: '40802810820980451081', toInn: '394831189084', toKpp: '', toBic: '042993195', toBank: 'БАНК «ХАРОГА» (АО)',
  initiator: 'NCB.NCB_IN', source: 'UFX', destination: 'RTL',
  purpose: 'Оплата по счёту № 6945-2101 от 18.07.2026 за оборудование по договору 65-89 от 27.02.2026. В том числе НДС 20% — 18 658.24 руб.',
  status: 'DONE', reason: null, lock: null, inactive: null,
  numDate: '2026-09-24', opCode: '01', opName: 'Платёжное поручение',
  scenario: 'SC_NCB_IN_CREDIT', sysFrom: 'DB01', sysTo: 'DB02',
  party: {
    s: { name: 'ООО «ХУРЫГУПЯ»', opt: '', acc: '40702810064578557830', inn: '4340195751', kpp: '473897776', info: '', addr: '740828, Г. ЛЫСУЛА, УЛ. НИФЕМЯ, Д. 133, ПОМ. 520', bank: 'АО «ЗОДО БАНК»', bic: '049597373', bankAcc: '30101810508469019375', bankInfo: '' },
    r: { name: 'ИП ТЫСЫЛИОВ ГИБАС ЗУДЫОВИЧ', opt: '', acc: '40802810820980451081', inn: '394831189084', kpp: '', info: '', addr: '057617, Г. СОЛОКЫ, УЛ. МЕСОБО, Д. 83, КВ. 143', bank: 'БАНК «ХАРОГА» (АО)', bic: '042993195', bankAcc: '30101810664602335376', bankInfo: 'Филиал в г. Хупево' },
  },
  purposeExtra: { instr: 'Гяналу тыпепо вуза факе пысему вя ни лидефе фотохо ва мезе мокефо', uip: '68578800898192015437', reserve: 'Зувивофе дыто симу', f20: 'Руди фибеку собыве сясе' },
  agents: [
    { name: 'ФИЛИАЛ № 3826 БАНКА «НУВОСЕ» (ПАО)', bic: '041550162', bankAcc: '30101810951233369033', acc: '30110810217115096554' },
    { name: 'БАНК «ВЯХИЛЯ» (АО)', bic: '041916658', bankAcc: '30101810196704420940', acc: '30110810928566570883' },
  ],
  budget: { b101: '', b104: '', b105: '', b106: '', b107: '', b108: '', b109: '', b110: '' },
  ed107: {
    relId: '5108', initId: '46713', relDate: '2026-09-24', execDate: '2026-09-24',
    v: {
      'OrderingBank/BIC': '045131779', 'OrderingBank/ed:Name': 'БАНК «ВУХИДО» (АО)', 'OrderingBank/BankAccount': '30101810105950215060', 'OrderingBank/SWBIC': 'DUZFRUY9',
      'InstructingAgent/BIC': '047485823', 'InstructingAgent/CorrespAcc': '30101810372488940093', 'InstructingAgent/SWBIC': 'XEANRURA',
    },
  },
  collect: { c48: '', cLimit: '', c70: '', c38: '', c39: '', c40: '', c41: '' },
  txAt: '2026-09-24T11:08:20',
  txs: [
    { dir: 'DEBIT', st: 'EXECUTED', acc: '30102810738223744290', reg: '00000_CorrCBR', time: '2026-09-24T08:08:20.114Z', amount: 76394.81, currency: 'RUB' },
    { dir: 'CREDIT', st: 'EXECUTED', acc: '40802810820980451081', reg: '00010_ClientCurrent', time: '2026-09-24T08:08:20.118Z', amount: 76394.81, currency: 'RUB' },
  ],
  tabsOff: ['stream', 'mpu'],
}
