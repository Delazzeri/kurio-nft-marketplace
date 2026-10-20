/**
 * Auditoria Lighthouse: `pnpm lighthouse` (gera build, sobe o preview e audita).
 * Opções: --url=https://… para auditar outro ambiente (ex.: deploy na Vercel).
 * Saída: lighthouse/reports/<página>-<perfil>-run<n>.report.{html,json} + summary.{json,md}
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from '@playwright/test'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import { CATEGORIES, CHROME_FLAGS, METRICS, PAGES, PROFILES, RUNS, TARGETS } from './config.mjs'

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
const OUT = path.join(ROOT, 'reports')
const urlArg = process.argv.find((a) => a.startsWith('--url='))?.slice(6)
const BASE = urlArg ?? 'http://localhost:4174'

const median = (values) => {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

async function waitFor(url, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Servidor não respondeu: ${url}`)
}

async function main() {
  await fs.rm(OUT, { recursive: true, force: true })
  await fs.mkdir(OUT, { recursive: true })

  let server
  if (!urlArg) {
    server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', '4174', '--strictPort'], { shell: true, stdio: 'ignore' })
    await waitFor(BASE)
  }

  const chromePath = process.env.CHROME_PATH ?? chromium.executablePath()
  const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: CHROME_FLAGS })
  const chromeVersion = (await (await fetch(`http://127.0.0.1:${chrome.port}/json/version`)).json()).Browser
  const results = []

  try {
    for (const page of PAGES) {
      for (const profile of PROFILES) {
        for (let run = 1; run <= RUNS; run++) {
          const url = `${BASE}${page.path}`
          const flags = { port: chrome.port, output: ['html', 'json'], logLevel: 'error', onlyCategories: CATEGORIES }
          const config = profile === 'desktop' ? desktopConfig : undefined
          const result = await lighthouse(url, flags, config)
          const [html, json] = result.report
          const name = `${page.id}-${profile}-run${run}`
          await fs.writeFile(path.join(OUT, `${name}.report.html`), html)
          await fs.writeFile(path.join(OUT, `${name}.report.json`), json)
          const lhr = result.lhr
          const entry = {
            page: page.id,
            profile,
            run,
            scores: Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)])),
            metrics: Object.fromEntries(Object.entries(METRICS).map(([k, id]) => [k, lhr.audits[id]?.numericValue ?? null])),
          }
          results.push(entry)
          console.log(name, JSON.stringify(entry.scores), `LCP ${Math.round(entry.metrics.LCP)}ms CLS ${entry.metrics.CLS?.toFixed(3)} TBT ${Math.round(entry.metrics.TBT)}ms`)
        }
      }
    }
  } finally {
    await chrome.kill()
    server?.kill()
  }

  const summary = []
  for (const page of PAGES) {
    for (const profile of PROFILES) {
      const runs = results.filter((r) => r.page === page.id && r.profile === profile)
      summary.push({
        page: page.id,
        path: page.path,
        profile,
        median: Object.fromEntries(CATEGORIES.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
        metrics: Object.fromEntries(Object.keys(METRICS).map((k) => [k, median(runs.map((r) => r.metrics[k]))])),
        runs: runs.map((r) => r.scores),
      })
    }
  }

  const { default: lhPkg } = await import('lighthouse/package.json', { with: { type: 'json' } })
  const environment = {
    date: new Date().toISOString(),
    url: BASE,
    lighthouse: lhPkg.version,
    chrome: chromeVersion,
    node: process.version,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: os.cpus()[0]?.model,
    conditions: {
      mobile: 'Padrão do Lighthouse: Moto G Power emulado, throttling simulado (4G lento, CPU 4x)',
      desktop: 'desktop-config do Lighthouse: 1350x940, throttling simulado de rede cabeada, CPU 1x',
      mocks: 'MSW ativo, cenário padrão (latência 150–450 ms), perfil de navegador limpo a cada execução',
    },
  }
  await fs.writeFile(path.join(OUT, 'summary.json'), JSON.stringify({ environment, targets: TARGETS, summary, results }, null, 2))

  const fmt = (v, unit) => (v == null ? '—' : unit === 'ms' ? `${Math.round(v)} ms` : v.toFixed(3))
  const mark = (cat, v) => (v >= TARGETS[cat] ? `${v}` : `**${v}** ⚠️`)
  const lines = [
    '# Lighthouse — resumo (mediana de 3 execuções)',
    '',
    `- Data: ${environment.date}`,
    `- URL base: ${environment.url}`,
    `- Lighthouse ${environment.lighthouse} · ${environment.chrome} · Node ${environment.node}`,
    `- SO: ${environment.os} · CPU: ${environment.cpu}`,
    `- Condições: ${environment.conditions.mobile}; ${environment.conditions.desktop}; ${environment.conditions.mocks}`,
    '',
    '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...summary.map(
      (s) =>
        `| ${s.page} | ${s.profile} | ${mark('performance', s.median.performance)} | ${mark('accessibility', s.median.accessibility)} | ${mark('best-practices', s.median['best-practices'])} | ${mark('seo', s.median.seo)} | ${fmt(s.metrics.LCP, 'ms')} | ${fmt(s.metrics.CLS)} | ${fmt(s.metrics.TBT, 'ms')} |`,
    ),
    '',
    `Metas: Performance ≥ ${TARGETS.performance}, Accessibility ≥ ${TARGETS.accessibility}, Best Practices ≥ ${TARGETS['best-practices']}, SEO ≥ ${TARGETS.seo}.`,
    '',
  ]
  await fs.writeFile(path.join(OUT, 'summary.md'), lines.join('\n'))
  console.log(`\n${lines.join('\n')}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
