import type { CAC } from 'cac'
import { resolve } from 'node:path'
import process from 'node:process'
import { getExecuteFile, getStorageDirAbsolute, resolveConfig } from '../../config'
import { executePendingChanges } from '../../execute'
import { resolveAuthToken } from '../../github/auth'
import { resolveRepo } from '../../github/repo'
import { appendExecutionResult } from '../../sync'
import { withErrorHandling } from '../errors'
import { printExecutionPlan, printExecutionResult } from '../output'

interface ExecuteCommandOptions {
  repo?: string
  file?: string
  apply?: boolean
  nonInteractive?: boolean
  continueOnError?: boolean
}

export function registerExecuteCommand(cli: CAC): void {
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
      const interactive = process.stdin.isTTY && !options.nonInteractive

      const repo = await resolveRepo({
        cwd: config.cwd,
        cliRepo: options.repo,
        configRepo: config.repo,
        interactive,
      })

      const token = await resolveAuthToken({
        token: config.auth.token,
        interactive,
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
        onPlan: printExecutionPlan,
      })

      await appendExecutionResult(storageDirAbsolute, result)

      printExecutionResult(result)

      if (result.failed > 0)
        process.exitCode = 1
    }))
}
