import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// In dev, /api is proxied to the Express server, so the browser sees a single origin
// and the HTTP-only auth cookie "just works" without CORS tweaks.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { "/api": { target: env.VITE_PROXY_TARGET || "http://localhost:4000", changeOrigin: true } },
    },
  };
});
