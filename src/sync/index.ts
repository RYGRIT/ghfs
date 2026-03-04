// @env node
import type { Octokit } from 'octokit'
import type { GhfsResolvedConfig, IssueKind, IssueState, SyncState } from '../types'
import { basename } from 'node:path'
import { createGitHubClient } from '../github/client'
import { ensureDir, exists, moveFile, removeFile, writeTextFile } from '../utils/fs'
import { renderIssueMarkdown } from './markdown'
import { getClosedIssueMarkdownPath, getClosedIssuesDir, getIssueMarkdownPath, getIssuesDir, getPrPatchPath } from './paths'
import { appendExecution, loadSyncState, saveSyncState } from './state'

export interface SyncOptions {
  config: GhfsResolvedConfig
  repo: string
  token: string
  full?: boolean
  since?: string
}

export interface SyncSummary {
  repo: string
  since?: string
  syncedAt: string
  scanned: number
  written: number
  moved: number
  patchesWritten: number
  patchesDeleted: number
}

interface GitHubIssue {
  number: number
  state: 'open' | 'closed'
  updated_at: string
  created_at: string
  closed_at: string | null
  title: string
  body: string | null
  user: {
    login: string
  } | null
  labels: Array<string | { name?: string | null }>
  assignees: Array<{ login: string }> | null
  milestone: {
    title?: string | null
  } | null
  pull_request?: Record<string, unknown>
}

interface GitHubComment {
  id: number
  body: string | null
  created_at: string
  updated_at: string
  user: {
    login: string
  } | null
}

interface GitHubPull {
  draft: boolean
  merged: boolean
  merged_at: string | null
  base: {
    ref: string
  }
  head: {
    ref: string
  }
  requested_reviewers: Array<{ login: string }>
}

export async function syncRepository(options: SyncOptions): Promise<SyncSummary> {
  const { owner, repo } = splitRepo(options.repo)
  const octokit = createGitHubClient(options.token)

  await ensureStorageStructure(options.config.storageDirAbsolute)
  const syncState = await loadSyncState(options.config.storageDirAbsolute)

  const since = resolveSince(options, syncState)
  const syncedAt = new Date().toISOString()

  const listState = options.config.sync.includeClosed ? 'all' : 'open'
  const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner,
    repo,
    state: listState,
    sort: 'updated',
    direction: 'asc',
    per_page: 100,
    since,
  }) as GitHubIssue[]

  let written = 0
  let moved = 0
  let patchesWritten = 0
  let patchesDeleted = 0

  for (const issue of issues) {
    const number = issue.number
    const kind: IssueKind = issue.pull_request ? 'pull' : 'issue'
    const state: IssueState = issue.state === 'closed' ? 'closed' : 'open'

    const comments = await octokit.paginate(octokit.rest.issues.listComments, {
      owner,
      repo,
      issue_number: number,
      per_page: 100,
    }) as GitHubComment[]

    const pull = kind === 'pull'
      ? await getPullMetadata(octokit, owner, repo, number)
      : undefined

    const markdown = renderIssueMarkdown({
      repo: options.repo,
      number,
      kind,
      state,
      title: issue.title,
      body: issue.body ?? '',
      author: issue.user?.login ?? 'unknown',
      labels: normalizeLabels(issue.labels),
      assignees: (issue.assignees ?? []).map(assignee => assignee.login),
      milestone: issue.milestone?.title ?? null,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      closedAt: issue.closed_at,
      lastSyncedAt: syncedAt,
      comments: comments.map(comment => ({
        id: comment.id,
        author: comment.user?.login ?? 'unknown',
        body: comment.body ?? '',
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
      })),
      pr: pull,
    })

    const targetPath = getIssueMarkdownPath(options.config.storageDirAbsolute, number, state)
    const closedPath = getClosedIssueMarkdownPath(options.config.storageDirAbsolute, number)
    const openPath = getIssueMarkdownPath(options.config.storageDirAbsolute, number, 'open')

    if (state === 'open' && await exists(closedPath)) {
      await moveFile(closedPath, openPath)
      moved += 1
    }

    if (state === 'closed' && await exists(openPath)) {
      await moveFile(openPath, closedPath)
      moved += 1
    }

    await writeTextFile(targetPath, markdown)
    written += 1

    const patchPath = getPrPatchPath(options.config.storageDirAbsolute, number)

    if (kind === 'pull' && options.config.sync.writePrPatch && state === 'open') {
      const patch = await downloadPullPatch(octokit, owner, repo, number)
      await writeTextFile(patchPath, patch)
      patchesWritten += 1
    }

    if (kind === 'pull' && state === 'closed' && options.config.sync.deleteClosedPrPatch) {
      if (await exists(patchPath)) {
        await removeFile(patchPath)
        patchesDeleted += 1
      }
    }

    syncState.items[String(number)] = {
      number,
      kind,
      state,
      updatedAt: issue.updated_at,
      filePath: relativeToStorage(options.config.storageDirAbsolute, targetPath),
      patchPath: kind === 'pull' && state === 'open' ? relativeToStorage(options.config.storageDirAbsolute, patchPath) : undefined,
    }
  }

  syncState.repo = options.repo
  syncState.lastSyncedAt = syncedAt
  syncState.lastSince = since

  await saveSyncState(options.config.storageDirAbsolute, syncState)

  return {
    repo: options.repo,
    since,
    syncedAt,
    scanned: issues.length,
    written,
    moved,
    patchesWritten,
    patchesDeleted,
  }
}

