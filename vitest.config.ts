import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
      "server-only": path.resolve(dirname, "./src/test/server-only-stub.ts"),
      "next/cache": path.resolve(dirname, "./src/test/next-cache-stub.ts"),
    }
  },
  test: {
    exclude: ["e2e/**", "node_modules/**"],
    // 5s (the default) is too tight here for two reasons: service tests make
    // several sequential round trips to a remote CockroachDB, and component
    // tests overshoot it on a loaded machine. Both showed up as timeouts that
    // looked like failures but were not. A hung test still fails, just later.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    projects: [{
      extends: true,
      test: {
        include: ["src/**/*.{test,spec}.{ts,tsx}"],
        environment: "jsdom",
        setupFiles: "./vitest.setup.ts",
        globals: true
      }
    }, {
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});