import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

export function Price({
  value,
  compareAt,
  className,
}: {
  value: string
  compareAt?: string
  className?: string
}) {
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-2 font-bold text-price', className)}>
      <span>{formatEth(value)}</span>
      {compareAt && (
        <s className="font-normal text-muted-foreground">
          <span className="sr-only">Preço anterior: </span>
          {formatEth(compareAt)}
        </s>
      )}
    </span>
  )
}
