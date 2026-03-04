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
        const hash = execSync('git rev-parse --short HEAD').toString().trim()
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
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })),
  },
})
