import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiOrigin = "http://127.0.0.1:3001";
const proxy = {
  "/api/v1": { target: apiOrigin, changeOrigin: true },
  "/me": { target: apiOrigin, changeOrigin: true },
  "/extension": { target: apiOrigin, changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 3004,
    strictPort: true,
    proxy,
  },
  preview: {
    host: "127.0.0.1",
    port: 3004,
    strictPort: true,
    proxy,
  },
});
