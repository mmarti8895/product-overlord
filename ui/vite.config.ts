import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

const serverPort = Number(process.env.OVERLORD_PORT ?? 3000);

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // prevent Vite from obscuring rust errors
  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      "/forge": `http://localhost:${serverPort}`,
      "/kb": `http://localhost:${serverPort}`,
      "/api": `http://localhost:${serverPort}`,
      "/health": `http://localhost:${serverPort}`,
    },
  },
}));
