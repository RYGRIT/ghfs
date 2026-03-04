export type PendingAction
  = | 'close'
    | 'reopen'
    | 'set-title'
    | 'set-body'
    | 'add-comment'
    | 'add-labels'
    | 'remove-labels'
    | 'set-labels'
    | 'add-assignees'
    | 'remove-assignees'
    | 'set-assignees'
    | 'set-milestone'
    | 'clear-milestone'
    | 'lock'
    | 'unlock'
    | 'request-reviewers'
    | 'remove-reviewers'
    | 'mark-ready-for-review'
    | 'convert-to-draft'

export interface PendingOpBase {
  number: number
  action: PendingAction
  ifUnchangedSince?: string
}

export interface PendingTitleOp extends PendingOpBase {
  action: 'set-title'
  title: string
}

export interface PendingBodyOp extends PendingOpBase {
  action: 'set-body'
  body: string
}

export interface PendingCommentOp extends PendingOpBase {
  action: 'add-comment'
  body: string
}

export interface PendingLabelsOp extends PendingOpBase {
  action: 'add-labels' | 'remove-labels' | 'set-labels'
  labels: string[]
}

export interface PendingAssigneesOp extends PendingOpBase {
  action: 'add-assignees' | 'remove-assignees' | 'set-assignees'
  assignees: string[]
}

export interface PendingSetMilestoneOp extends PendingOpBase {
  action: 'set-milestone'
  milestone: string | number
}

export interface PendingLockOp extends PendingOpBase {
  action: 'lock'
  reason?: 'resolved' | 'off-topic' | 'too heated' | 'too-heated' | 'spam'
}

export interface PendingReviewersOp extends PendingOpBase {
  action: 'request-reviewers' | 'remove-reviewers'
  reviewers: string[]
}

export interface PendingSimpleOp extends PendingOpBase {
  action: 'close' | 'reopen' | 'clear-milestone' | 'unlock' | 'mark-ready-for-review' | 'convert-to-draft'
}

export type PendingOp
  = | PendingSimpleOp
    | PendingTitleOp
    | PendingBodyOp
    | PendingCommentOp
    | PendingLabelsOp
    | PendingAssigneesOp
    | PendingSetMilestoneOp
    | PendingLockOp
    | PendingReviewersOp

export type PendingFile = PendingOp[]

export const PR_ONLY_ACTIONS: PendingAction[] = [
  'request-reviewers',
  'remove-reviewers',
  'mark-ready-for-review',
  'convert-to-draft',
]

export const ACTIONS_WITH_BODY: PendingAction[] = ['set-body', 'add-comment']
export const ACTIONS_WITH_LABELS: PendingAction[] = ['add-labels', 'remove-labels', 'set-labels']
export const ACTIONS_WITH_ASSIGNEES: PendingAction[] = ['add-assignees', 'remove-assignees', 'set-assignees']
export const ACTIONS_WITH_REVIEWERS: PendingAction[] = ['request-reviewers', 'remove-reviewers']
