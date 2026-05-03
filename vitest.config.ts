import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

const config = defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: false,
    environment: "node",
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "ui/**",           // UI tests run under ui/ with their own jsdom config
    ],
    env: {
      DEGRADED_LLM: "true",
    },
  },
});

export default config;
