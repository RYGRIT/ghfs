import process from 'node:process'

export function withErrorHandling<TArgs extends unknown[]>(fn: (...args: TArgs) => Promise<void>): (...args: TArgs) => void {
  return (...args: TArgs) => {
    fn(...args).catch((error) => {
      console.error(error)
      process.exit(1)
    })
  }
}
