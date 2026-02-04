import { defineConfig } from 'vitest/config';
import path from 'path';
import baseConfig from './vitest.config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['src/lib/external-apis.integration.test.ts'],
    setupFiles: [path.resolve(__dirname, 'vitest.integration.setup.ts')],
    pool: 'forks',
  },
});
