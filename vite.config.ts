import path from 'path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'child_process'

function gitHashPlugin(): Plugin {
  const virtualId = 'virtual:git-hash'
  const resolvedId = '\0' + virtualId

  return {
    name: 'vite-plugin-git-hash',
    resolveId(id) {
      if (id === virtualId) return resolvedId
    },
    load(id) {
      if (id === resolvedId) {
        let hash = 'unknown'
        try {
          hash = execSync('git rev-parse --short HEAD').toString().trim()
        } catch {
          // Not a git repository (e.g. downloaded zip)
        }
        return `export const commitHash = ${JSON.stringify(hash)};`
      }
    },
    handleHotUpdate({ server }) {
      const mod = server.moduleGraph.getModuleById(resolvedId)
      if (mod) {
        server.moduleGraph.invalidateModule(mod)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), gitHashPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })),
  },
})
