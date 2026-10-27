import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  images: { unoptimized: true },
  outputFileTracingExcludes: {
    "/*": ["./private/**/*", "./assets/**/*", "./work/**/*"],
  },
};
export default config;
