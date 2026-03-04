export const CONFIG_FILE_CANDIDATES = [
  'ghfs.config.ts',
  'ghfs.config.mts',
  'ghfs.config.mjs',
  'ghfs.config.js',
  'ghfs.config.cjs',
] as const

export const DEFAULT_STORAGE_DIR = '.ghfs'
export const DEFAULT_EXECUTE_FILE = '.ghfs/execute.yml'
export const DEFAULT_TOKEN_ENV = ['GH_TOKEN', 'GITHUB_TOKEN'] as const

export const ISSUE_DIR_NAME = 'issues'
export const CLOSED_DIR_NAME = 'closed'
export const SYNC_STATE_FILE_NAME = '.sync.json'
export const EXECUTE_SCHEMA_RELATIVE_PATH = 'schema/execute.schema.json'
