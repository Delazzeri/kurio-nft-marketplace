# Kurio — Marketplace de NFTs

Implementação do desafio frontend da Jungle Gaming: um marketplace de NFTs em **React + TypeScript**, fiel ao [layout no Figma](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1), com APIs, autenticação, carteiras, pagamentos e tempo real **100% simulados com MSW**.

- **Aplicação publicada:** https://kurio-nft-marketplace-five.vercel.app
- **Repositório:** https://github.com/Delazzeri/kurio-nft-marketplace
- **Arquitetura, contratos e decisões:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Auditoria Lighthouse:** [produção (Vercel)](./lighthouse/reports/producao/summary.md) · [local](./lighthouse/reports/local/summary.md)

## Stack

| Responsabilidade | Tecnologia |
| --- | --- |
| Interface | React 19 + TypeScript (strict) |
| Build | Vite 8 |
| Roteamento | TanStack Router (rotas por arquivo, search params validados com zod) |
| Estado remoto | TanStack Query 5 |
| Cliente HTTP | Axios (interceptors de sessão, normalização de erros) |
| Tempo real | Socket.IO (`socket.io-client`) |
| Estilização | Tailwind CSS 4 + shadcn/ui (adaptado à identidade Kurio) |
| Formulários | react-hook-form + zod (contratos compartilhados) |
| Valores em ETH | big.js (strings decimais, sem `number`) |
| Mocking | MSW 2 (REST) + `@mswjs/socket.io-binding` (Socket.IO) |
| E2E / regressão visual | Playwright (+ axe-core) |
| Auditoria | Lighthouse 13 |

## Como rodar

Pré-requisitos: **Node 20+** e **pnpm 10+** (o projeto foi desenvolvido com Node 24 e pnpm 12).

```bash
pnpm install
pnpm dev            # http://localhost:5173 — com mocks (MSW) ativos
```

### Comandos

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Desenvolvimento com mocks |
| `pnpm build` | Verificação de tipos + build otimizado (`dist/`) |
| `pnpm preview` | Serve o build em http://localhost:4173 (mocks inclusos) |
| `pnpm typecheck` | Verificação de tipos (`tsc -b`) |
| `pnpm lint` | ESLint |
| `pnpm test:e2e` | Playwright (Chromium desktop 1440px + mobile 390px) sobre o build de produção |
| `pnpm test:e2e:update` | Regenera as baselines de regressão visual |
| `E2E_BASE_URL=https://kurio-nft-marketplace-five.vercel.app pnpm test:e2e` | Roda a suíte contra o deploy publicado (sem servidor local) |
| `pnpm test:report` | Abre o relatório HTML do Playwright (traces das falhas inclusos) |
| `pnpm lighthouse` | Build + auditoria Lighthouse local (3 execuções por página/perfil) |
| `pnpm lighthouse:prod` | Auditoria Lighthouse do deploy publicado na Vercel |

> Na primeira execução dos testes: `pnpm exec playwright install chromium`.

### Variáveis de ambiente

Arquivo `.env` (versionado, sem segredos — veja `.env.example`):

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Ativa a camada MSW (REST + Socket.IO). Também ativa no build de demonstração. |
| `VITE_API_URL` | `/api` | Base das chamadas REST (interceptadas pelo MSW) |
| `VITE_SOCKET_URL` | `wss://realtime.kurio.mock` | Servidor Socket.IO (interceptado pelo MSW) |

## Credenciais fictícias

| Usuário | E-mail | Senha | Observações |
| --- | --- | --- | --- |
| Ana Colecionadora | `ana@kurio.dev` | `Kurio@2026` | Carteira principal MetaMask cadastrada; 1 favorito |
| Bruno Cripto | `bruno@kurio.dev` | `Kurio@2026` | Sem carteiras (bom para testar o cadastro) |

Também é possível criar uma conta em **/cadastro**. Senhas são armazenadas no mock apenas como `sha256(salt:senha)`.

**Cupons:** `KURIO10` (10%), `GENESIS` (0.05 ETH), `VERAO2025` (expirado), qualquer outro → inválido.

## Cenários de mock (seleção e reset)

Os cenários são **determinísticos** (latência com PRNG de seed fixa) e reproduzíveis. Três formas de selecionar:

1. **Painel "Mock"** (botão flutuante no canto inferior direito — presente também no deploy): troca o cenário, dispara eventos Socket.IO, derruba a conexão, expira a sessão e faz **reset completo**.
2. **URL:** `?cenario=<id>` em qualquer página (fica salvo para os próximos carregamentos).
3. **Console / testes:** `window.__kurioMock.setScenario('<id>')`, `window.__kurioMock.reset()`.

O **reset** restaura integralmente o estado conhecido: catálogo, usuários, favoritos, carrinhos, pedidos, carteiras e cenário padrão.

| Id | Efeito |
| --- | --- |
| `padrao` | Sucesso, latência 150–450 ms |
| `instantaneo` | Sem latência (usado nos testes) |
| `lento` | ~2,5 s por resposta (skeletons visíveis) |
| `latencia-variavel` | 50 ms–2,5 s → respostas fora de ordem |
| `catalogo-vazio` | Listagem sem resultados |
| `offline` | Toda chamada REST falha por erro de rede |
| `erro-servidor` | Catálogo e detalhe retornam 500 |
| `instavel` | 3 primeiras listagens retornam 503; nova tentativa funciona |
| `favoritos-falha` | Incluir/remover favorito retorna 500 (rollback otimista) |
| `sessao-curta` | Sessão expira 45 s após o login |
| `preco-alterado` | Ao confirmar o pedido, o preço do 1º item sobe 0.10 ETH (409) |
| `edicao-esgotada` | Ao confirmar o pedido, a edição do 1º item esgota (409) |
| `timeout-pedido` | Pedido é criado, mas a resposta excede o timeout; reenvio recupera o mesmo pedido |
| `pagamento-recusado` | Pedido criado e depois recusado |
| `carteira-recusa` | A conexão simulada da carteira é recusada |
| `pagamento-lento` | Pedido fica pendente por 12 s (desconexão/retomada) |

