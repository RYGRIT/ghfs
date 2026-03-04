import type { IssueState } from '../types'
import { join } from 'node:path'
import { CLOSED_DIR_NAME, ISSUE_DIR_NAME } from '../constants'

export function getIssuesDir(storageDirAbsolute: string): string {
  return join(storageDirAbsolute, ISSUE_DIR_NAME)
}

export function getClosedIssuesDir(storageDirAbsolute: string): string {
  return join(getIssuesDir(storageDirAbsolute), CLOSED_DIR_NAME)
}

export function getIssueMarkdownPath(storageDirAbsolute: string, number: number, state: IssueState): string {
  if (state === 'closed')
    return join(getClosedIssuesDir(storageDirAbsolute), `${number}.md`)
  return join(getIssuesDir(storageDirAbsolute), `${number}.md`)
}

export function getClosedIssueMarkdownPath(storageDirAbsolute: string, number: number): string {
  return join(getClosedIssuesDir(storageDirAbsolute), `${number}.md`)
}

export function getPrPatchPath(storageDirAbsolute: string, number: number): string {
  return join(getIssuesDir(storageDirAbsolute), `${number}.patch`)
}
