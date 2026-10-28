import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "landing.spec.ts",
  workers: 2,
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:3000",
    ...(process.platform === "win32" && !process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { channel: "chrome" }
      : {}),
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
        (process.platform === "win32" ? undefined : "/usr/bin/chromium"),
      args: ["--no-sandbox"],
    },
  },
  projects: [
    { name: "360px", use: { viewport: { width: 360, height: 800 } } },
    { name: "402px", use: { viewport: { width: 402, height: 874 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
  ],
});
