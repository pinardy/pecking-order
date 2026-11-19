import { defineConfig } from "@playwright/test";

// Browser smoke tests. They start the dev server themselves; `npm run test:e2e` is all it takes.
// (First time on a machine: `npx playwright install chromium`.)
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 60_000,
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://localhost:5173", viewport: { width: 800, height: 450 } },
  webServer: { command: "npm run dev -- --port 5173 --strictPort", url: "http://localhost:5173", reuseExistingServer: true },
});
