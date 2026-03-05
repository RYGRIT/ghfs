import type { ProviderItem } from '../types/provider'
import type { ItemSyncStats, PatchPlan, PreparedIssueCandidate, SyncContext } from './sync-repository-types'
import { removePatchIfExists, removePath, writeFileEnsured } from '../utils/fs'
import { renderIssueMarkdown } from './markdown'
import {
  getExistingMarkdownPaths,
  moveMarkdownByState,
  removeStaleMarkdownFiles,
  resolveIssuePaths,
  resolveMoveSourcePath,
  updateTrackedItem,
} from './sync-repository-storage'
import { resolvePatchPlan } from './sync-repository-utils'

export async function prepareIssueCandidateSync(context: SyncContext, issue: ProviderItem): Promise<PreparedIssueCandidate> {
  const number = issue.number
  const kind = issue.kind
  const state = issue.state
  const tracked = context.syncState.items[String(number)]
  const paths = await resolveIssuePaths(context.storageDirAbsolute, kind, number, issue.title, state, tracked?.filePath)

  const patchPlan = resolvePatchPlan(context.config.sync.patches, kind, state)

  if (state === 'closed' && context.config.sync.closed === false) {
    delete context.syncState.items[String(number)]
    return {
      number,
      kind,
      state,
      action: 'remove',
      paths,
      patchPlan,
    }
  }

  if (state === 'closed' && context.config.sync.closed === 'existing' && !paths.hasLocalFile) {
    delete context.syncState.items[String(number)]
    return {
      number,
      kind,
      state,
      action: 'remove',
      paths,
      patchPlan,
    }
  }

  const hasCanonicalData = Boolean(tracked?.data && (kind !== 'pull' || tracked.data.pull))
  const shouldRefetch = !tracked || tracked.lastUpdatedAt !== issue.updatedAt || !hasCanonicalData
  const data = shouldRefetch
    ? await fetchCanonicalData(context, issue)
    : tracked.data

  updateTrackedItem(
    context,
    number,
    kind,
    state,
    issue.updatedAt,
    paths.targetPath,
    patchPlan.shouldWritePatch ? paths.patchPath : undefined,
    data,
  )

  return {
    number,
    kind,
    state,
    action: resolveSyncAction(shouldRefetch, paths, state),
    paths,
    patchPlan,
  }
}

export async function materializePreparedIssue(context: SyncContext, candidate: PreparedIssueCandidate): Promise<ItemSyncStats> {
  const { number, kind, state, action, patchPlan, paths } = candidate

  if (action === 'remove') {
    for (const markdownPath of getExistingMarkdownPaths(paths))
      await removePath(markdownPath)

    let patchesDeleted = 0
    if (kind === 'pull')
      patchesDeleted += await removePatchIfExists(context.storageDirAbsolute, number)

    return {
      kind,
      action,
      skipped: 0,
      written: 0,
      moved: 0,
      patchesWritten: 0,
      patchesDeleted,
    }
  }

  if (action === 'skip') {
    let patchesDeleted = 0
    if (patchPlan.shouldDeletePatch)
      patchesDeleted += await removePatchIfExists(context.storageDirAbsolute, number)
    await removeStaleMarkdownFiles(paths)
    return {
      kind,
      action,
      skipped: 1,
      written: 0,
      moved: 0,
      patchesWritten: 0,
      patchesDeleted,
    }
  }

  const tracked = context.syncState.items[String(number)]
  if (!tracked)
    throw new Error(`Missing tracked canonical data for #${number}`)

  const markdown = renderIssueMarkdown({
    repo: context.repoSlug,
    number: tracked.data.item.number,
    kind: tracked.data.item.kind,
    url: tracked.data.item.url,
    state: tracked.data.item.state,
    title: tracked.data.item.title,
    body: tracked.data.item.body ?? '',
    author: tracked.data.item.author ?? 'unknown',
    labels: tracked.data.item.labels,
    assignees: tracked.data.item.assignees,
    milestone: tracked.data.item.milestone,
    createdAt: tracked.data.item.createdAt,
    updatedAt: tracked.data.item.updatedAt,
    closedAt: tracked.data.item.closedAt,
    lastSyncedAt: context.syncedAt,
    comments: tracked.data.comments.map(comment => ({
      id: comment.id,
      author: comment.author ?? 'unknown',
      body: comment.body ?? '',
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    })),
    pr: tracked.data.pull,
  })

  const moved = await moveMarkdownByState(paths, state)
  await writeFileEnsured(paths.targetPath, markdown)
  await removeStaleMarkdownFiles(paths)

  const patchStats = await syncPatchByPlan(context, number, paths.patchPath, patchPlan)

  return {
    kind,
    action,
    skipped: 0,
    written: 1,
    moved,
    patchesWritten: patchStats.patchesWritten,
    patchesDeleted: patchStats.patchesDeleted,
  }
}

function resolveSyncAction(shouldRefetch: boolean, paths: PreparedIssueCandidate['paths'], state: 'open' | 'closed'): PreparedIssueCandidate['action'] {
  if (shouldRefetch)
    return 'refetch'
  if (paths.hasTargetFile)
    return 'skip'
  if (resolveMoveSourcePath(paths, state))
    return 'move'
  return 'create'
}

async function fetchCanonicalData(context: SyncContext, issue: ProviderItem) {
  const comments = await context.provider.fetchComments(issue.number)
  const pull = issue.kind === 'pull'
    ? await context.provider.fetchPullMetadata(issue.number)
    : undefined
  return {
    item: issue,
    comments,
    pull,
  }
}

async function syncPatchByPlan(
  context: SyncContext,
  number: number,
  patchPath: string,
  patchPlan: PatchPlan,
): Promise<Pick<ItemSyncStats, 'patchesWritten' | 'patchesDeleted'>> {
  let patchesWritten = 0
  let patchesDeleted = 0

  if (patchPlan.shouldWritePatch) {
    const patch = await context.provider.fetchPullPatch(number)
    await removePatchIfExists(context.storageDirAbsolute, number)
    await writeFileEnsured(patchPath, patch)
    patchesWritten += 1
  }

  if (patchPlan.shouldDeletePatch)
    patchesDeleted += await removePatchIfExists(context.storageDirAbsolute, number)

  return {
    patchesWritten,
    patchesDeleted,
  }
}
