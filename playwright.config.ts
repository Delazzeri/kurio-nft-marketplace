import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
/** E2E_BASE_URL permite rodar a suíte contra o deploy (ex.: Vercel) sem subir servidor local */
const EXTERNAL_URL = process.env.E2E_BASE_URL
const BASE_URL = EXTERNAL_URL ?? `http://localhost:${PORT}`

/**
 * E2E sobre o build de produção servido pelo `vite preview`, com a camada MSW ativa
 * (mesmos handlers e cenários da demonstração). Cada teste roda em um contexto novo:
 * localStorage vazio → banco do mock volta ao seed.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide', stylePath: './e2e/visual.css' },
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{projectName}/{testFileName}/{arg}{ext}',
  use: {
    baseURL: BASE_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
  ],
  webServer: EXTERNAL_URL
    ? undefined
    : {
        command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
