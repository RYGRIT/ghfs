import antfu from '@antfu/eslint-config'

export default antfu({
  stylistic: true,
  typescript: true,
  rules: {
    'no-console': 'off',
    'node/prefer-global/process': 'off',
  },
})
