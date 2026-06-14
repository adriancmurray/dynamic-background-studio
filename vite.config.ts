import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'child_process'

let gitUsername = ''
try {
  const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim()
  const match = remoteUrl.match(/github\.com[/:]([^/]+)/)
  if (match && match[1]) {
    gitUsername = match[1]
  }
} catch (e) {
  // fallback
}

process.env.VITE_GIT_USERNAME = gitUsername

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), svelte()],
})
