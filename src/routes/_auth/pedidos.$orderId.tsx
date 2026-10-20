import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Loader2, WifiOff, X, XCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { isApiError } from '@/api/client'
import { networks, type Order } from '@/api/contracts'
import { useSession } from '@/auth/session-store'
import { ErrorState, NotFound } from '@/components/states'
import { Button } from '@/components/ui/button'
import { pendingOrderStore, useOrder } from '@/features/checkout/order-hooks'
import { announce } from '@/lib/announce'
import { formatEth } from '@/lib/eth'
import { useRealtime } from '@/realtime/RealtimeProvider'

export const Route = createFileRoute('/_auth/pedidos/$orderId')({
  head: () => ({ meta: [{ title: 'Pedido — Kurio' }] }),
  component: OrderPage,
})

const shortHash = (h: string) => `${h.slice(0, 6).toUpperCase()}…${h.slice(-4).toUpperCase()}`.replace('0X', '0x')
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

function OrderPage() {
  const { orderId } = Route.useParams()
  const { user } = useSession()
  const { data: order, error, isPending, refetch, isFetching } = useOrder(orderId)
  const lastStatus = useRef<Order['status'] | null>(null)

  useEffect(() => {
    if (!order || !user) return
    if (lastStatus.current && lastStatus.current !== order.status) {
      announce(order.status === 'confirmed' ? 'Pagamento confirmado. Seus NFTs estão na sua carteira.' : order.status === 'declined' ? 'Pagamento recusado.' : '', 'assertive')
    }
    lastStatus.current = order.status
    // pedidos confirmados/recusados são terminais
    if (order.status !== 'pending') pendingOrderStore.clear(user.id)
  }, [order, user])

  if (isPending) {
    return (
      <div className="container-page flex justify-center py-24" aria-busy="true">
        <div className="skeleton h-[480px] w-full max-w-[578px]" />
      </div>
    )
  }
  if (isApiError(error) && (error.status === 404 || error.status === 403)) {
    return <NotFound title={error.status === 403 ? 'Pedido de outro usuário' : 'Pedido não encontrado'} description={error.message} />
  }
  if (!order) return <ErrorState className="container-page mt-10" error={error} onRetry={() => void refetch()} retrying={isFetching} />

  if (order.status === 'pending' || (order.status === 'confirmed' && !order.transaction)) return <PendingOrder order={order} />
  if (order.status === 'declined') return <DeclinedOrder order={order} />
  return <Receipt order={order} />
}

function PendingOrder({ order }: { order: Order }) {
  const { status } = useRealtime()
  return (
    <section aria-labelledby="pedido-titulo" className="container-page flex justify-center py-20" data-testid="order-pending">
      <div className="flex w-full max-w-[578px] flex-col items-center gap-4 border-b-8 border-primary bg-card px-8 py-12 text-center" role="status">
        <Loader2 aria-hidden className="size-12 animate-spin text-primary" />
        <h1 id="pedido-titulo" className="text-lg font-bold">
          Aguardando confirmação da rede…
        </h1>
        <p className="text-sm text-muted-foreground">
          Pedido <b className="text-foreground">{order.id}</b> criado. Total {formatEth(order.receipt.total)}.
        </p>
        <p className="text-xs text-muted-foreground">Você pode recarregar a página ou fechar a aba: o status será recuperado sem criar outra compra.</p>
        {status !== 'connected' && (
          <p className="flex items-center gap-2 text-xs text-price">
            <WifiOff aria-hidden className="size-4" /> Reconectando ao tempo real… consultando o status pela API.
          </p>
        )}
      </div>
    </section>
  )
}

