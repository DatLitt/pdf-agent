import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: path.resolve(process.cwd(), "client"),
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/execute": "http://localhost:3000",
      "/plan": "http://localhost:3000",
      "/upload": "http://localhost:3000",
    },
  },
});
