import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveConfig } from './config'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('resolveConfig', () => {
  it('uses default execute file path when no config is present', async () => {
    const cwd = await createTempDir()

    const config = await resolveConfig({ cwd })

    expect(config.storageDir).toBe('.ghfs')
    expect(config.executeFile).toBe('.ghfs/execute.yml')
    expect(config.executeFileAbsolute).toBe(resolve(cwd, '.ghfs/execute.yml'))
  })

  it('derives execute file under custom storage dir', async () => {
    const cwd = await createTempDir()

    const config = await resolveConfig({
      cwd,
      overrides: {
        storageDir: '.state',
      },
    })

    expect(config.executeFile).toBe('.state/execute.yml')
    expect(config.executeFileAbsolute).toBe(resolve(cwd, '.state/execute.yml'))
  })

  it('loads executeFile from ghfs.config.ts', async () => {
    const cwd = await createTempDir()
    await writeFile(join(cwd, 'ghfs.config.ts'), `export default { executeFile: '.ghfs/custom.yml' }\n`, 'utf8')

    const config = await resolveConfig({ cwd })

    expect(config.executeFile).toBe('.ghfs/custom.yml')
    expect(config.executeFileAbsolute).toBe(resolve(cwd, '.ghfs/custom.yml'))
  })
})

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ghfs-config-test-'))
  tempDirs.push(dir)
  return dir
}
