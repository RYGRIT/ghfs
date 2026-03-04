import type { GhfsResolvedConfig } from '../types'
import { resolve } from 'node:path'
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
  const syncState = await loadSyncState(resolve(config.cwd, config.directory))
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
