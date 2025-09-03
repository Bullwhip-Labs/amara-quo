// /eslint.config.mjs
// ESLint configuration for Next.js 15
// Using the new flat config format

import eslintPluginNext from 'eslint-config-next/core-web-vitals'

export default [
  eslintPluginNext,
  {
    ignores: ['.next/*', 'node_modules/*']
  }
]