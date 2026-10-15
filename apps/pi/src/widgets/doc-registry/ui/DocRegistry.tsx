import { useState } from 'react'
import { useFilters, useGrid } from '@katran/effector'
import { BulkBar, Button, Counter, DataGrid, FilterPanel, StatusLane, useKatran, type RecordLayout, type RowState } from '@katran/ui'
import { useUnit } from 'effector-react'
import styled from 'styled-components'
import { k } from '@katran/tokens'
import { laneItems } from '../../../entities/doc-status'
import type { Registry } from '../lib/createRegistry'

/* Реестр занимает всю высоту, которую ему дал хост (у стенда — app/Shell, Content); сам геометрию хоста не знает.
   Хосту нужна определённая высота контейнера, иначе грид вырастет по содержимому. */
const Page = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`

const Head = styled.div`
  flex: none;
`

/* Заголовок и пояснение — перенесены из apps/demo/src/pages/Page.module.css дословно (R13: без .explain/.hlSpans — обучающая часть демо) */
const H1 = styled.h1`
  font: 700 ${k.fsH1} / 1.2 ${k.sans};
  margin: 0 0 ${k.sp2};
`

/* счётчик общего числа в заголовке экрана: Counter обёрнут, чтобы не адресовать класс компонента */
const H1Counter = styled.span`
  margin-left: ${k.sp2};
  vertical-align: middle;
`

const Note = styled.p`
  color: ${k.muted};
  margin: 0 0 ${k.sp5};
  max-width: ${k.noteMax};
`

const Lane = styled.div`
  margin: ${k.sp3} 0 ${k.sp2};
`

const Filters = styled.div`
  margin: 0 0 ${k.sp3};
`

export type BulkAction = { label: string; onClick: (count: number) => void }
export type DocRegistryProps<Row> = {
  registry: Registry<Row>
  layout: RecordLayout<Row>
  title: string
  /** Для объявления открытия: «документ 812345». */
  describe: (row: Row) => string
  note?: string | undefined
  bulkActions?: BulkAction[] | undefined
  /** Заблокирована/неактивна (спека 5a §6, B1) — данные с бека, экран передаёт как есть. */
  rowState?: ((row: Row) => RowState) | undefined
  /** Подсказка кнопки открытия обычной записи (спека 5a §6, B7). */
  openHint?: string | undefined
  /** Записи, открытые в деталке (спека 2a §3.1): 'a' — основная, 'b' — сравнение. Экран берёт из модели деталки. */
  marked?: ((row: Row) => 'a' | 'b' | null) | undefined
}

/** Экран реестра документов: заголовок, лейн статусов, панель фильтров, грид, полоса массовых действий. */
export function DocRegistry<Row>({ registry, layout, title, describe, note, bulkActions = [], rowState, openHint, marked }: DocRegistryProps<Row>) {
  const g = useGrid(registry.grid)
  const f = useFilters(registry.filters)
  const openRequested = useUnit(registry.openRequested)
  const { announce } = useKatran()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [opened, setOpened] = useState<string | null>(null)
  // Фасеты ещё не приходили — лейн без чисел, а не с нулями; флаг не сбрасывается, дальше пустой ответ — это нули.
  const [counted, setCounted] = useState(false)
  if (!counted && g.facets.length > 0) setCounted(true)
  const selected = g.selection.mode === 'all' ? g.total - g.selection.except.length : g.selection.ids.length
  return (
    <Page>
      <Head>
        <H1>{title}{' '}<H1Counter><Counter value={g.total} /></H1Counter></H1>
        {note && <Note>{note}</Note>}
        {/* Строка всегда на месте: появляясь, она сдвигала бы грид. Объявление — через announce (живая область провайдера), поэтому без role="status". */}
        <Note>{opened ?? 'Документ не открыт'}</Note>
        <Lane><StatusLane label="Статусы" items={laneItems(g.facets, counted)} value={f.lane} onChange={f.setLane} /></Lane>
        <Filters>
          {f.meta
            ? <FilterPanel meta={f.meta} conditions={f.conditions} draft={f.draft} dirty={f.dirty} open={filtersOpen} onOpenChange={setFiltersOpen}
                onEdit={f.edit} onSetField={f.setField} onDiscard={f.discard} onApply={f.apply} onRevert={f.revert} onReset={f.reset} onRemove={f.remove}
                suggest={f.suggest} onSuggest={f.onSuggest} onSuggestClose={f.onSuggestClose} />
            : <Button size="s" disabled>Фильтры</Button>}
        </Filters>
      </Head>
      <DataGrid
        {...g}
        label={title}
        layout={layout}
        pageSizes={[10, 20, 50, 100]}
        emptyTitle="По заданным условиям документов нет"
        emptyText="Измените условия отбора или сбросьте фильтр"
        emptyAction={{ label: 'Сбросить фильтр', onClick: () => f.reset() }}
        rowState={rowState}
        openHint={openHint}
        marked={marked}
        onOpen={(row, { secondary, state }) => {
          const msg = `Открыт ${describe(row)}${secondary ? ' — второй drawer рядом' : ''}${state?.kind === 'locked' ? ' (только просмотр)' : ''}`
          setOpened(msg)
          announce(msg)
          openRequested({ id: layout.rowKey(row), secondary })
        }}
        toolbar={
          <BulkBar
            selection={g.selection}
            total={g.total}
            onClear={g.onClearSelection}
            onSelectAll={g.onSelectAll}
            allNote={rowState && g.rows.some((row) => rowState(row)?.kind === 'inactive') ? 'без неактивных' : undefined}
          >
            {bulkActions.map((a) => <Button key={a.label} size="s" onClick={() => a.onClick(selected)}>{a.label}</Button>)}
          </BulkBar>
        }
      />
    </Page>
  )
}
