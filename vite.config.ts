import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The browser never sees the API key: /api is forwarded to the hono server.
    proxy: { "/api": "http://localhost:8787" },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/live/**", "node_modules/**"],
  },
});