function DeclinedOrder({ order }: { order: Order }) {
  return (
    <section aria-labelledby="pedido-titulo" className="container-page flex justify-center py-20" data-testid="order-declined">
      <div className="flex w-full max-w-[578px] flex-col items-center gap-4 border-b-8 border-destructive bg-card px-8 py-12 text-center" role="alert">
        <XCircle aria-hidden className="size-12 text-destructive" />
        <h1 id="pedido-titulo" className="text-lg font-bold">
          Pagamento recusado
        </h1>
        <p className="text-sm text-muted-foreground">{order.declineReason ?? 'A transação não foi concluída.'}</p>
        <p className="text-sm">Seus itens continuam no carrinho. Nenhum valor foi cobrado.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link to="/pagamento">Tentar novamente</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/carrinho">Ver carrinho</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

/** Recibo = snapshot do pedido (não lê o catálogo atual). */
function Receipt({ order }: { order: Order }) {
  const navigate = useNavigate()
  const r = order.receipt
  const tx = order.transaction!
  const networkLabel = networks.find((n) => n.id === r.network)?.label ?? r.network
  return (
    <section aria-labelledby="recibo-titulo" className="flex justify-center px-4 py-12 md:py-[110px]" data-testid="order-confirmed">
      <div className="relative w-full max-w-[578px] border-b-[10px] border-primary bg-card">
        <button type="button" aria-label="Fechar recibo" onClick={() => void navigate({ to: '/' })} className="absolute top-4 right-4 text-primary hover:text-price">
          <X aria-hidden className="size-5" />
        </button>
        <div className="flex flex-col items-center gap-4 px-6 pt-6 pb-5 text-center">
          <ThankYouIcon />
          <h1 id="recibo-titulo" className="text-base font-bold text-[#e0b98e]">
            Seus NFTs agora estão na sua carteira
          </h1>
        </div>
        <dl className="grid grid-cols-2 gap-y-3 border-y border-primary px-6 py-3 text-sm sm:grid-cols-4 sm:divide-x sm:divide-primary">
          <div className="sm:pr-3">
            <dt className="font-bold text-[#e0b98e]">ID da transação</dt>
            <dd className="text-muted-foreground" title={tx.hash}>
              {shortHash(tx.hash)}
            </dd>
          </div>
          <div className="sm:px-3">
            <dt className="text-[#e0b98e]">Data</dt>
            <dd className="text-muted-foreground">{dateFmt.format(new Date(tx.confirmedAt))}</dd>
          </div>
          <div className="sm:px-3">
            <dt className="text-[#e0b98e]">Total</dt>
            <dd className="text-muted-foreground">{formatEth(r.total)}</dd>
          </div>
          <div className="sm:pl-3">
            <dt className="font-bold text-[#e0b98e]">Carteira</dt>
            <dd className="text-muted-foreground">{r.wallet.label}</dd>
          </div>
        </dl>
        <div className="px-6 py-6 sm:px-11">
          <h2 className="text-sm font-bold">Detalhes da transação</h2>
          <table className="mt-2 w-full text-sm">
            <caption className="sr-only">Itens comprados</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="py-2 font-bold">
                  NFTs
                </th>
                <th scope="col" className="px-2 py-2 text-center font-bold">
                  Edições
                </th>
                <th scope="col" className="py-2 pl-2 text-right font-bold">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {r.items.map((i) => (
                <tr key={i.cartItemId}>
                  <td className="py-2">
                    <div className="flex items-center gap-3">
                      <img src={i.image} alt="" width={66} height={66} className="size-[66px] rounded-sm object-cover" />
                      <div>
                        <p className="font-bold">{i.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ID do token: {i.tokenId} · {i.editionLabel}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center whitespace-nowrap">(x {i.quantity})</td>
                  <td className="py-2 pl-2 text-right font-bold whitespace-nowrap text-price">{formatEth(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-3 ml-auto flex max-w-[320px] flex-col gap-1 border-b border-border pb-3 text-sm">
            {Number(r.discount) > 0 && (
              <div className="flex justify-between">
                <dt>Desconto{r.coupon ? ` (${r.coupon.code})` : ''}</dt>
                <dd>(-) {formatEth(r.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>Taxa de rede</dt>
              <dd className="text-base">{formatEth(r.networkFee)}</dd>
            </div>
            <div className="flex justify-between font-bold">
              <dt>Total</dt>
              <dd className="text-base text-price">{formatEth(r.total)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-center text-sm leading-relaxed text-muted-foreground">
            Transação confirmada na {networkLabel}. A propriedade foi transferida para sua carteira conectada e registrada na rede.
          </p>
          <div className="mt-5 flex justify-center">
            <Button asChild size="lg" className="h-12">
              <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer">
                Ver no Etherscan <span className="sr-only">(simulado, abre em nova aba)</span>
              </a>
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">Referência e link de exploração simulados.</p>
        </div>
      </div>
    </section>
  )
}

function ThankYouIcon() {
  return (
    <svg aria-hidden viewBox="0 0 70 84" className="h-20 w-[68px] fill-none stroke-primary" strokeWidth="2.5" strokeLinejoin="round">
      <path d="M8 34 35 4l27 30" />
      <rect x="10" y="8" width="50" height="38" rx="3" className="fill-card" />
      <path d="M3 34v44h64V34L35 58 3 34Z" className="fill-card" />
      <path d="M3 78l24-22M67 78 43 56" />
      <text x="35" y="22" textAnchor="middle" className="fill-primary stroke-none text-[10px] font-bold">
        THANK
      </text>
      <text x="35" y="34" textAnchor="middle" className="fill-primary stroke-none text-[10px] font-bold">
        YOU
      </text>
    </svg>
  )
}
