import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

/**
 * O App e a camada de dados (endpoints, contratos, queries do catálogo) são carregados sob demanda
 * — fora do bundle de entrada — mas são necessários na primeira tela de Início e Detalhe.
 * Anunciá-los no HTML (modulepreload) faz o download começar em paralelo com o entry,
 * em vez de em cascata (App → rota → queries → endpoints → contratos).
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

/**
 * Embute o CSS (≈15 KB gzip) no HTML: a primeira pintura não espera uma requisição extra
 * bloqueante. As fontes continuam como arquivos referenciados pelo CSS.
 */
function inlineCss(): Plugin {
  return {
    name: 'kurio:inline-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find((f) => f.type === 'asset' && f.fileName === 'index.html')
      if (!html || html.type !== 'asset') return
      let source = String(html.source)
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.css')) continue
        const tag = new RegExp(`<link rel="stylesheet"[^>]*href="/${file.fileName}"[^>]*>`)
        if (tag.test(source)) source = source.replace(tag, () => `<style>${String(file.source)}</style>`)
      }
      html.source = source
    },
  }
}

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    inlineCss(),
    preloadDynamicEntries(['src/app/App.tsx', 'src/api/endpoints.ts', 'src/api/contracts.ts', 'src/features/catalog/queries.ts', 'mocks/browser.ts']),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@mocks': path.resolve(import.meta.dirname, 'mocks'),
      // remove a lista de sufixos públicos do bundle do MSW (ver mocks/shims/tldts.ts)
      tldts: path.resolve(import.meta.dirname, 'mocks/shims/tldts.ts'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // poucos chunks estáveis em vez de dezenas de fragmentos: menos requisições em fila
        // (HTTP/1.1 limita conexões por origem) e melhor reaproveitamento de cache entre deploys
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'tanstack', test: /node_modules[\\/]@tanstack[\\/]/, priority: 25 },
            // constantes de domínio isoladas: o shell as usa sem carregar o zod (que vive em contracts)
            { name: 'constants', test: /src[\\/]api[\\/]constants\.ts$/, priority: 20 },
            { name: 'data', test: /node_modules[\\/](axios|zod|big\.js)[\\/]|src[\\/]api[\\/]/, priority: 15 },
          ],
        },
      },
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
})
