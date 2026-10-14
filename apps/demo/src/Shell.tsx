import type { ReactNode } from 'react'
import styled from 'styled-components'
import { Button, useKatran, type Theme } from '@katran/ui'
import { densityOptions, k, type Density } from '@katran/tokens'
import { routes, type Route } from './router'

const themes: { id: Theme; title: string }[] = [{ id: 'light', title: 'Светлая' }, { id: 'dark', title: 'Тёмная' }, { id: 'system', title: 'Системная' }]

const Frame = styled.div`
  display: grid;
  grid-template-columns: ${k.side} 1fr;
  min-height: 100vh;
  background: ${k.ground};
`

const Side = styled.aside`
  padding: ${k.sp4};
  border-right: 1px solid ${k.line};
  background: ${k.paper};
`

const Brand = styled.div`
  font: 700 ${k.fsH1} / 1 ${k.sans};
  letter-spacing: -0.01em;
  margin-bottom: ${k.sp4};
`

const NavLink = styled.a`
  display: block;
  padding: ${k.sp1} ${k.sp2};
  border-radius: ${k.rS};
  color: ${k.ink2};
  text-decoration: none;

  &:hover {
    background: ${k.hover};
  }

  &[aria-current='page'] {
    color: ${k.val};
    background: ${k.valSoft};
  }
`

const Main = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

const Head = styled.header`
  display: flex;
  gap: ${k.sp4};
  padding: ${k.sp2} ${k.sp5};
  border-bottom: 1px solid ${k.line};
  background: ${k.paper};
`

const Group = styled.div`
  display: inline-flex;
  gap: ${k.sp1};
`

const Content = styled.main`
  padding: ${k.sp5};
`

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const katran = useKatran()
  return (
    <Frame>
      <Side>
        <Brand>katran</Brand>
        <nav aria-label="Разделы">
          {routes.map((r) => (
            <NavLink key={r.id} href={`#/${r.id}`} aria-current={r.id === route ? 'page' : undefined}>{r.title}</NavLink>
          ))}
        </nav>
        <NavLink href={import.meta.env.VITE_PI_URL ?? 'http://localhost:5185/'}>Реестры ПИ →</NavLink>
      </Side>
      <Main>
        <Head>
          <Group role="group" aria-label="Тема">
            {themes.map((t) => <Button key={t.id} size="s" pressed={katran.theme === t.id} onClick={() => katran.setTheme(t.id)}>{t.title}</Button>)}
          </Group>
          <Group role="group" aria-label="Плотность">
            {densityOptions.map((d: Density) => <Button key={d} size="s" pressed={katran.density === d} onClick={() => katran.setDensity(d)}>{Math.round(d * 100)} %</Button>)}
          </Group>
        </Head>
        <Content>{children}</Content>
      </Main>
    </Frame>
  )
}
