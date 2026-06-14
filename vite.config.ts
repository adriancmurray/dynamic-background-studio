import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

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

function saveCustomComponentPlugin() {
  return {
    name: 'save-custom-component',
    configureServer(server: any) {
      server.middlewares.use('/__save-custom', (req: any, res: any, next: any) => {
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: any) => {
            body += chunk.toString()
          })
          req.on('end', () => {
            try {
              const { code } = JSON.parse(body)
              if (code) {
                const targetPath = path.resolve(__dirname, 'src/lib/components/CustomGenerated.svelte')
                fs.writeFileSync(targetPath, code, 'utf-8')
                res.statusCode = 200
                res.end(JSON.stringify({ success: true }))
              } else {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'No code provided' }))
              }
            } catch (err: any) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message }))
            }
          })
        } else if (req.method === 'GET') {
          try {
            const targetPath = path.resolve(__dirname, 'src/lib/components/CustomGenerated.svelte')
            if (fs.existsSync(targetPath)) {
              const code = fs.readFileSync(targetPath, 'utf-8')
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ code }))
            } else {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'File not found' }))
            }
          } catch (err: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: err.message }))
          }
        } else {
          next()
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), svelte(), saveCustomComponentPlugin()],
})