export async function appendExecutionResult(storageDirAbsolute: string, result: NonNullable<SyncState['executions']>[number]): Promise<void> {
  const state = await loadSyncState(storageDirAbsolute)
  await saveSyncState(storageDirAbsolute, appendExecution(state, result))
}

function resolveSince(options: SyncOptions, syncState: SyncState): string | undefined {
  if (options.full)
    return undefined
  if (options.since)
    return options.since
  return syncState.lastSyncedAt
}

async function ensureStorageStructure(storageDirAbsolute: string): Promise<void> {
  await ensureDir(getIssuesDir(storageDirAbsolute))
  await ensureDir(getClosedIssuesDir(storageDirAbsolute))
}

function splitRepo(repo: string): { owner: string, repo: string } {
  const [owner, name] = repo.split('/')
  if (!owner || !name)
    throw new Error(`Invalid repo slug: ${repo}`)
  return { owner, repo: name }
}

function normalizeLabels(labels: GitHubIssue['labels']): string[] {
  return labels
    .map((label) => {
      if (typeof label === 'string')
        return label
      return label.name ?? undefined
    })
    .filter((label): label is string => Boolean(label))
}

async function getPullMetadata(octokit: Octokit, owner: string, repo: string, number: number): Promise<{ isDraft: boolean, merged: boolean, mergedAt: string | null, baseRef: string, headRef: string, requestedReviewers: string[] }> {
  const result = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: number,
  })

  const pull = result.data as GitHubPull
  return {
    isDraft: pull.draft,
    merged: pull.merged,
    mergedAt: pull.merged_at,
    baseRef: pull.base.ref,
    headRef: pull.head.ref,
    requestedReviewers: pull.requested_reviewers.map(reviewer => reviewer.login),
  }
}

async function downloadPullPatch(octokit: Octokit, owner: string, repo: string, number: number): Promise<string> {
  const result = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number: number,
    mediaType: {
      format: 'patch',
    },
  })

  if (typeof result.data === 'string')
    return result.data

  throw new Error(`Unexpected patch response for pull #${number}`)
}

function relativeToStorage(storageDirAbsolute: string, absolutePath: string): string {
  if (absolutePath.startsWith(storageDirAbsolute))
    return absolutePath.slice(storageDirAbsolute.length + 1)
  return basename(absolutePath)
}
