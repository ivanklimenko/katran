// Формы полей взяты из тестовой выгрузки. Значения, ID, счета, BIC и тексты вымышлены.
const sender = 'TESTBY2XAAA'
const receiver = 'DEMOAM2XBBB'
const payerAccount = '40702000000000000011'
const payeeAccount = '40702000000000000022'
const uetr = '00000000-0000-4000-8000-000000000103'

const remittance = {
  docNum: '880001', docDate: '2026-01-15', operationType: '01',
  purpose: 'TEST INVOICE 01\r\nSYNTHETIC DATA',
  senderToReceiverInformation: '/REC/ TEST INSTRUCTION',
}

const parties = {
  payerPart: {
    payer: { name: 'TEST PAYER', accountNumber: payerAccount },
    payerAgent: { bankName: 'TEST CLEARING BANK', clearingCode: 'XX000123', swiftCode: null },
  },
  payeePart: {
    payee: { name: 'TEST BENEFICIARY', accountNumber: payeeAccount },
    payeeAgent: { bankName: 'DEMO BANK', swiftCode: receiver },
  },
}

const incoming = {
  originator: sender, destination: receiver, mtType: 'MT103',
  swiftHeader: { sender, receiver, 121: uetr }, field20: 'TESTIN103',
  field32A: { valueDate: '2026-01-16', amount: '1250.50', currency: 'BYN' },
  field33B: { amount: '1262.50', currency: 'BYN' },
  field50A: { fieldOption: '50F', account: `/${payerAccount}`, name: '1/TEST PAYER\r\n1/UNIT B\r\n2/TEST STREET\r\n3/BY/TEST CITY' },
  field52A: { fieldOption: '52D', account: '//XX000123', name: 'TEST CLEARING BANK', swiftCode: null },
  field53A: { fieldOption: '53B', account: '/30100000000000000033', name: null },
  field55A: null,
  field56A: null,
  field57A: { fieldOption: '57A', swiftCode: receiver },
  field59A: { fieldOption: '59', account: `/${payeeAccount}`, name: 'TEST BENEFICIARY\r\nTEST CITY' },
  field70: remittance.purpose, field71A: 'BEN',
  field71F: [{ amount: '10.00', currency: 'BYN' }, { amount: '2.00', currency: 'BYN' }],
  field72: remittance.senderToReceiverInformation,
}

const debit = {
  direction: 'DEBIT', status: 'EXECUTED', account: '30100000000000000011', registerType: 'TEST_DEBIT',
  accountingDate: '2026-01-16', creatingDate: '2026-01-16T09:20:01Z', amount: '1250.50', currency: 'BYN',
}

export const MT103_INSTRUCTION = {
  id: 'fixture-mt103-in', lastRouteDirection: { group: 'INCOMING', name: 'Входящий на тестовом маршруте' },
  commonSection: { creationDate: '2026-01-15T09:00:00Z' },
  documentSection: {
    id: 'fixture-section-in', creationDateTime: '2026-01-15T09:00:00Z', incoming: null,
    amount: '1250.50', currency: 'BYN', status: 'PENDING', statusReasonCode: 'TEST_CODE',
    valueDate: '2026-01-16', transactionDebitDate: '2026-01-17',
    swiftHeader: { messageType: 'MT103', docReference: 'TESTIN103' },
    remittanceInformation: remittance, transferTransactionInformation: parties,
    accountingData: { debitAccount: debit.account, creditAccount: null },
    swift: { incomingSwiftMessage: incoming, outgoingSwiftMessage: { mtType: 'MT103', uetr, field32A: null } },
  },
  paymentTransactionSections: [{
    transactionId: 'fixture-tx-in', createDateTransaction: '2026-01-16T09:20:00Z', transactionOperations: [debit],
  }],
}

export const MT103_WITH_OUT_REF = {
  ...MT103_INSTRUCTION,
  id: 'fixture-mt103-out-ref',
  lastRouteDirection: { group: 'OTHER', name: 'Постановка на тестовый счёт' },
  documentSection: {
    ...MT103_INSTRUCTION.documentSection,
    id: 'fixture-section-out-ref', incoming: false, status: 'DONE', currency: 'AMD',
    swiftHeader: { messageType: 'MT103', docReference: 'TEST-DOC-REF' },
    swift: {
      incomingSwiftMessage: {
        ...incoming, field20: null, originator: null, destination: null, swiftHeader: null, field72: null,
        field32A: { ...incoming.field32A, currency: 'AMD' },
      },
      outgoingSwiftMessage: { mtType: 'MT103', uetr, field20: 'TESTOUT103', destination: receiver, field32A: null },
    },
  },
  paymentTransactionSections: [],
}

