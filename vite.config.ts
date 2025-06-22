import { fileURLToPath } from "url"
import { dirname, resolve } from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
    extensions: [".js", ".ts", ".jsx", ".tsx", ".json"],
  },
  server: {
    port: 4321,
    host: true,
  },
  build: {
    target: "esnext",
  },
})
