import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    alias: {
      '@lie/shared': '../shared/src/index.ts',
    },
  },
})
