import type { Octokit } from 'octokit'
import type { GhfsResolvedConfig } from '../types'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGitHubClient } from '../github/client'
import { syncRepository } from './index'
import { getSyncStatePath, loadSyncState } from './state'

vi.mock('../github/client', () => ({
  createGitHubClient: vi.fn(),
}))

const mockedCreateGitHubClient = vi.mocked(createGitHubClient)

describe('syncRepository', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('uses open-only pagination when closed sync is disabled and skips unchanged items', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'ghfs-sync-index-test-'))
    const storageDir = join(cwd, '.ghfs')
    await mkdir(join(storageDir, 'issues'), { recursive: true })
    await writeFile(join(storageDir, 'issues', '00001-issue-1.md'), '# existing\n', 'utf8')
    await writeFile(getSyncStatePath(storageDir), JSON.stringify({
      version: 1,
      lastSyncedAt: '2026-01-01T00:00:00.000Z',
      items: {
        1: {
          number: 1,
          kind: 'issue',
          state: 'open',
          lastUpdatedAt: '2026-01-10T00:00:00.000Z',
          lastSyncedAt: '2026-01-01T00:00:00.000Z',
          filePath: 'issues/00001-issue-1.md',
        },
      },
      executions: [],
    }, null, 2), 'utf8')

    const listForRepo = vi.fn()
    const listComments = vi.fn()
    const listLabelsForRepo = vi.fn()
    const listMilestones = vi.fn()
    const reposGet = vi.fn(async () => ({
      data: createRepositoryMetadata(),
    }))
    const paginateCalls: Array<{ state: string, since?: string }> = []

    mockedCreateGitHubClient.mockReturnValue({
      rest: {
        repos: {
          get: reposGet,
        },
        issues: {
          listForRepo,
          listComments,
          listLabelsForRepo,
          listMilestones,
        },
      },
      paginate: vi.fn(async (method: unknown, params: Record<string, unknown>) => {
        if (method === listForRepo) {
          paginateCalls.push({ state: String(params.state), since: params.since as string | undefined })
          return [
            {
              number: 1,
              state: 'open',
              updated_at: '2026-01-10T00:00:00.000Z',
              created_at: '2026-01-01T00:00:00.000Z',
              closed_at: null,
              title: 'Issue 1',
              body: 'Body',
              user: { login: 'user1' },
              labels: [],
              assignees: [],
              milestone: null,
            },
          ]
        }
        if (method === listComments)
          return []
        if (method === listLabelsForRepo)
          return []
        if (method === listMilestones)
          return []
        return []
      }),
      request: vi.fn(),
    } as unknown as Octokit)

    const summary = await syncRepository({
      config: createConfig(cwd, { closed: false }),
      repo: 'owner/repo',
      token: 'test-token',
      full: true,
    })

    expect(summary.scanned).toBe(1)
    expect(summary.written).toBe(0)
    expect(paginateCalls).toHaveLength(1)
    expect(paginateCalls[0].state).toBe('open')
    expect(listComments).not.toHaveBeenCalled()

    const syncState = await loadSyncState(storageDir)
    expect(syncState.items['1']?.lastUpdatedAt).toBe('2026-01-10T00:00:00.000Z')
    expect(syncState.items['1']?.lastSyncedAt).toBe(summary.syncedAt)
    expect(reposGet).toHaveBeenCalledTimes(1)

    await expect(stat(join(storageDir, 'issues.md'))).resolves.toBeDefined()
    await expect(stat(join(storageDir, 'pulls.md'))).resolves.toBeDefined()
    await expect(stat(join(storageDir, 'repo.json'))).resolves.toBeDefined()

    await rm(cwd, { recursive: true, force: true })
  })

  it('syncs only pull requests when sync.issues is disabled', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'ghfs-sync-index-test-'))
    const listForRepo = vi.fn()
    const listComments = vi.fn()
    const listLabelsForRepo = vi.fn()
    const listMilestones = vi.fn()
    const reposGet = vi.fn(async () => ({
      data: createRepositoryMetadata(),
    }))
    const pullsGet = vi.fn(async () => {
      return {
        data: {
          draft: false,
          merged: false,
          merged_at: null,
          base: { ref: 'main' },
          head: { ref: 'feature' },
          requested_reviewers: [],
        },
      }
    })
    const paginateCalls: Array<{ method: unknown, params: Record<string, unknown> }> = []

    mockedCreateGitHubClient.mockReturnValue({
      rest: {
        repos: {
          get: reposGet,
        },
        issues: {
          listForRepo,
          listComments,
          listLabelsForRepo,
          listMilestones,
        },
        pulls: {
          get: pullsGet,
        },
      },
      paginate: vi.fn(async (method: unknown, params: Record<string, unknown>) => {
        paginateCalls.push({ method, params })
        if (method === listForRepo) {
          return [
            {
              number: 1,
              state: 'open',
              updated_at: '2026-01-10T00:00:00.000Z',
              created_at: '2026-01-01T00:00:00.000Z',
              closed_at: null,
              title: 'Issue 1',
              body: 'Issue body',
              user: { login: 'issue-user' },
              labels: [],
              assignees: [],
              milestone: null,
            },
            {
              number: 2,
              state: 'open',
              updated_at: '2026-01-10T00:00:00.000Z',
              created_at: '2026-01-01T00:00:00.000Z',
              closed_at: null,
              title: 'PR 2',
              body: 'PR body',
              user: { login: 'pr-user' },
              labels: [],
              assignees: [],
              milestone: null,
              pull_request: {},
            },
          ]
        }
        if (method === listComments)
          return []
        if (method === listLabelsForRepo)
          return []
        if (method === listMilestones)
          return []
        return []
      }),
      request: vi.fn(),
    } as unknown as Octokit)

    const summary = await syncRepository({
      config: createConfig(cwd, {
        issues: false,
        pulls: true,
        patches: false,
      }),
      repo: 'owner/repo',
      token: 'test-token',
      full: true,
    })

    expect(summary.scanned).toBe(1)
    expect(summary.written).toBe(1)
    expect(pullsGet).toHaveBeenCalledTimes(1)

    const commentCalls = paginateCalls.filter(call => call.method === listComments)
    expect(commentCalls).toHaveLength(1)
    expect(commentCalls[0].params.issue_number).toBe(2)

    await expect(stat(join(cwd, '.ghfs', 'issues', '00001-issue-1.md'))).rejects.toThrow()
    await expect(stat(join(cwd, '.ghfs', 'pulls', '00002-pr-2.md'))).resolves.toBeDefined()
    await expect(stat(join(cwd, '.ghfs', 'issues.md'))).resolves.toBeDefined()
    await expect(stat(join(cwd, '.ghfs', 'pulls.md'))).resolves.toBeDefined()
    await expect(stat(join(cwd, '.ghfs', 'repo.json'))).resolves.toBeDefined()
    expect(reposGet).toHaveBeenCalledTimes(1)

    await rm(cwd, { recursive: true, force: true })
  })
})

function createConfig(cwd: string, sync: Partial<GhfsResolvedConfig['sync']> = {}): GhfsResolvedConfig {
  return {
    cwd,
    repo: 'owner/repo',
    directory: '.ghfs',
    auth: {
      token: '',
    },
    sync: {
      issues: sync.issues ?? true,
      pulls: sync.pulls ?? true,
      closed: sync.closed ?? 'existing',
      patches: sync.patches ?? 'open',
    },
  }
}

function createRepositoryMetadata() {
  return {
    name: 'repo',
    full_name: 'owner/repo',
    description: null,
    private: false,
    archived: false,
    default_branch: 'main',
    html_url: 'https://github.com/owner/repo',
    fork: false,
    open_issues_count: 1,
    has_issues: true,
    has_projects: true,
    has_wiki: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    pushed_at: '2026-01-03T00:00:00.000Z',
    owner: {
      login: 'owner',
    },
  }
}
