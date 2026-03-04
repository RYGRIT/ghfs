import type { ExecutionResult, SyncState } from '../types'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SYNC_STATE_FILE_NAME } from '../constants'
import { ensureDir } from '../utils/fs'

export function getSyncStatePath(storageDirAbsolute: string): string {
  return join(storageDirAbsolute, SYNC_STATE_FILE_NAME)
}

export async function loadSyncState(storageDirAbsolute: string): Promise<SyncState> {
  const path = getSyncStatePath(storageDirAbsolute)
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as SyncState
    if (parsed.version !== 1)
      return createEmptySyncState()
    return {
      version: 1,
      items: parsed.items ?? {},
      executions: parsed.executions ?? [],
      repo: parsed.repo,
      lastSyncedAt: parsed.lastSyncedAt,
      lastSince: parsed.lastSince,
    }
  }
  catch {
    return createEmptySyncState()
  }
}

export async function saveSyncState(storageDirAbsolute: string, state: SyncState): Promise<void> {
  await ensureDir(storageDirAbsolute)
  const path = getSyncStatePath(storageDirAbsolute)
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

export function createEmptySyncState(): SyncState {
  return {
    version: 1,
    items: {},
    executions: [],
  }
}

export function appendExecution(state: SyncState, result: ExecutionResult, limit = 20): SyncState {
  const nextExecutions = [result, ...state.executions].slice(0, limit)
  return {
    ...state,
    executions: nextExecutions,
  }
}
