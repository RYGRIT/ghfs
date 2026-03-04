import process from 'node:process'
import { cac } from 'cac'
import { registerExecuteCommand } from './commands/execute'
import { registerSchemaCommand } from './commands/schema'
import { registerStatusCommand } from './commands/status'
import { registerSyncCommand } from './commands/sync'

export function createCli() {
  const cli = cac('ghfs')

  registerSyncCommand(cli)
  registerExecuteCommand(cli)
  registerStatusCommand(cli)
  registerSchemaCommand(cli)

  cli.help()
  cli.version('0.1.0')

  return cli
}

export function runCli(argv = process.argv): void {
  createCli().parse(argv)
}
