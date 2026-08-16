import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const devHost = process.env.HULL_HOST ?? "hull.test";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    // host:true + allowedHosts so the Traefik dev edge (which dials the docker
    // host-gateway and passes Host: app.<apex>) can actually reach Vite. Bound
    // to 127.0.0.1 it answered ECONNREFUSED; bound wide without allowedHosts it
    // answered "403 Blocked request".
    host: true,
    allowedHosts: [devHost, `.${devHost}`],
    port: 5174,
    strictPort: true,
    // The browser talks to Vite through the TLS edge on 443, not the raw port.
    hmr: { protocol: "wss", host: `admin.${devHost}`, clientPort: 443 },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
  preview: { host: "127.0.0.1", port: 4174 },
  build: { outDir: "dist", sourcemap: true },
});