### Reproduzindo os fluxos de falha

| Fluxo | Como reproduzir |
| --- | --- |
| Skeletons / carregamento lento | `/?cenario=lento` |
| Respostas fora de ordem | `/?cenario=latencia-variavel` e clique rápido em vários filtros |
| Falha + nova tentativa | `/?cenario=instavel` → "Tentar novamente" |
| Sem conexão | `/?cenario=offline`; volte para `padrao` pelo painel e clique em "Tentar novamente" |
| Rollback de favorito | `?cenario=favoritos-falha`, login, clique no coração |
| Sessão expirada | Login → painel → **Expirar sessão** → navegue para uma área privada (ou use `sessao-curta`) |
| Preço mudou com item no carrinho | Item no carrinho → painel → informe o id do NFT → **Preço +0.10** |
| Checkout com cotação desatualizada | No diálogo de revisão do pagamento, use **Preço +0.10** no painel; ou cenário `preco-alterado` |
| Edição esgotada na compra | Cenário `edicao-esgotada` e confirme a compra |
| Timeout com recuperação | Cenário `timeout-pedido` e confirme a compra (~10 s) |
| Pagamento recusado | Cenário `pagamento-recusado` |
| Carteira recusa | Cenário `carteira-recusa` e selecione um provedor no pagamento |
| Eventos duplicados/antigos | Painel → **Duplicar último** / **Evento antigo** (o estado não regride) |
| Queda do Socket.IO com pedido pendente | Cenário `pagamento-lento`, confirme a compra, painel → **Derrubar socket 8 s**, recarregue a página |

Ids de NFT úteis: `emerald-ape-042`, `sage-nomad-009`, `ivory-baron-088`, `golden-beat-207`, `phantom-ape-000` (esgotado).

## Testes

```bash
pnpm exec playwright install chromium   # primeira vez
pnpm test:e2e                           # ~100 testes (desktop + mobile), ~2 min
pnpm test:report
```

Cobertura (um arquivo por cenário do enunciado, em `e2e/`):

| # | Cenário | Arquivo |
| --- | --- | --- |
| 1 | Busca, filtros combinados, ordenação, paginação e histórico | `catalog.spec.ts` |
| 2 | Acesso direto ao detalhe e recurso inexistente | `detail.spec.ts` |
| 3 | Cadastro, login, expiração, logout e troca de usuário | `auth.spec.ts` |
| 4 | Favoritos, falha de mutation e recuperação | `favorites.spec.ts` |
| 5 | Carrinho, quantidades, remoção, cupom, persistência após refresh/login | `cart.spec.ts` |
| 6 | Compra completa até o recibo | `purchase.spec.ts` |
| 7 | Pagamento recusado, clique repetido, timeout com mesmo pedido | `payment-failures.spec.ts` |
| 8 | Perfil, avatar, senha e carteiras com erros | `account.spec.ts` |
| 9 | Preço/disponibilidade via Socket.IO durante o checkout | `realtime.spec.ts` |
| 10 | Eventos duplicados/antigos, desconexão e retomada de pedido | `realtime.spec.ts` |
| 11 | Teclado, foco de diálogos, validação + axe | `a11y.spec.ts` |
| 12 | Skeletons, feedback de falha e nova tentativa | `loading-errors.spec.ts` |
| — | Regressão visual (início, detalhe, carrinho, pagamento × desktop/mobile) | `visual.spec.ts` |
| — | Sem overflow horizontal em 390, 768 e 1440 px | `responsive.spec.ts` |

- Cada teste parte de um **contexto novo** (localStorage vazio → mock volta ao seed) e define o cenário antes do carregamento.
- Eventos em tempo real são disparados pela **API de controle do mock**, que altera o banco simulado; o evento chega pelo `socket.io-client` real. REST passa pelos handlers MSW.
- Relatório HTML em `playwright-report/`; traces, vídeos e screenshots das falhas em `test-results/`.
- As baselines visuais ficam em `e2e/__screenshots__/<plataforma>/` (geradas em Windows/Chromium). Em outro SO, gere as suas com `pnpm test:e2e:update`.

## Estrutura

```
src/
  api/          contratos zod, cliente Axios, endpoints, chaves de query
  app/          App, QueryClient, serialização da URL
  auth/         store de sessão, serviço de autenticação, watcher de expiração
  realtime/     provider Socket.IO, porta de eventos (dedupe/versão), aplicação no cache
  features/     catálogo, carrinho, checkout, favoritos, conta, auth
  components/   layout, estados (erro/vazio/404), formulários, shadcn/ui adaptado
  routes/       rotas TanStack Router (arquivo = rota)
mocks/          banco simulado, seed, cenários, handlers REST, servidor Socket.IO, painel
e2e/            testes Playwright + baselines visuais
lighthouse/     configuração, script e relatórios (local/ e producao/)
docs/figma/     frames exportados do Figma (referência visual)
```
