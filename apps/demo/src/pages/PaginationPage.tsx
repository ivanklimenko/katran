import { useState } from 'react'
import { Pagination } from '@katran/ui'
import { H1, Note, Row } from './parts'

export function PaginationPage() {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  return (
    <>
      <H1>Пагинация</H1>
      <Note>87 записей — как на эталоне. Страницы с 1; преобразование к нулевой нумерации бека — в модели.</Note>
      <Row style={{ display: 'block', padding: 0 }}>
        <Pagination page={page} pageSize={size} total={87} onPage={setPage} pageSizes={[20, 50]} onPageSize={(n) => { setSize(n); setPage(1) }} />
      </Row>
    </>
  )
}