export const INTERNAL_COMMISSION = {
  id: 'fixture-internal-commission',
  lastRouteDirection: { group: 'OTHER', name: 'Комиссия' },
  documentSection: {
    id: 'fixture-section-commission', creationDateTime: '2026-01-16T10:00:00Z',
    incoming: null, amount: '12.30', currency: 'USD', status: 'ERROR', valueDate: '2026-01-18',
    swiftHeader: { messageType: 'InternalPAYDOCVAL', docReference: 'TEST-FEE-REF' },
    remittanceInformation: { docNum: '880002', docDate: '2026-01-16', purpose: 'Тестовая комиссия', operationType: '09' },
    transferTransactionInformation: {
      payerPart: { payer: parties.payerPart.payer, payerAgent: null },
      payeePart: { payee: parties.payeePart.payee, payeeAgent: null },
    },
    accountingData: { debitAccount: null, creditAccount: null },
    swift: { incomingSwiftMessage: { field32A: { amount: '12.30', currency: 'USD', valueDate: '2026-01-18' } }, outgoingSwiftMessage: null },
  },
  paymentTransactionSections: [{
    transactionId: 'fixture-tx-fee', createDateTransaction: '2026-01-16T10:01:00Z',
    transactionOperations: [
      { ...debit, amount: '12.30', currency: 'USD' },
      { ...debit, amount: '12.30', currency: 'USD', account: '30100000000000000044', direction: 'CREDIT', status: null, registerType: 'TEST_CREDIT' },
    ],
  }],
}

export const INTERNAL_REFUND = {
  id: 'fixture-internal-refund',
  lastRouteDirection: { group: 'OTHER', name: 'Возврат с СНС (без экспорта)' },
  documentSection: {
    ...INTERNAL_COMMISSION.documentSection,
    id: 'fixture-section-refund', incoming: true, amount: '18.00', currency: 'AMD',
    swiftHeader: { messageType: 'InternalPAYDOCVAL', docReference: 'TEST-RETURN-REF', initialDocRef: 'TEST-ORIGINAL-REF' },
    remittanceInformation: { ...INTERNAL_COMMISSION.documentSection.remittanceInformation, docNum: '880003', purpose: null },
    transferTransactionInformation: {
      payerPart: { ...parties.payerPart, payerAgent: { bankName: 'TEST REFUND BANK', swiftCode: receiver } },
      payeePart: { payee: { name: null, accountNumber: payeeAccount }, payeeAgent: null },
    },
    swift: { incomingSwiftMessage: null, outgoingSwiftMessage: null },
  },
  paymentTransactionSections: [],
}

const interbankDebit = {
  ...debit, account: '30100000000000000201', amount: '92000.10', currency: 'KZT',
}

const beneficiaryBank = {
  bankName: 'SYNTHETIC BENEFICIARY BANK',
  swiftCode: 'TESTKZ22XXX',
  bankAccount: '/30100000000000000222',
}

export const MT202_TREASURY = {
  id: 'fixture-mt202-treasury',
  lastRouteDirection: { group: 'OUTGOING', name: 'Исходящий на тестовый счёт Ностро' },
  documentSection: {
    id: 'fixture-section-mt202-treasury',
    creationDateTime: '2026-01-20T10:00:00Z', incoming: true,
    amount: '92000.10', currency: 'KZT', status: 'DONE', valueDate: '2026-01-22', transactionDebitDate: null,
    swiftHeader: { messageType: 'MT202', docReference: 'TEST-TREASURY', initialDocRef: 'TEST-ORIGINAL202' },
    remittanceInformation: {
      docNum: '880202', docDate: '2026-01-20', purpose: null, operationType: '01',
      senderToReceiverInformation: '/BNF/ TEST TREASURY\r\nSECOND LINE',
    },
    transferTransactionInformation: {
      instructingReimbursementAgent: { bankAccount: '/30100000000000000233' },
      payeePart: { payee: null, payeeAgent: { bankName: 'SYNTHETIC RECEIVING BANK', swiftCode: receiver } },
      beneficiaryPart: beneficiaryBank,
    },
    accountingData: { debitAccount: interbankDebit.account, creditAccount: '30100000000000000202' },
    mainEntityInfo: null,
    swift: {
      incomingSwiftMessage: null,
      outgoingSwiftMessage: { mtType: 'MT202', destination: 'DEMOAM2XBBB', field20: null, field21: null, field32A: null, field58A: null, field72: null, swiftMessage: null },
    },
  },
  paymentTransactionSections: [{
    transactionId: 'fixture-tx-mt202',
    createDateTransaction: '2026-01-20T10:30:00Z',
    transactionOperations: [
      interbankDebit,
      { ...interbankDebit, direction: 'CREDIT', account: '30100000000000000202', registerType: 'TEST_CREDIT' },
    ],
  }],
}

export const MT202_REFUND = {
  id: 'fixture-mt202-refund',
  lastRouteDirection: { group: 'INCOMING', name: 'Возврат с тестового счёта' },
  documentSection: {
    ...MT202_TREASURY.documentSection,
    id: 'fixture-section-mt202-refund',
    amount: '725.30', currency: 'AMD',
    swiftHeader: { messageType: 'MT202', docReference: 'TEST-REFUND202', initialDocRef: 'TEST-PREV202' },
    remittanceInformation: {
      ...MT202_TREASURY.documentSection.remittanceInformation, docNum: '880203',
      senderToReceiverInformation: '/BNF/ TEST REFUND',
    },
    transferTransactionInformation: {
      payerPart: { payer: null, payerAgent: { bankName: 'SYNTHETIC ORDERING BANK', swiftCode: sender } },
      beneficiaryPart: { ...beneficiaryBank, swiftCode: 'DEMOAM2XCCC' },
    },
    accountingData: { debitAccount: '30100000000000000203', creditAccount: null },
    swift: null,
  },
  paymentTransactionSections: [],
}

export const FX_MAPPING_FIXTURES = [
  MT103_INSTRUCTION, MT103_WITH_OUT_REF, MT202_TREASURY, MT202_REFUND, INTERNAL_COMMISSION, INTERNAL_REFUND,
]
