import type { ReactNode } from 'react'
import { panelId, tabId } from './Tabs'

export type TabPanelProps = { tabsId: string; tabId: string; active: boolean; children: ReactNode; className?: string | undefined }

export function TabPanel({ tabsId, tabId: item, active, children, className }: TabPanelProps) {
  return (
    <div role="tabpanel" id={panelId(tabsId, item)} aria-labelledby={tabId(tabsId, item)} hidden={!active} tabIndex={0} className={className}>
      {active && children}
    </div>
  )
}
