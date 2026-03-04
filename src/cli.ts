#!/usr/bin/env node
// @env node
import { resolve } from 'node:path'
import { cac } from 'cac'
import { getExecuteFile, getStorageDirAbsolute, resolveConfig } from './config'
import { executePendingChanges } from './execute'
import { writeExecuteSchema } from './execute/schema'
import { resolveAuthToken } from './github/auth'
import { resolveRepo } from './github/repo'
import { appendExecutionResult, syncRepository } from './sync'
import { getStatusSummary, printStatus } from './sync/status'

interface SyncCommandOptions {
  repo?: string
  since?: string
  full?: boolean
}

interface ExecuteCommandOptions {
  repo?: string
  file?: string
  apply?: boolean
  nonInteractive?: boolean
  continueOnError?: boolean
}

const cli = cac('ghfs')

setupSyncCommand(cli.command('sync', 'Sync issues and pull requests to local mirror'))
setupSyncCommand(cli.command('', 'Sync issues and pull requests to local mirror'))

cli
  .command('execute', 'Execute operations from .ghfs/execute.yml')
  .option('--repo <repo>', 'GitHub repository in owner/name format')
  .option('--file <file>', 'Path to execute yml file')
  .option('--apply', 'Apply mutations to GitHub (default is dry-run)')
  .option('--non-interactive', 'Disable interactive prompts')
  .option('--continue-on-error', 'Continue applying ops after a failure')
  .action(withErrorHandling(async (options: ExecuteCommandOptions) => {
    const config = await resolveConfig()
    const storageDirAbsolute = getStorageDirAbsolute(config)

    const repo = await resolveRepo({
      cwd: config.cwd,
      cliRepo: options.repo,
      configRepo: config.repo,
      interactive: process.stdin.isTTY && !options.nonInteractive,
    })

    const token = await resolveAuthToken({
      token: config.auth.token,
      interactive: process.stdin.isTTY && !options.nonInteractive,
    })

    const executeFilePath = resolve(config.cwd, options.file ?? getExecuteFile(config))
    const result = await executePendingChanges({
      config,
      repo: repo.repo,
      token,
      executeFilePath,
      apply: Boolean(options.apply),
      nonInteractive: Boolean(options.nonInteractive),
      continueOnError: Boolean(options.continueOnError),
    })

    await appendExecutionResult(storageDirAbsolute, result)

    console.log(`Execution ${result.mode} finished. planned=${result.planned} applied=${result.applied} failed=${result.failed}`)
    for (const detail of result.details)
      console.log(`- [${detail.status}] op ${detail.op}: ${detail.message}`)

    if (result.failed > 0)
      process.exitCode = 1
  }))

cli
  .command('status', 'Show local sync status')
  .action(withErrorHandling(async () => {
    const config = await resolveConfig()
    const summary = await getStatusSummary(config)
    printStatus(summary)
  }))

cli
  .command('schema', 'Write execute schema to .ghfs/schema/execute.schema.json')
  .action(withErrorHandling(async () => {
    const config = await resolveConfig()
    const schemaPath = await writeExecuteSchema(getStorageDirAbsolute(config))
    console.log(schemaPath)
  }))

cli.help()
cli.version('0.1.0')
cli.parse()

function setupSyncCommand(command: ReturnType<typeof cli.command>): void {
  command
    .option('--repo <repo>', 'GitHub repository in owner/name format')
    .option('--since <iso>', 'Only sync records updated since ISO datetime')
    .option('--full', 'Full sync ignoring previous cursor')
    .action(withErrorHandling(async (options: SyncCommandOptions) => {
      const config = await resolveConfig()

      const repo = await resolveRepo({
        cwd: config.cwd,
        cliRepo: options.repo,
        configRepo: config.repo,
        interactive: process.stdin.isTTY,
      })

      const token = await resolveAuthToken({
        token: config.auth.token,
        interactive: process.stdin.isTTY,
      })

      const summary = await syncRepository({
        config,
        repo: repo.repo,
        token,
        since: options.since,
        full: Boolean(options.full),
      })

      console.log(`Synced ${summary.repo} at ${summary.syncedAt}`)
      console.log(`- since: ${summary.since ?? '(full)'}`)
      console.log(`- scanned: ${summary.scanned}`)
      console.log(`- markdown written: ${summary.written}`)
      console.log(`- moved: ${summary.moved}`)
      console.log(`- patch written: ${summary.patchesWritten}`)
      console.log(`- patch deleted: ${summary.patchesDeleted}`)
    }))
}

function withErrorHandling<TArgs extends unknown[]>(fn: (...args: TArgs) => Promise<void>): (...args: TArgs) => void {
  return (...args: TArgs) => {
    fn(...args).catch((error) => {
      const message = (error as Error).message || String(error)
      console.error(`ghfs error: ${message}`)
      process.exit(1)
    })
  }
}
