import type { IssueCandidates, SyncContext } from './sync-repository-types'
import { resolvePaginateState, shouldSyncIssue } from './sync-repository-utils'

export async function fetchIssueCandidatesByPagination(context: SyncContext, since: string | undefined): Promise<IssueCandidates> {
  const issues: IssueCandidates['issues'] = []
  let scanned = 0
  const allOpenNumbers = context.config.sync.closed === false && !since ? new Set<number>() : undefined
  const states = resolvePaginationStates(context, since)

  for (const state of states) {
    for await (const page of context.provider.paginateItems({ state, since })) {
      for (const issue of page) {
        if (!shouldSyncIssue(context.config.sync, issue))
          continue
        scanned += 1
        issues.push(issue)
        if (state === 'open' && allOpenNumbers)
          allOpenNumbers.add(issue.number)
      }
    }
  }

  return {
    issues,
    scanned,
    allOpenNumbers,
  }
}

export async function fetchIssueCandidatesByNumbers(context: SyncContext, numbers: number[]): Promise<IssueCandidates> {
  const issues = (await context.provider.fetchItemsByNumbers(numbers))
    .filter(issue => shouldSyncIssue(context.config.sync, issue))
  return {
    issues,
    scanned: issues.length,
  }
}

function resolvePaginationStates(context: SyncContext, since: string | undefined): Array<'open' | 'closed' | 'all'> {
  if (context.config.sync.closed === false)
    return since ? ['open', 'closed'] : ['open']
  return [resolvePaginateState(context.config.sync.closed)]
}
