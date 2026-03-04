import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  }
  catch {
    return false
  }
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  await ensureDir(dirname(path))
  await writeFile(path, content, 'utf8')
}

export async function readTextFile(path: string): Promise<string> {
  return readFile(path, 'utf8')
}

export async function moveFile(from: string, to: string): Promise<void> {
  await ensureDir(dirname(to))
  await rename(from, to)
}

export async function removeFile(path: string): Promise<void> {
  await rm(path, { force: true })
}
