import c from 'ansis'
import packageJson from '../../package.json'

export const CLI_NAME = 'ghfs'
export const CLI_VERSION = packageJson.version

export function ASCII_HEADER(repo: string) {
  return c.gray([
    '      _   ___     ',
    '  ___| |_|  _|___ ',
    ` | . |   |  _|_ -|  ${c.green.bold(CLI_NAME)} ${c.blue(`v${CLI_VERSION}`)}`,
    ` |_  |_|_|_| |___|  → ${repo}`,
    ' |___|            ',
    '',
  ].join('\n'))
}

export function toGitHubRepoUrl(repo: string): string {
  return `https://github.com/${repo}`
}
