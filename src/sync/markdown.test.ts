import { describe, expect, it } from 'vitest'
import { renderIssueMarkdown } from './markdown'

describe('renderIssueMarkdown', () => {
  it('renders frontmatter and sections', () => {
    const markdown = renderIssueMarkdown({
      repo: 'antfu/ghfs',
      number: 1,
      kind: 'issue',
      state: 'open',
      title: 'Example issue',
      body: 'Body text',
      author: 'antfu',
      labels: ['bug'],
      assignees: ['antfu'],
      milestone: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T01:00:00.000Z',
      closedAt: null,
      lastSyncedAt: '2026-01-01T02:00:00.000Z',
      comments: [
        {
          id: 10,
          author: 'alice',
          body: 'Looks good',
          createdAt: '2026-01-01T03:00:00.000Z',
          updatedAt: '2026-01-01T03:00:00.000Z',
        },
      ],
    })

    expect(markdown).toContain('schema: ghfs/issue-doc@v1')
    expect(markdown).toContain('# Example issue')
    expect(markdown).toContain('## Description')
    expect(markdown).toContain('## Comments')
    expect(markdown).toContain('<!-- comment-id:10')
  })

  it('renders pull request metadata and empty placeholders', () => {
    const markdown = renderIssueMarkdown({
      repo: 'antfu/ghfs',
      number: 2,
      kind: 'pull',
      state: 'closed',
      title: 'PR title',
      body: '',
      author: 'antfu',
      labels: [],
      assignees: [],
      milestone: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T01:00:00.000Z',
      closedAt: '2026-01-01T02:00:00.000Z',
      lastSyncedAt: '2026-01-01T03:00:00.000Z',
      comments: [],
      pr: {
        isDraft: true,
        merged: false,
        mergedAt: null,
        baseRef: 'main',
        headRef: 'feature',
        requestedReviewers: ['alice'],
      },
    })

    expect(markdown).toContain('kind: pull')
    expect(markdown).toContain('is_draft: true')
    expect(markdown).toContain('_No description._')
    expect(markdown).toContain('_No comments._')
  })
})
