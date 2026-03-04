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
