import type { GhfsResolvedConfig, GhfsUserConfig } from './types'
// @env node
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createJiti } from 'jiti'
import {
  CONFIG_FILE_CANDIDATES,
  DEFAULT_EXECUTE_FILE,
  DEFAULT_STORAGE_DIR,
  DEFAULT_TOKEN_ENV,
} from './constants'

export interface ResolveConfigOptions {
  cwd?: string
  overrides?: Partial<GhfsUserConfig>
}

export interface LoadedUserConfig {
  path?: string
  config: GhfsUserConfig
}

export async function loadUserConfig(cwd: string): Promise<LoadedUserConfig> {
  const configPath = findConfigFile(cwd)
  if (!configPath)
    return { config: {} }

  const jiti = createJiti(resolve(cwd, 'ghfs.config.ts'), {
    interopDefault: true,
  })
  const loaded = await jiti.import(configPath) as unknown
  const config = extractUserConfig(loaded)

  return {
    path: configPath,
    config,
  }
}

function extractUserConfig(loaded: unknown): GhfsUserConfig {
  if (!loaded || typeof loaded !== 'object')
    return {}

  if ('default' in loaded) {
    const config = (loaded as { default?: unknown }).default
    if (config && typeof config === 'object')
      return config as GhfsUserConfig
    return {}
  }

  return loaded as GhfsUserConfig
}

export async function resolveConfig(options: ResolveConfigOptions = {}): Promise<GhfsResolvedConfig> {
  const cwd = options.cwd ?? process.cwd()
  const overrides = options.overrides ?? {}
  const { config: userConfig } = await loadUserConfig(cwd)
  const merged = mergeUserConfig(userConfig, overrides)

  const storageDir = merged.storageDir ?? DEFAULT_STORAGE_DIR
  const executeFile = merged.executeFile ?? (storageDir === DEFAULT_STORAGE_DIR ? DEFAULT_EXECUTE_FILE : join(storageDir, 'execute.yml'))

  return {
    cwd,
    repo: merged.repo,
    storageDir,
    storageDirAbsolute: resolve(cwd, storageDir),
    executeFile,
    executeFileAbsolute: resolve(cwd, executeFile),
    auth: {
      preferGhCli: merged.auth?.preferGhCli ?? true,
      tokenEnv: merged.auth?.tokenEnv ?? [...DEFAULT_TOKEN_ENV],
    },
    detectRepo: {
      fromGit: merged.detectRepo?.fromGit ?? true,
      fromPackageJson: merged.detectRepo?.fromPackageJson ?? true,
    },
    sync: {
      includeClosed: merged.sync?.includeClosed ?? true,
      writePrPatch: merged.sync?.writePrPatch ?? true,
      deleteClosedPrPatch: merged.sync?.deleteClosedPrPatch ?? true,
    },
    cli: {
      interactiveExecuteInTTY: merged.cli?.interactiveExecuteInTTY ?? true,
    },
  }
}

function findConfigFile(cwd: string): string | undefined {
  for (const candidate of CONFIG_FILE_CANDIDATES) {
    const fullPath = resolve(cwd, candidate)
    if (existsSync(fullPath))
      return fullPath
  }
  return undefined
}

function mergeUserConfig(base: GhfsUserConfig, overrides: Partial<GhfsUserConfig>): GhfsUserConfig {
  return {
    ...base,
    ...overrides,
    auth: {
      ...base.auth,
      ...overrides.auth,
    },
    detectRepo: {
      ...base.detectRepo,
      ...overrides.detectRepo,
    },
    sync: {
      ...base.sync,
      ...overrides.sync,
    },
    cli: {
      ...base.cli,
      ...overrides.cli,
    },
  }
}
