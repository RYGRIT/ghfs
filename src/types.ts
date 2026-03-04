export type IssueKind = 'issue' | 'pull'
export type IssueState = 'open' | 'closed'

export interface GhfsUserConfig {
  /**
   * The repository to sync.
   *
   * Will try to detect the repository from the current working directory or the `package.json` file.
   */
  repo?: string
  /**
   * The directory to store the synced issues and pull requests.
   *
   * @default '.ghfs'
   */
  directory?: string
  /**
   * The authentication configuration.
   */
  auth?: {
    /**
     * The GitHub personal access token to use for authentication.
     *
     * When not provided, will try to get the token from `gh auth token` or the environment variables `GH_TOKEN` or `GITHUB_TOKEN`.
     */
    token?: string
  }
  sync?: {
    /**
     * When to sync closed issues and pull requests.
     *
     * - `'existing'`: only sync closed issues and pull requests that already exist in the local filesystem.
     * - `'all'`: sync all closed issues and pull requests.
     * - `false`: don't sync any closed issues and pull requests. And delete any existing closed issues and pull requests from the local filesystem.
     *
     * @default 'existing'
     */
    closed?: 'existing' | 'all' | false
    /**
     * When to download the pull request patch files.
     *
     * - `'open'`: only download open pull request patch files.
     * - `'all'`: download all pull request patch files.
     * - `false`: don't download any pull request patch files.
     *
     * @default 'open'
     */
    patches?: 'open' | 'all' | false
  }
}

export type GhfsResolvedConfig = Required<GhfsUserConfig> & {
  cwd: string
  auth: Required<GhfsUserConfig['auth']>
  sync: Required<GhfsUserConfig['sync']>
}

export interface RepoDetectionCandidate {
  source: 'git' | 'package-json'
  repo: string
  detail: string
}

export interface RepoResolutionResult {
  repo: string
  source: 'cli' | 'config' | 'git' | 'package-json'
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
