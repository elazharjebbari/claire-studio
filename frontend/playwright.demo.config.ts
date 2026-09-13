import { defineConfig, devices } from "@playwright/test";

/**
 * Config de la DÉMONSTRATION de bout en bout du module GOLD, contre la pile RÉELLE
 * (backend Django :8002 seedé par `scripts/seed_gold_demo.py`, frontend :3002 sans mock).
 * Distincte de `playwright.config.ts`, qui sert les specs sur mocks MSW.
 * Orchestration : `scripts/gold-demo-e2e.sh`.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /gold-arbitrage-reel\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.DEMO_BASE_URL ?? "http://localhost:3002",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
