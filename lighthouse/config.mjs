/**
 * Configuração versionada da auditoria Lighthouse.
 * - Build otimizado (`vite build`) servido por `vite preview`.
 * - Mocks MSW ativos no cenário padrão (latência 150–450 ms) — a mesma experiência da demo.
 * - 3 execuções por página/perfil; reportamos a mediana de cada categoria e métrica.
 */
export const RUNS = 3

export const PAGES = [
  { id: 'inicio', path: '/' },
  { id: 'detalhe', path: '/nft/emerald-ape-042' },
]

export const PROFILES = ['mobile', 'desktop']

export const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

export const TARGETS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }

/** Métricas registradas além das categorias */
export const METRICS = {
  LCP: 'largest-contentful-paint',
  CLS: 'cumulative-layout-shift',
  TBT: 'total-blocking-time',
  FCP: 'first-contentful-paint',
  SI: 'speed-index',
}

export const CHROME_FLAGS = ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
