/** Счёт группами 5-3-1-4-7 (эталон accFmt, index.html:1302); не 20 знаков — как есть. */
export const groupAccount = (a: string): string => (a.length === 20 ? `${a.slice(0, 5)} ${a.slice(5, 8)} ${a.slice(8, 9)} ${a.slice(9, 13)} ${a.slice(13)}` : a)
