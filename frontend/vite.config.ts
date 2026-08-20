import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const sourceDirectory = decodeURIComponent(new URL("./src", import.meta.url).pathname)
  .replace(/^\/([A-Za-z]:\/)/, "$1");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": sourceDirectory,
    },
  },
});
