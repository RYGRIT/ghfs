export default {
  // repo: 'owner/name',
  storageDir: '.ghfs',
  executeFile: '.ghfs/execute.yml',
  auth: {
    preferGhCli: true,
    tokenEnv: ['GH_TOKEN', 'GITHUB_TOKEN'],
  },
  detectRepo: {
    fromGit: true,
    fromPackageJson: true,
  },
  sync: {
    includeClosed: true,
    writePrPatch: true,
    deleteClosedPrPatch: true,
  },
  cli: {
    interactiveExecuteInTTY: true,
  },
}
