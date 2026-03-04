import type { Octokit } from 'octokit'
import type { ExecutionResult, GhfsResolvedConfig, IssueKind } from '../types'
import type { PendingOp } from './types'
// @env node
import { cancel, confirm, isCancel, multiselect } from '@clack/prompts'
import { createGitHubClient } from '../github/client'
import { readAndValidateExecuteFile } from './validate'

export interface ExecuteOptions {
  config: GhfsResolvedConfig
  repo: string
  token: string
  executeFilePath: string
  apply: boolean
  nonInteractive: boolean
  continueOnError: boolean
}

export async function executePendingChanges(options: ExecuteOptions): Promise<ExecutionResult> {
  const allOps = await readAndValidateExecuteFile(options.executeFilePath)

  const interactive = process.stdin.isTTY && !options.nonInteractive && options.config.cli.interactiveExecuteInTTY
  const selected = interactive
    ? await selectOperations(allOps)
    : allOps.map((op, index) => ({ op, index }))

  const runId = createRunId()
  const createdAt = new Date().toISOString()

  if (selected.length === 0) {
    return {
      runId,
      createdAt,
      mode: options.apply ? 'apply' : 'dry-run',
      repo: options.repo,
      planned: 0,
      applied: 0,
      failed: 0,
      details: [],
    }
  }

  printPlan(selected.map(item => item.op))

  if (!options.apply) {
    return {
      runId,
      createdAt,
      mode: 'dry-run',
      repo: options.repo,
      planned: selected.length,
      applied: 0,
      failed: 0,
      details: selected.map(({ op, index }) => ({
        op: index + 1,
        action: op.action,
        number: op.number,
        status: 'planned',
        message: describeAction(op),
      })),
    }
  }

  if (interactive) {
    const confirmed = await confirmApply(selected.length)
    if (!confirmed)
      throw new Error('Execution cancelled')
  }

  const { owner, repo } = splitRepo(options.repo)
  const octokit = createGitHubClient(options.token)

  const details: ExecutionResult['details'] = []
  let applied = 0
  let failed = 0

  for (const { op, index } of selected) {
    try {
      const target = await applyOperation(octokit, owner, repo, op)
      details.push({
        op: index + 1,
        action: op.action,
        number: op.number,
        target,
        status: 'applied',
        message: describeAction(op),
      })
      applied += 1
    }
    catch (error) {
      failed += 1
      details.push({
        op: index + 1,
        action: op.action,
        number: op.number,
        status: 'failed',
        message: (error as Error).message,
      })
      if (!options.continueOnError)
        break
    }
  }

  return {
    runId,
    createdAt,
    mode: 'apply',
    repo: options.repo,
    planned: selected.length,
    applied,
    failed,
    details,
  }
}

async function applyOperation(octokit: Octokit, owner: string, repo: string, op: PendingOp): Promise<IssueKind> {
  const issueResult = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: op.number,
  })

  const issue = issueResult.data
  const isPull = Boolean((issue as Record<string, unknown>).pull_request)
  const target: IssueKind = isPull ? 'pull' : 'issue'

  if (op.ifUnchangedSince) {
    const remoteUpdatedAt = issue.updated_at
    if (remoteUpdatedAt && new Date(remoteUpdatedAt).getTime() > new Date(op.ifUnchangedSince).getTime())
      throw new Error(`Operation conflict: remote updated_at=${remoteUpdatedAt}`)
  }

  switch (op.action) {
    case 'close':
      await octokit.rest.issues.update({ owner, repo, issue_number: op.number, state: 'closed' })
      break

    case 'reopen':
      await octokit.rest.issues.update({ owner, repo, issue_number: op.number, state: 'open' })
      break

    case 'set-title':
      await octokit.rest.issues.update({ owner, repo, issue_number: op.number, title: op.title })
      break

    case 'set-body':
      await octokit.rest.issues.update({ owner, repo, issue_number: op.number, body: op.body })
      break

    case 'add-comment':
      await octokit.rest.issues.createComment({ owner, repo, issue_number: op.number, body: op.body })
      break

    case 'add-labels':
      await octokit.rest.issues.addLabels({ owner, repo, issue_number: op.number, labels: op.labels })
      break

    case 'remove-labels':
      await removeLabels(octokit, owner, repo, op.number, op.labels)
      break

    case 'set-labels':
      await octokit.rest.issues.setLabels({ owner, repo, issue_number: op.number, labels: op.labels })
      break

    case 'add-assignees':
      await octokit.rest.issues.addAssignees({ owner, repo, issue_number: op.number, assignees: op.assignees })
      break

    case 'remove-assignees':
      await octokit.rest.issues.removeAssignees({ owner, repo, issue_number: op.number, assignees: op.assignees })
      break

    case 'set-assignees':
      await octokit.rest.issues.update({ owner, repo, issue_number: op.number, assignees: op.assignees })
      break

    case 'set-milestone': {
      const milestone = await resolveMilestone(octokit, owner, repo, op.milestone)
      await octokit.rest.issues.update({ owner, repo, issue_number: op.number, milestone })
      break
    }

    case 'clear-milestone':
      await octokit.rest.issues.update({ owner, repo, issue_number: op.number, milestone: null })
      break

    case 'lock':
      await octokit.rest.issues.lock({
        owner,
        repo,
        issue_number: op.number,
        lock_reason: normalizeLockReason(op.reason),
      })
      break

    case 'unlock':
      await octokit.rest.issues.unlock({ owner, repo, issue_number: op.number })
      break

    case 'request-reviewers':
      ensurePullAction(op.action, op.number, isPull)
      await octokit.rest.pulls.requestReviewers({
        owner,
        repo,
        pull_number: op.number,
        reviewers: op.reviewers,
      })
      break

    case 'remove-reviewers':
      ensurePullAction(op.action, op.number, isPull)
      await octokit.rest.pulls.removeRequestedReviewers({
        owner,
        repo,
        pull_number: op.number,
        reviewers: op.reviewers,
      })
      break

    case 'mark-ready-for-review':
      ensurePullAction(op.action, op.number, isPull)
      await octokit.request('POST /repos/{owner}/{repo}/pulls/{pull_number}/ready_for_review', {
        owner,
        repo,
        pull_number: op.number,
      })
      break

    case 'convert-to-draft':
      ensurePullAction(op.action, op.number, isPull)
      await octokit.request('POST /repos/{owner}/{repo}/pulls/{pull_number}/convert-to-draft', {
        owner,
        repo,
        pull_number: op.number,
      })
      break

    default:
      throw new Error(`Unsupported action: ${String((op as { action: string }).action)}`)
  }

  return target
}

