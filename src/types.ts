export type IssueKind = 'issue' | 'pull'
export type IssueState = 'open' | 'closed'

export interface GhfsUserConfig {
  repo?: string
  storageDir?: string
  executeFile?: string
  auth?: {
    preferGhCli?: boolean
    tokenEnv?: string[]
  }
  detectRepo?: {
    fromGit?: boolean
    fromPackageJson?: boolean
  }
  sync?: {
    includeClosed?: boolean
    writePrPatch?: boolean
    deleteClosedPrPatch?: boolean
  }
  cli?: {
    interactiveExecuteInTTY?: boolean
  }
}

export interface GhfsResolvedConfig {
  cwd: string
  repo?: string
  storageDir: string
  storageDirAbsolute: string
  executeFile: string
  executeFileAbsolute: string
  auth: {
    preferGhCli: boolean
    tokenEnv: string[]
  }
  detectRepo: {
    fromGit: boolean
    fromPackageJson: boolean
  }
  sync: {
    includeClosed: boolean
    writePrPatch: boolean
    deleteClosedPrPatch: boolean
  }
  cli: {
    interactiveExecuteInTTY: boolean
  }
}

export interface RepoDetectionCandidate {
  source: 'git' | 'package-json'
  repo: string
  detail: string
}

export interface RepoResolutionResult {
  repo: string
  source: 'cli' | 'config' | 'git' | 'package-json' | 'sync-state'
  candidates: RepoDetectionCandidate[]
}

export interface SyncItemState {
  number: number
  kind: IssueKind
  state: IssueState
  updatedAt: string
  filePath: string
  patchPath?: string
}

export interface ExecutionResult {
  runId: string
  createdAt: string
  mode: 'dry-run' | 'apply'
  repo: string
  applied: number
  planned: number
  failed: number
  details: Array<{
    op: number
    action: string
    number: number
    target?: IssueKind
    status: 'planned' | 'applied' | 'failed' | 'skipped'
    message: string
  }>
}

export interface SyncState {
  version: 1
  repo?: string
  lastSyncedAt?: string
  lastSince?: string
  items: Record<string, SyncItemState>
  executions: ExecutionResult[]
}
