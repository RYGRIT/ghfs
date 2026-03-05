import type { SyncSummary } from '../sync'
import type { CliPrinter } from './printer'
import { formatDuration } from '../utils/format'

export function printSyncSummaryTable(
  printer: CliPrinter,
  summary: SyncSummary,
  title: string,
): void {
  printer.table(title, [
    ['total issues count', summary.totalIssues],
    ['total prs count', summary.totalPulls],
    ['issues updated', summary.updatedIssues],
    ['prs updated', summary.updatedPulls],
    ['local tracked issues', summary.trackedItems],
    ['github requests', summary.requestCount],
    ['duration', formatDuration(summary.durationMs)],
  ])
}
