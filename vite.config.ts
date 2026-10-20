import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

/**
 * Os chunks do App e da camada de mocks são importados dinamicamente no main.tsx; sem isso o
 * navegador só os descobre depois de executar o entry. Anunciá-los no HTML (modulepreload)
 * faz o download começar em paralelo com o entry.
 */
function preloadDynamicEntries(entries: string[]): Plugin {
  return {
    name: 'kurio:preload-dynamic-entries',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const bundle = ctx.bundle ?? {}
        const files = new Set<string>()
        const visit = (fileName: string) => {
          const chunk = bundle[fileName]
          if (!chunk || chunk.type !== 'chunk' || files.has(fileName)) return
          files.add(fileName)
          chunk.imports.forEach(visit)
        }
        for (const chunk of Object.values(bundle)) {
          if (chunk.type === 'chunk' && chunk.facadeModuleId && entries.some((e) => chunk.facadeModuleId!.replace(/\\/g, '/').endsWith(e))) visit(chunk.fileName)
        }
        return [...files].map((f) => ({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: '/' + f }, injectTo: 'head' as const }))
      },
    },
  }
}

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    preloadDynamicEntries(['src/app/App.tsx', 'mocks/browser.ts']),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@mocks': path.resolve(import.meta.dirname, 'mocks'),
      // remove a lista de sufixos públicos do bundle do MSW (ver mocks/shims/tldts.ts)
      tldts: path.resolve(import.meta.dirname, 'mocks/shims/tldts.ts'),
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
})
