import type { Quote } from '@/api/contracts'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

/** Totais SEMPRE vindos da cotação da API (fonte de verdade para finalizar). */
export function OrderTotals({ quote, loading, className }: { quote: Pick<Quote, 'subtotal' | 'discount' | 'networkFee' | 'total' | 'coupon'> | undefined; loading?: boolean; className?: string }) {
  if (!quote) {
    return (
      <div className={cn('flex flex-col gap-3', className)} aria-busy="true" aria-label="Calculando totais" data-testid="totals-skeleton">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex justify-between">
            <div className="skeleton h-5 w-28" />
            <div className="skeleton h-5 w-24" />
          </div>
        ))}
      </div>
    )
  }
  const hasDiscount = Number(quote.discount) > 0
  return (
    <dl className={cn('flex flex-col gap-3 transition-opacity', loading && 'opacity-60', className)} aria-busy={loading} data-testid="order-totals">
      <div className="flex justify-between gap-3">
        <dt>Subtotal</dt>
        <dd className="text-base tabular-nums" data-testid="subtotal">
          {formatEth(quote.subtotal)}
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt>
          Desconto do lançamento
          {quote.coupon && <span className="block text-xs text-muted-foreground">Cupom {quote.coupon.code}</span>}
        </dt>
        <dd className={cn('tabular-nums', hasDiscount && 'text-success')} data-testid="discount">
          (-) {hasDiscount ? formatEth(quote.discount) : '00.00'}
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt>Taxa de rede</dt>
        <dd className="text-right tabular-nums" data-testid="network-fee">
          <span className="text-base">{formatEth(quote.networkFee)}</span>
          <span className="block text-[11px] text-primary">Taxa estimada</span>
        </dd>
      </div>
      <div className="flex justify-between gap-3 border-t border-border pt-4 font-bold">
        <dt>Total</dt>
        <dd className="text-lg text-price tabular-nums" data-testid="total">
          {formatEth(quote.total)}
        </dd>
      </div>
    </dl>
  )
}
