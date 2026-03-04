// @env node
import type { GhfsResolvedConfig } from '../types'
import { loadSyncState } from './state'

export interface StatusSummary {
  repo?: string
  lastSyncedAt?: string
  totalTracked: number
  openCount: number
  closedCount: number
  executionRuns: number
  lastExecution?: {
    runId: string
    createdAt: string
    mode: 'dry-run' | 'apply'
    planned: number
    applied: number
    failed: number
  }
}

export async function getStatusSummary(config: GhfsResolvedConfig): Promise<StatusSummary> {
  const syncState = await loadSyncState(config.storageDirAbsolute)
  const items = Object.values(syncState.items)
  const openCount = items.filter(item => item.state === 'open').length
  const closedCount = items.filter(item => item.state === 'closed').length
  const lastExecution = syncState.executions[0]

  return {
    repo: syncState.repo,
    lastSyncedAt: syncState.lastSyncedAt,
    totalTracked: items.length,
    openCount,
    closedCount,
    executionRuns: syncState.executions.length,
    lastExecution: lastExecution
      ? {
          runId: lastExecution.runId,
          createdAt: lastExecution.createdAt,
          mode: lastExecution.mode,
          planned: lastExecution.planned,
          applied: lastExecution.applied,
          failed: lastExecution.failed,
        }
      : undefined,
  }
}

export function printStatus(summary: StatusSummary): void {
  console.log('ghfs status')
  console.log(`- repo: ${summary.repo ?? '(not resolved yet)'}`)
  console.log(`- last sync: ${summary.lastSyncedAt ?? '(never)'}`)
  console.log(`- tracked items: ${summary.totalTracked} (open=${summary.openCount}, closed=${summary.closedCount})`)
  console.log(`- execution runs: ${summary.executionRuns}`)
  if (summary.lastExecution) {
    console.log(`- last execution: ${summary.lastExecution.runId} at ${summary.lastExecution.createdAt}`)
    console.log(`  mode=${summary.lastExecution.mode} planned=${summary.lastExecution.planned} applied=${summary.lastExecution.applied} failed=${summary.lastExecution.failed}`)
  }
}
