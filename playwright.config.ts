import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173/turbo-loop-legends/",
    trace: "on-first-retry"
  },
  projects: [
    { name: "tablet", use: { ...devices["iPad (gen 7) landscape"] } },
    { name: "phone", use: { ...devices["iPhone 13 landscape"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } }
  ],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173",
    url: "http://127.0.0.1:4173/turbo-loop-legends/",
    reuseExistingServer: false
  }
});
