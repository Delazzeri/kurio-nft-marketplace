# Lighthouse — resumo (mediana de 3 execuções)

- Data: 2026-10-20T18:06:30.014Z
- URL base: http://localhost:4174
- Lighthouse 13.5.0 · Chrome/156.0.8078.4 · Node v24.14.0
- SO: Windows_NT 10.0.26300 (x64) · CPU: 13th Gen Intel(R) Core(TM) i5-13420H
- Condições: Padrão do Lighthouse: Moto G Power emulado, throttling simulado (4G lento, CPU 4x); desktop-config do Lighthouse: 1350x940, throttling simulado de rede cabeada, CPU 1x; MSW ativo, cenário padrão (latência 150–450 ms), perfil de navegador limpo a cada execução

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| inicio | mobile | **71** ⚠️ | 100 | 100 | 100 | 4075 ms | 0.022 | 366 ms |
| inicio | desktop | 99 | 100 | 100 | 100 | 865 ms | 0.002 | 11 ms |
| detalhe | mobile | **79** ⚠️ | 99 | 100 | 100 | 3641 ms | 0.000 | 261 ms |
| detalhe | desktop | 99 | 100 | 100 | 100 | 827 ms | 0.006 | 0 ms |

Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.
