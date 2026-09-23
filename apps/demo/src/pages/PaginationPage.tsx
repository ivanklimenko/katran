import { useState } from 'react'
import { Pagination } from '@katran/ui'
import s from './Page.module.css'

export function PaginationPage() {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  return (
    <>
      <h1 className={s.h1}>Пагинация</h1>
      <p className={s.note}>87 записей — как на эталоне. Страницы с 1; преобразование к нулевой нумерации бека — в модели.</p>
      <div className={s.row} style={{ display: 'block', padding: 0 }}>
        <Pagination page={page} pageSize={size} total={87} onPage={setPage} pageSizes={[20, 50]} onPageSize={(n) => { setSize(n); setPage(1) }} />
      </div>
    </>
  )
}