async function removeLabels(octokit: Octokit, owner: string, repo: string, number: number, labels: string[]): Promise<void> {
  for (const label of labels) {
    try {
      await octokit.rest.issues.removeLabel({ owner, repo, issue_number: number, name: label })
    }
    catch (error) {
      const status = (error as { status?: number }).status
      if (status !== 404)
        throw error
    }
  }
}

async function resolveMilestone(octokit: Octokit, owner: string, repo: string, value: string | number): Promise<number> {
  if (typeof value === 'number')
    return value

  if (/^\d+$/.test(value))
    return Number(value)

  const milestones = await octokit.paginate(octokit.rest.issues.listMilestones, {
    owner,
    repo,
    state: 'all',
    per_page: 100,
  }) as Array<{ number: number, title: string }>

  const matched = milestones.find(item => item.title === value)
  if (!matched)
    throw new Error(`Milestone not found: ${value}`)

  return matched.number
}

function splitRepo(repo: string): { owner: string, repo: string } {
  const [owner, name] = repo.split('/')
  if (!owner || !name)
    throw new Error(`Invalid repo slug: ${repo}`)
  return { owner, repo: name }
}

function describeAction(op: PendingOp): string {
  return `${op.action} #${op.number}`
}

function createRunId(): string {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '')
  const random = Math.random().toString(36).slice(2, 7)
  return `run_${timestamp}_${random}`
}

async function selectOperations(ops: PendingOp[]): Promise<Array<{ op: PendingOp, index: number }>> {
  const result = await multiselect<number>({
    message: 'Select operations to include',
    options: ops.map((op, index) => ({
      label: `${index + 1}. ${describeAction(op)}`,
      value: index,
    })),
    required: false,
  })

  if (isCancel(result)) {
    cancel('Operation selection cancelled')
    throw new Error('Execution cancelled')
  }

  const selectedIndexes = new Set(result)
  return ops
    .map((op, index) => ({ op, index }))
    .filter(item => selectedIndexes.has(item.index))
}

async function confirmApply(count: number): Promise<boolean> {
  const result = await confirm({
    message: `Apply ${count} operation(s) to GitHub?`,
    initialValue: false,
  })

  if (isCancel(result)) {
    cancel('Execution cancelled')
    return false
  }

  return result
}

function printPlan(ops: PendingOp[]): void {
  console.log(`Planned operations (${ops.length}):`)
  for (const [index, op] of ops.entries())
    console.log(`- ${index + 1}. ${describeAction(op)}`)
}

function ensurePullAction(action: PendingOp['action'], number: number, isPull: boolean): void {
  if (!isPull)
    throw new Error(`Action ${action} requires #${number} to be a pull request`)
}

function normalizeLockReason(reason: 'resolved' | 'off-topic' | 'too heated' | 'too-heated' | 'spam' | undefined): 'resolved' | 'off-topic' | 'too heated' | 'spam' | undefined {
  if (!reason)
    return undefined
  if (reason === 'too-heated')
    return 'too heated'
  return reason
}
