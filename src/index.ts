import type { GhfsUserConfig } from './types'

export function defineConfig(config: GhfsUserConfig): GhfsUserConfig {
  return config
}

export type {
  GhfsResolvedConfig,
  GhfsUserConfig,
  IssueKind,
  IssueState,
} from './types'
