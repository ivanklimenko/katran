import { createElement } from 'react'
import { remoteTab, type RemoteTabView } from '../../../shared/lib/detail'
import type {
  AuditSections, Compliance, DocNotification, DocTask, LinkedDoc, MpuMessage, SourceTexts, StatusEvent, StreamEvent, TrailTabId,
} from '../model/types'
import { AuditTab } from './AuditTab'
import { ComplianceTab } from './ComplianceTab'
import { LinkedTab } from './LinkedTab'
import { MpuTab } from './MpuTab'
import { NotificationsTab } from './NotificationsTab'
import { SourceTab } from './SourceTab'
import { StatusesTab } from './StatusesTab'
import { StreamTab } from './StreamTab'
import { TasksTab } from './TasksTab'

/**
 * Виды удалённых вкладок — те же ключи, что TRAIL_PARSERS (контрактный тест tabs2): данные вида пришли через парсер
 * той же вкладки (инвариант remoteTab, Task 6). source и ed244 — один вид.
 */
export const TRAIL_VIEWS: Record<TrailTabId, RemoteTabView> = {
  statuses: remoteTab<StatusEvent[]>({ render: (data, ctx) => createElement(StatusesTab, { data, ctx }) }),
  compliance: remoteTab<Compliance | null>({ render: (data, ctx) => createElement(ComplianceTab, { data, ctx }) }),
  linked: remoteTab<LinkedDoc[]>({ render: (data, ctx) => createElement(LinkedTab, { data, ctx }) }),
  tasks: remoteTab<DocTask[]>({ render: (data, ctx) => createElement(TasksTab, { data, ctx }), skeletonRows: 5 }),
  notif: remoteTab<DocNotification[]>({ render: (data, ctx) => createElement(NotificationsTab, { data, ctx }) }),
  source: remoteTab<SourceTexts>({ render: (data, ctx) => createElement(SourceTab, { data, ctx }) }),
  ed244: remoteTab<SourceTexts>({ render: (data, ctx) => createElement(SourceTab, { data, ctx }) }),
  stream: remoteTab<StreamEvent[]>({ render: (data, ctx) => createElement(StreamTab, { data, ctx }) }),
  mpu: remoteTab<MpuMessage[]>({ render: (data, ctx) => createElement(MpuTab, { data, ctx }) }),
  audit: remoteTab<AuditSections>({ render: (data, ctx) => createElement(AuditTab, { data, ctx }) }),
}
