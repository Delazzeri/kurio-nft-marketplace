# Arquitetura — Kurio

Este documento descreve contratos, fluxo de dados, políticas de sessão/cache, reconciliação REST ↔ Socket.IO, decisões de UX, limitações e desvios do Figma.

## 1. Visão geral

```
           ┌──────────── UI (React + TanStack Router) ─────────────┐
           │ rotas → features → componentes (shadcn adaptado)      │
           └──────┬─────────────────────────────┬──────────────────┘
                  │ hooks TanStack Query        │ RealtimeProvider
                  ▼                             ▼
           endpoints tipados (zod)        socket.io-client (websocket)
                  │ Axios + interceptors        │
══════════════════╪═════════════ rede ══════════╪═══════════════════
                  ▼                             ▼
        MSW (Service Worker)          MSW ws.link + @mswjs/socket.io-binding
        handlers REST + cenários      servidor Socket.IO simulado
                  └──────────┬──────────────────┘
                             ▼
              banco do mock (localStorage) + barramento de eventos
```

- **Contratos únicos** (`src/api/contracts.ts`): schemas zod usados para validar as respostas no cliente (`request(schema, …)`), tipar hooks/UI e validar os corpos nos handlers MSW. Uma resposta fora do contrato vira `ApiError('INVALID_RESPONSE')`.
- **Nenhum componente, hook ou cliente Axios contém dados fictícios** — toda simulação está em `mocks/`, ativada por `VITE_ENABLE_MOCKS`.
- **Mudanças no banco simulado publicam eventos** no barramento; o servidor Socket.IO simulado os repassa. O mesmo dado é visto por REST e por evento.

## 2. Contratos REST

Base: `VITE_API_URL` (`/api`). Erros sempre no formato:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": { "email": "…" }, "details": {}, "retryable": false } }
```

| Código | HTTP | Uso |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400/422 | corpo/parâmetros inválidos; `fields` por campo |
| `UNAUTHENTICATED` | 401 | sem token ou token inválido |
| `SESSION_EXPIRED` | 401 | token expirado |
| `INVALID_CREDENTIALS` | 401 | login incorreto |
| `FORBIDDEN` | 403 | recurso de outro usuário (ex.: pedido) |
| `WALLET_REJECTED` | 403 | conexão simulada recusada |
| `NOT_FOUND` | 404 | recurso inexistente |
| `EMAIL_TAKEN` / `USERNAME_TAKEN` / `CONFLICT` | 409 | conflitos de cadastro/perfil/carteira |
| `AVAILABILITY_CONFLICT` | 409 | quantidade acima da disponibilidade |
| `QUOTE_STALE` | 409 | cotação desatualizada; `details.quote` traz a nova |
| `IDEMPOTENCY_CONFLICT` | 409 | mesma chave com conteúdo diferente |
| `COUPON_INVALID` / `COUPON_EXPIRED` | 422 | cupom |
| `SERVICE_UNAVAILABLE` / `INTERNAL_ERROR` | 503/500 | falha transitória (`retryable: true`) |

Erros de rede/timeout são normalizados no cliente como `NETWORK_ERROR` / `TIMEOUT` (status 0, `retryable`).

### Sessão e conta
| Método | Rota | Corpo → Resposta |
| --- | --- | --- |
| POST | `/auth/register` | `{username,email,password,confirmPassword}` → `Session` (201) · 409 com `fields` |
| POST | `/auth/login` | `{email,password}` → `Session` · 401 `INVALID_CREDENTIALS` |
| GET | `/auth/session` | → `Session` · 401 `SESSION_EXPIRED` |
| POST | `/auth/logout` | → 204 (revoga o token) |

`Session = { token, expiresAt, user: { id, email, username, displayName, avatarUrl } }` — Bearer token no header `Authorization`.

### NFTs
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/nfts?q&category*&network*&minPrice&maxPrice&tab&sort&page&pageSize` | `{ items: NftSummary[], page, pageSize, total, totalPages, facets, appliedQuery }` |
| GET | `/nfts/featured` | `{ hero: NftSummary[], spotlight }` |
| GET | `/nfts/:id` | `NftDetail` (galeria, edições com preço/disponibilidade) · 404 |
| GET | `/nfts/:id/related` | `{ items }` |

