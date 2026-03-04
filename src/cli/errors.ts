import process from 'node:process'
import { printCommandError } from './output'

export function withErrorHandling<TArgs extends unknown[]>(fn: (...args: TArgs) => Promise<void>): (...args: TArgs) => void {
  return (...args: TArgs) => {
    fn(...args).catch((error) => {
      printCommandError(error)
      process.exit(1)
    })
  }
}
