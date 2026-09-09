import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Served from https://nssharpe.github.io/zsharpe-mtg-inventory/
  // If this does not match the repo name, the deployed build 404s on all assets.
  base: '/zsharpe-mtg-inventory/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