- `category`/`network` repetidos = filtros combinados (E entre grupos, OU dentro do grupo). `sort`: `recent | price-asc | price-desc | popular | name`. `tab`: `all | new | trending`.
- **Facetas** contam respeitando os demais filtros (busca facetada). `appliedQuery` ecoa o que a API aplicou.
- Todo NFT tem `version` monotônica (ordenação de eventos). Preços são **strings decimais**.

### Favoritos (autenticado)
`GET /me/favorites` → `{ nftIds }` · `PUT /me/favorites/:nftId` · `DELETE /me/favorites/:nftId`

### Carrinho (visitante ou autenticado)
Visitante é identificado por `X-Cart-Id: gc_<uuid>`; autenticado, pelo token.

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/cart` | `Cart` |
| POST | `/cart/items` | `{nftId, editionId, quantity}` → `Cart` · 409 `AVAILABILITY_CONFLICT` |
| PATCH | `/cart/items/:id` | `{quantity}` → `Cart` · 409 |
| DELETE | `/cart/items/:id` | → `Cart` |
| POST | `/cart/items/:id/acknowledge` | reconhece o novo preço (limpa `PRICE_CHANGED`) |
| POST / DELETE | `/cart/coupon` | `{code}` → `Cart` · 422 `COUPON_INVALID`/`COUPON_EXPIRED` |
| POST | `/cart/merge` | `{guestCartId}` → `Cart` do usuário (soma quantidades respeitando o limite) |

`CartItem` traz `unitPrice` atual, `acknowledgedPrice`, `available` e `issues: PRICE_CHANGED | INSUFFICIENT_AVAILABILITY | SOLD_OUT`. `Cart.version` incrementa a cada alteração.

### Cotação
`POST /quotes` `{network}` → `Quote { id, cartVersion, items[{…, unitPrice, lineTotal, nftVersion}], coupon, subtotal, discount, networkFee, total, blockingIssues, expiresAt }`. A cotação é a **referência para finalizar**: o pedido só é aceito se ela ainda reflete exatamente carrinho, preços, versões e disponibilidade (TTL 10 min).

Taxas: Ethereum 0.016 · Polygon 0.002 · Solana 0.0005 ETH.

### Carteiras e conexão simulada
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/me/wallets` | `{ primary, secondary }` |
| PUT | `/me/wallets/primary` \| `/secondary` | `WalletInput` → `{primary, secondary}` · 422 com `fields` (ex.: endereço nulo) · 409 endereço duplicado |
| PUT | `/me/wallets/secondary` | `{ sameAsPrimary: true }` espelha a principal |
| DELETE | `/me/wallets/secondary` | remove |
| POST | `/wallet-sessions` | `{walletId, network, provider}` → `WalletSession` · 403 `WALLET_REJECTED` |
| DELETE | `/wallet-sessions/:id` | desconecta |

