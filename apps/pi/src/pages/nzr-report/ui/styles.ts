import styled from 'styled-components'
import { k } from '@katran/tokens'

export const Screen = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${k.sp2};
  height: 100%;
  overflow: auto;

  > :not([data-report]) {
    flex-shrink: 0;
  }

  > header {
    display: flex;
    align-items: baseline;
    gap: ${k.sp3};
  }

  h1 {
    margin: 0;
    font: 700 ${k.fsH1} / 1.2 ${k.sans};
  }
`

export const Bar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${k.sp2};
`

export const Panel = styled.section`
  padding: ${k.sp2} ${k.sp3};
  border: 1px solid ${k.line};
  border-radius: ${k.rM};
  background: ${k.paper};
`

export const Labeled = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${k.sp2};
`

export const Form = styled.form`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${k.sp2};
`

export const Muted = styled.small`
  color: ${k.ink2};
  font-size: ${k.fs2};
`

export const Grow = styled.div`
  flex: 1;
`

export const Monospace = styled.span`
  font-family: ${k.mono};
  font-variant-numeric: tabular-nums;
`

export const TableScroll = styled.div`
  min-height: 0;
  overflow: auto;
  border: 1px solid ${k.line};
  border-radius: ${k.rM};

  &[data-report] {
    flex: 1 1 calc(10 * ${k.hCtlM});
  }
`

export const Table = styled.table`
  width: 100%;
  border-spacing: 0;
  background: ${k.paper};
  color: ${k.ink};
  font-size: ${k.fs2};

  th, td {
    padding: ${k.sp1} ${k.sp2};
    border-bottom: 1px solid ${k.line};
    text-align: left;
    vertical-align: top;
  }

  th {
    position: sticky;
    z-index: 1;
    top: 0;
    background: ${k.sunk};
    white-space: nowrap;
  }

  &[data-report] {
    table-layout: fixed;
  }

  &[data-report] td {
    overflow: hidden;
  }

  tbody[data-child] {
    background: ${k.ground};
  }

  tbody[data-child] th {
    position: static;
    background: ${k.valSoft};
  }

  tbody[data-selected] {
    background: ${k.valSoft};
  }

  [data-select-column], [data-expand-column] {
    position: sticky;
    z-index: 1;
    background: ${k.paper};
  }

  [data-select-column] {
    width: ${k.iconM};
    left: 0;
  }

  [data-expand-column] {
    left: calc(${k.iconM} + 2 * ${k.sp2});
  }

  th[data-select-column], th[data-expand-column] {
    z-index: 2;
    background: ${k.sunk};
  }

  [data-selected] td[data-select-column], [data-selected] td[data-expand-column] {
    background: ${k.valSoft};
  }

  [data-number] {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  [data-delta] {
    color: ${k.bad};
    font-weight: 600;
  }

  [data-empty] {
    padding: ${k.sp5};
    text-align: center;
  }
`

export const CellLines = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${k.sp1};
  justify-items: start;
`

export const CellCaption = styled(Muted)`
  display: block;
  max-width: min(100%, 25ch);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const ScrollList = styled.ol`
  max-height: calc(10 * ${k.hCtlS});
  overflow: auto;
  font-family: ${k.mono};
`

export const SwitcherList = styled.div`
  display: grid;
  justify-items: start;
  margin: ${k.sp2} 0;
`
