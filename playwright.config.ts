import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: ["landing.spec.ts", "checkout-ui.spec.ts", "post-purchase.spec.ts", "product-access.spec.ts"],
  workers: 2,
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:3000",
    ...(process.platform === "win32" && !process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { channel: "chrome" } : {}),
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
      args: ["--no-sandbox"],
    },
  },
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: process.env.PLAYWRIGHT_USE_PRODUCTION === "true"
          ? "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000"
          : "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000",
        url: "http://localhost:3000",
        reuseExistingServer: false,
        timeout: 120_000,
      },
  projects: [
    { name: "360px", use: { viewport: { width: 360, height: 800 } } },
    { name: "402px", use: { viewport: { width: 402, height: 874 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
  ],
});