### Pedidos (autenticado, idempotente)
| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/orders` + header `Idempotency-Key` | `{quoteId, walletId, walletSessionId, network, buyer}` → `Order` (201; 200 + `Idempotent-Replayed` ao repetir) |
| GET | `/orders?status=pending` | pedidos do usuário |
| GET | `/orders/:id` | `Order` · 403 de outro usuário · 404 |

- **Mesma chave + mesmo conteúdo → mesmo pedido**; mesma chave + conteúdo diferente → 409 `IDEMPOTENCY_CONFLICT`. Chaves são escopadas por usuário.
- `Order.receipt` é um **snapshot** (itens, preços, taxas, carteira) — o recibo nunca lê o catálogo atual.
- Ciclo: `pending` → `confirmed` | `declined` (terminais). A liquidação usa `settleAt` (timestamp), não timers: sobrevive a refresh do mock. Na confirmação: baixa de estoque (emite `nft.updated`) e remoção **apenas das quantidades compradas** do carrinho. Na recusa: nada muda no carrinho.

### Perfil (autenticado)
`GET/PATCH /me/profile` (409 com `fields` para e-mail/usuário em uso) · `PUT /me/avatar` `{dataUrl}` (≤ 300 KB; o cliente redimensiona para 256 px WebP) · `DELETE /me/avatar` · `POST /me/password` (422 se a senha atual estiver incorreta; nova senha recebe novo salt).

## 3. Eventos Socket.IO

Envelope comum: `{ eventId, type, resource: { type, id }, version, occurredAt, data }`.

| Evento | Payload `data` | Entrega |
| --- | --- | --- |
| `nft.updated` | `{ price, available, editions[{id,price,available}], previousPrice? }` | todas as conexões |
| `order.updated` | `{ status, declineReason }` + `userId` no envelope | só à conexão autenticada do dono |

**Regras no cliente** (`src/realtime/event-gate.ts`):
1. **Duplicatas**: `eventId` já visto → descartado (janela de 1000 ids).
2. **Antigos**: `version <= versão conhecida` do recurso → descartado. As versões conhecidas também vêm das **respostas REST**, então um evento atrasado nunca regride um dado mais novo obtido por consulta.
3. **Isolamento**: `order.updated` com `userId` diferente do usuário atual é ignorado; além disso o servidor só entrega ao dono.
4. **Ciclo de vida**: uma conexão por sessão (token). Login/logout/troca de usuário encerram a conexão anterior e removem todos os listeners (`removeAllListeners` no cleanup do efeito).

**Aplicação** (`apply-events.ts`): `nft.updated` atualiza detalhe, listas, destaques e relacionados via `setQueryData`; se o NFT está no carrinho, invalida carrinho/cotação (o servidor recalcula `issues`) e anuncia a mudança (toast + `aria-live` assertivo). `order.updated` invalida o pedido (o snapshot completo vem do REST) e, se terminal, o carrinho.

## 4. Reconciliação REST ↔ Socket.IO

- **REST é a fonte da verdade**; eventos são sinais para atualizar/invalidar.
- **Reconexão**: no `connect` após uma queda, invalidamos catálogo, carrinho, cotação e pedidos — eventos perdidos durante a queda são recuperados por consulta.
- **Pedido pendente**: além do evento, a página do pedido faz *polling* a cada 4 s enquanto `pending` (fallback). Após refresh, o pedido é recuperado por `GET /orders/:id` e o checkout mostra "pedido em processamento" via `GET /orders?status=pending`. Nenhuma nova compra é criada.
- **Checkout**: o usuário revisa uma cotação; se outra cotação chega (evento → invalidação) com valores diferentes, o diálogo mostra "valores mudaram" (antes → depois) e **bloqueia a confirmação** até o usuário revisar. Se a mudança acontece no servidor durante o envio, o 409 `QUOTE_STALE` produz o mesmo fluxo.

## 5. Política de sessão

- Token + usuário em `localStorage` (`kurio:session`) para recuperar após refresh; a validade é sempre confirmada em `GET /auth/session` antes de liberar rotas privadas (`/_auth` → `beforeLoad`).
- Qualquer **401 numa chamada autenticada** (somente se o token usado ainda é o atual) encerra a sessão como `expired`. Um timer também consulta a API quando `expiresAt` vence (expiração durante a navegação).
- Ao expirar numa rota privada → `/entrar?redirect=<rota atual>&motivo=expirada`. O **rascunho do checkout** fica em `localStorage` por usuário e é restaurado após o novo login (outro usuário não o vê).
- **Logout / troca de usuário**: remove todo cache `['private', …]`, carrinho e cotações do cache; fecha o socket da sessão anterior. Logout revoga o token no servidor.
- Rotas privadas: pagamento, pedidos, perfil, carteiras, favoritos (lista). Visitante pode navegar, montar carrinho e é levado ao login ao favoritar/finalizar, voltando ao ponto de origem.
- Senhas: nunca em claro — o mock guarda `sha256(salt:senha)`; o cliente não persiste senhas.

## 6. Estado do carrinho

- O carrinho vive **no servidor** (mock) para visitante (`X-Cart-Id`) e usuário — sobrevive a refresh e é consistente com cotação e pedidos.
- **Login preserva os itens do visitante**: `POST /cart/merge` soma quantidades (respeitando disponibilidade e limite de 10 por item), mantém o cupom e descarta o carrinho visitante; um novo id visitante é gerado. Há proteção contra a corrida entre o GET do carrinho e a mescla.
- Mudanças de preço/disponibilidade marcam `issues` por item; "Conectar e finalizar" fica bloqueado até o usuário reconhecer o novo preço ou ajustar a quantidade.
- Valores: subtotal, desconto, taxa e total exibidos **sempre da cotação da API**; o cliente só formata (big.js). Quantidades são inteiras.

## 7. Estratégia de cache (TanStack Query)

| Aspecto | Política |
| --- | --- |
| Chaves | públicas `['nfts', …]`; privadas `['private', userId, …]`; carrinho `['cart', dono]`; cotação `['quote', dono, cartVersion, rede]` |
| `staleTime` | 30 s (padrão), 10 s carrinho, 15 s cotação, 60 s destaques |
| Retries | só consultas e só falhas transitórias (`retryable`: rede, timeout, 5xx), até 2x com backoff exponencial (800 ms → 4 s). 4xx nunca |
| Mutations | **nunca** repetem automaticamente. Exceção controlada: criação de pedido reenvia até 2x em falha transitória **com a mesma chave de idempotência** |
| Cancelamento | todas as consultas recebem `signal` (Axios aborta). Mudar filtros cancela a requisição anterior; respostas fora de ordem não afetam a chave atual |
| Transições | `keepPreviousData` no catálogo e na cotação (sem piscar; opacidade indica atualização em segundo plano) |
| Otimista | **favoritos**: atualiza na hora, rollback em erro (inclusive sem cache prévio), toast com "Tentar novamente", reconciliação no `onSettled` |
| Invalidação | mutations de carrinho gravam a resposta e invalidam cotações; cupom idem; eventos conforme seção 3; reconexão conforme seção 4 |
| Refetch | ao focar a janela (padrão) |
| Clique repetido | o pedido reutiliza a promessa em voo + botão desabilitado + idempotência no servidor |

## 8. URL como estado

Busca, filtros, faixa de preço, aba, ordenação e página vivem na URL (`?q=&cat=musica,arte-3d&net=ethereum&min=&max=&tab=&sort=&page=`), validados por zod (valores inválidos são descartados sem quebrar a página). Mudança de filtro reinicia a paginação. A serialização foi customizada (listas separadas por vírgula) para URLs legíveis — o padrão do TanStack Router é JSON.

## 9. Mocking (MSW)

- `mocks/db.ts`: estado completo (usuários, sessões, NFTs, favoritos, carrinhos, cotações, pedidos, idempotência, carteiras) persistido em `localStorage` (`kurio:mock:db:v1`); `reset()` restaura o seed.
- `mocks/http.ts` (`withNetwork`): aplica a latência e as falhas do cenário a todo handler (erro de rede, timeout, HTTP 4xx/5xx, falha só nas N primeiras chamadas).
- `mocks/control.ts`: API de controle (`window.__kurioMock`) para o painel e os testes — altera dados (gerando eventos), duplica/envelhece eventos, derruba o socket, expira sessões.
- O mock é carregado **antes** do primeiro render e está no build de demonstração (Vercel).

### Transporte Socket.IO no ambiente de mocks — e limitações
- `ws.link('wss://realtime.kurio.mock/*')` intercepta o `WebSocket` do navegador; `@mswjs/socket.io-binding` faz o encode/decode dos protocolos engine.io/socket.io. O app usa o `socket.io-client` real.
- **Somente transporte `websocket`**: long-polling é HTTP e não é tratado pelo binding (`transports: ['websocket']`).
- **Handshake sintético**: o binding responde com `sid` fixo e `pingInterval` de 25 s; o servidor simulado envia `ping` engine.io a cada 20 s para manter a conexão.
- **Sem rooms/namespaces/ack**: o roteamento por usuário é feito no handler a partir do token enviado no pacote `CONNECT` (`40{"token":…}`).
- **Ordem de carregamento**: o `engine.io-client` captura `globalThis.WebSocket` ao avaliar o módulo; por isso o `socket.io-client` é importado sob demanda pelo provider, sempre depois do MSW instalado.
- Interceptação acontece na aba: cada aba tem seu próprio "servidor" (sem broadcast entre abas).

## 10. Interface, acessibilidade e responsividade

- Tokens de cor extraídos dos frames por amostragem de pixels (`src/styles.css`); tipografia Roboto Mono (variável, self-hosted via Fontsource).
- Desktop (≥ 768 px) segue os frames desktop; mobile segue os frames mobile (tab bar inferior, barras de topo por tela, cards arredondados, painel de resumo). Perfil, carteiras, pedido e confirmação foram adaptados ao mobile no mesmo padrão. Testado em 390, 768 e 1440 px sem overflow horizontal.
- Skeletons com shimmer nos componentes dependentes de dados (catálogo, destaque, detalhe, carrinho, totais, checkout), com dimensões do conteúdo final (sem CLS) e desligados em `prefers-reduced-motion`.
- A11y: link "Pular para o conteúdo", foco movido para o `<main>` a cada navegação, foco visível, diálogos/drawers com foco preso e devolvido, labels em todos os campos (visualmente ocultos onde o Figma usa só placeholder), erros associados via `aria-describedby` + `aria-invalid` + foco no primeiro campo inválido, regiões `aria-live` (polite/assertive) para mutations e eventos em tempo real, estados não dependentes só de cor (indicadores, textos, ícones), textos alternativos descritivos nas artes. Verificado com axe-core nos testes.

### Ajustes de acessibilidade em relação ao layout
- Campos do login/cadastro têm `<label>` acessível (oculto visualmente) além do placeholder.
- Asterisco de obrigatório é decorativo; o rótulo anuncia "(obrigatório)".
- Ações fora do escopo (Criadores, Aprenda, blog, central de ajuda, login social, recuperar senha, newsletter, itens "Atividade/Ofertas/Arquivos/Suporte") **não simulam sucesso**: aparecem como "Em breve" ou exibem aviso explícito de indisponibilidade.

## 11. Decisões de UX e desvios do Figma

| Tema | Decisão |
| --- | --- |
| Login/cadastro | Rotas próprias (`/entrar`, `/cadastro`) para acesso direto/refresh e retorno via `redirect`; no desktop mantêm o visual de modal do Figma, no mobile são tela cheia como nos frames |
| Revisão antes do envio | "Revisar e confirmar compra" abre um diálogo de revisão com a cotação; o envio só acontece em "Confirmar compra" (o Figma tem só "Confirmar compra") |
| Carteira e rede | Desktop: carteira cadastrada definida no formulário ("Usar outra carteira?") e **provedor** (MetaMask/WalletConnect/Coinbase) na lateral; selecionar o provedor dispara a conexão simulada (com recusa/desconexão). Mobile segue o frame (carteiras cadastradas + provedores) |
| Formulário de pagamento no mobile | O frame mobile não mostra os dados do colecionador; mantivemos o formulário (pré-preenchido do perfil) abaixo da seleção de carteira, pois os campos são obrigatórios no desktop |
| Busca | Ícone de busca no header (desktop) e barra "Explorar coleções" (mobile); termo ativo aparece como chip removível |
| Filtros ativos | Chips removíveis + "Limpar tudo" (não desenhados) |
| Perfil | "Salvar" do perfil e "Alterar senha" são formulários independentes (erros e sucesso separados) |
| Lista de interesse | Implementada como `/perfil/favoritos` (o enunciado exige favoritos persistentes) |
| Avaliações | A aba mostra nota/quantidade; a leitura de avaliações individuais está fora do escopo |
| Recibo | Fiel ao frame; o botão "Ver no Etherscan" aponta para um hash simulado e informa que é simulado |
| Ícones | Lucide no lugar do conjunto Iconly do Figma (equivalentes visuais, tree-shaking) |

### Assets
- As 4 ilustrações foram exportadas do Figma (originais em `docs/assets/nfts/`, 500×500) e convertidas para WebP (500 px e 400 px para os cards via `srcset`). Os 36 NFTs do seed reutilizam essas 4 artes (o arquivo do Figma não traz mais artes).
- Ícone "THANK YOU" do recibo redesenhado em SVG inline.
- Fonte: Roboto Mono (auto-hospedada), a mais próxima da tipografia monoespaçada do layout.
- Frames de referência exportados em `docs/figma/`.

## 12. Limitações conhecidas

- Toda a "API" roda no navegador (MSW): dados são por navegador/aba; não há concorrência real entre usuários.
- O preço do catálogo (`price`) é o da edição padrão (1/50); as demais edições têm multiplicadores fixos.
- Reviews individuais, login social, recuperação de senha e páginas editoriais estão fora do escopo.
- Baselines visuais são específicas do SO (renderização de fontes); geradas em Windows.

## 13. Performance e Lighthouse

Auditoria versionada em `lighthouse/` (`pnpm lighthouse`): build otimizado servido por `vite preview`, mocks ativos no **cenário padrão**, perfil de navegador limpo por execução, **3 medições por página/perfil** e mediana por categoria. Relatórios HTML/JSON de cada execução, versões e condições em [`lighthouse/reports/`](./lighthouse/reports/summary.md).

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | mobile | 71 | 100 | 100 | 100 | 4,1 s | 0,022 | 366 ms |
| Início | desktop | 99 | 100 | 100 | 100 | 0,87 s | 0,002 | 11 ms |
| Detalhe | mobile | 79 | 99 | 100 | 100 | 3,6 s | 0,000 | 261 ms |
| Detalhe | desktop | 99 | 100 | 100 | 100 | 0,83 s | 0,006 | 0 ms |

Ambiente: Lighthouse 13.5.0, Chromium 156 (Playwright), Node 24, Windows 11, i5-13420H. Mobile = Moto G Power emulado com throttling simulado (4G lento, CPU 4×); desktop = `desktop-config`.

### Otimizações aplicadas (sem simplificar a entrega)
| Mudança | Efeito medido |
| --- | --- |
| Render imediato do app; REST/Socket.IO aguardam `mocksReady` | o shell e os skeletons não esperam o MSW |
| `socket.io-client` importado sob demanda | fora do bundle crítico |
| `modulepreload` dos chunks do App e dos mocks no HTML | downloads em paralelo com o entry |
| Shim de `tldts` (lista de sufixos públicos usada pelo cookie store do MSW) | chunk dos mocks 366 KB → 103 KB (gzip 142 → 34 KB); LCP mobile −0,6 a −0,8 s |
| `<main>` com altura mínima de uma tela e `scrollbar-gutter: stable` | CLS do detalhe desktop 0,225 → 0,006 (Performance 87 → 99) |
| Imagens WebP 400/500 px com `srcset`, dimensões fixas, `fetchpriority` nos 3 primeiros cards; fonte auto-hospedada com `font-display: swap` | sem CLS de imagem/fonte |

### Por que o mobile fica abaixo de 90
- **Causa principal — a API roda no navegador.** Antes de qualquer dado existir, o dispositivo precisa baixar e executar o runtime do MSW, registrar o Service Worker e só então responder ao catálogo; a imagem do primeiro card (elemento de LCP) só é pedida depois disso. Com um backend real, esse código não existiria no cliente e o LCP passaria a depender só da latência da API.
- **Custo de JavaScript sob CPU 4×.** A thread principal soma ~2,5 s (≈1,3 s de avaliação de script) para React, Router, Query, zod (validação de contratos) e a camada de mocks. Isso explica o FCP de ~3,4 s e o TBT de 260–370 ms. No desktop (CPU 1×) as mesmas páginas ficam em 99.
- **Caminhos avaliados e não adotados:** SSR/pré-renderização (fora do escopo de uma SPA com dados simulados no navegador) e um *app shell* estático no `index.html` (risco de CLS ao trocar pelo React e de divergência visual). Remover os mocks ou trocar os dados por conteúdo estático na auditoria foi descartado por ser uma simplificação exclusiva para a pontuação.
- Accessibility, Best Practices e SEO atingem as metas em todas as páginas e perfis.
