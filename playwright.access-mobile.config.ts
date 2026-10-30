import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
// Touch + iPhone viewport/user agent in Chromium. This is NOT Safari/WebKit coverage.
export default defineConfig({
  ...base,
  testMatch: "product-access.spec.ts",
  projects: [{ name: "iphone-touch-chromium", use: {
    ...devices["iPhone 13"], browserName: "chromium",
    ...(process.platform === "win32" && !process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { channel: "chrome" } : {}),
  } }],
});
