import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // This allows Docker to expose the port
    port: 5173,
    watch: {
      usePolling: true, // This forces Docker to watch for file changes on Windows
      interval:100
    }
  }
})