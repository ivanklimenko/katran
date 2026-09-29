import { useState } from 'react'
import { useFilters, useGrid } from '@katran/effector'
import { BulkBar, Button, Counter, DataGrid, FilterPanel, StatusLane, useKatran, type RecordLayout, type RowState } from '@katran/ui'
import { useUnit } from 'effector-react'
import { laneItems } from '../../../entities/doc-status'
import type { Registry } from '../lib/createRegistry'
import s from './DocRegistry.module.css'

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
}

/** Экран реестра документов: заголовок, лейн статусов, панель фильтров, грид, полоса массовых действий. */
export function DocRegistry<Row>({ registry, layout, title, describe, note, bulkActions = [], rowState, openHint }: DocRegistryProps<Row>) {
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
    <div className={s.page}>
      <div className={s.head}>
        <h1 className={s.h1}>{title}{' '}<span className={s.h1Counter}><Counter value={g.total} /></span></h1>
        {note && <p className={s.note}>{note}</p>}
        {/* Строка всегда на месте: появляясь, она сдвигала бы грид. Объявление — через announce (живая область провайдера), поэтому без role="status". */}
        <p className={s.note}>{opened ?? 'Документ не открыт'}</p>
        <div className={s.lane}><StatusLane label="Статусы" items={laneItems(g.facets, counted)} value={f.lane} onChange={f.setLane} /></div>
        <div className={s.filters}>
          {f.meta
            ? <FilterPanel meta={f.meta} conditions={f.conditions} draft={f.draft} dirty={f.dirty} open={filtersOpen} onOpenChange={setFiltersOpen}
                onEdit={f.edit} onDiscard={f.discard} onApply={f.apply} onRevert={f.revert} onReset={f.reset} onRemove={f.remove} />
            : <Button size="s" disabled>Фильтры</Button>}
        </div>
      </div>
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
    </div>
  )
}
