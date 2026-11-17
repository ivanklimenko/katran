import { useState } from 'react'
import { render } from 'react-dom'
import { DataGrid, Drawer, DrawerStack, KatranFonts, KatranProvider, type RecordLayout } from '@katran/ui'

const params = new URLSearchParams(location.search)
const spans = Number(params.get('spans') ?? 1)
const layout: RecordLayout<{ id: string }> = {
  rowKey: (row) => row.id,
  columns: [
    { id: 'a', title: 'На всю высоту', width: 220, fullHeight: true, lines: 2, render: () => <><div>Первая строка</div><div>Вторая строка</div></> },
    { id: 'b', title: 'Обычная', width: 220, render: (row) => row.id },
    { id: 'c', title: 'Заполнитель', width: 220, render: () => 'Значение' },
  ],
  spans: Array.from({ length: spans }, (_, i) => [{ id: `span-${i}`, from: 'b', to: 'b', render: () => `Строка ${i + 2}` }]),
}

function Fixture() {
  const [a, setA] = useState(params.has('drawers'))
  const [b, setB] = useState(params.has('drawers'))
  return (
    <div data-testid="host-scroll" style={{ height: params.has('pageScroll') ? 1600 : 500, overflow: params.has('pageScroll') ? 'visible' : 'auto' }}>
      <KatranProvider theme={params.get('theme') === 'dark' ? 'dark' : 'light'} density={params.get('density') === '125' ? 1.25 : 1}>
        <KatranFonts />
        <div style={{ height: 1600 }}>
          <div style={{ height: 350, width: 900 }}>
            <DataGrid label="Проверочный реестр" layout={layout} rows={[{ id: 'r1' }, { id: 'r2' }]} total={2}
              page={1} pageSize={20} sort={[]} widths={{}} order={[]} hidden={params.has('hidden') ? ['b', 'c'] : []}
              state={params.has('skeleton') ? 'loading' : 'ready'} skeletonRows={2}
              onPage={() => {}} onSort={() => {}} onResize={() => {}} onColumns={() => {}} />
          </div>
        </div>
        <DrawerStack onEscape={() => { if (b) setB(false); else setA(false) }} items={[
          ...(b ? [{ key: 'b', slot: 'b' as const, node: <Drawer label="Короткая B" title="Короткая B" onClose={() => setB(false)}><p>Без переполнения</p><textarea aria-label="Вложенный текст" defaultValue={Array.from({ length: 60 }, (_, i) => `Строка ${i + 1}`).join('\n')} style={{ width: 300, height: 100, overflow: 'auto' }} /><div data-testid="horizontal" style={{ width: 300, overflow: 'auto' }}><div style={{ width: 1000 }}>Горизонтальное содержимое</div></div></Drawer> }] : []),
          ...(a ? [{ key: 'a', slot: 'a' as const, node: <Drawer label="Длинная A" title="Длинная A" onClose={() => setA(false)}>{Array.from({ length: 150 }, (_, i) => <p key={i}>Строка {i + 1}</p>)}</Drawer> }] : []),
        ]} />
      </KatranProvider>
    </div>
  )
}

render(<Fixture />, document.getElementById('root'))
