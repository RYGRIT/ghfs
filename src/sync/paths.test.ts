import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getClosedIssueMarkdownPath, getClosedIssuesDir, getIssueMarkdownPath, getIssuesDir, getPrPatchPath } from './paths'

describe('sync paths', () => {
  const root = join('/tmp', 'ghfs', '.ghfs')

  it('resolves issue directories', () => {
    expect(getIssuesDir(root)).toBe(join(root, 'issues'))
    expect(getClosedIssuesDir(root)).toBe(join(root, 'issues', 'closed'))
  })

  it('resolves markdown paths by issue state', () => {
    expect(getIssueMarkdownPath(root, 12, 'open')).toBe(join(root, 'issues', '12.md'))
    expect(getIssueMarkdownPath(root, 12, 'closed')).toBe(join(root, 'issues', 'closed', '12.md'))
    expect(getClosedIssueMarkdownPath(root, 12)).toBe(join(root, 'issues', 'closed', '12.md'))
  })

  it('resolves pull patch path', () => {
    expect(getPrPatchPath(root, 42)).toBe(join(root, 'issues', '42.patch'))
  })
})
