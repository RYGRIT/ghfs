import { join } from 'node:path'
import { EXECUTE_SCHEMA_RELATIVE_PATH } from '../constants'
import { writeTextFile } from '../utils/fs'

export const executeSchema = {
  $id: 'https://ghfs.dev/schema/execute.json',
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: true,
    required: ['number', 'action'],
    properties: {
      number: { type: 'number' },
      action: {
        type: 'string',
        enum: [
          'close',
          'reopen',
          'set-title',
          'set-body',
          'add-comment',
          'add-labels',
          'remove-labels',
          'set-labels',
          'add-assignees',
          'remove-assignees',
          'set-assignees',
          'set-milestone',
          'clear-milestone',
          'lock',
          'unlock',
          'request-reviewers',
          'remove-reviewers',
          'mark-ready-for-review',
          'convert-to-draft',
        ],
      },
      ifUnchangedSince: {
        type: 'string',
        format: 'date-time',
      },
      title: { type: 'string' },
      body: { type: 'string' },
      labels: {
        type: 'array',
        items: { type: 'string' },
      },
      assignees: {
        type: 'array',
        items: { type: 'string' },
      },
      milestone: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      reviewers: {
        type: 'array',
        items: { type: 'string' },
      },
      reason: {
        type: 'string',
        enum: ['resolved', 'off-topic', 'too heated', 'too-heated', 'spam'],
      },
    },
  },
} as const

export async function writeExecuteSchema(storageDirAbsolute: string): Promise<string> {
  const schemaPath = getExecuteSchemaPath(storageDirAbsolute)
  await writeTextFile(schemaPath, `${JSON.stringify(executeSchema, null, 2)}\n`)
  return schemaPath
}

export function getExecuteSchemaPath(storageDirAbsolute: string): string {
  return join(storageDirAbsolute, EXECUTE_SCHEMA_RELATIVE_PATH)
}
