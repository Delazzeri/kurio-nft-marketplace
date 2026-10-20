import { X } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { isApiError } from '@/api/client'
import type { Cart } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { useCoupon } from './queries'

export function CouponForm({ cart }: { cart: Cart }) {
  const { apply, remove } = useCoupon()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) {
      setError('Informe o código promocional.')
      return
    }
    setError(null)
    apply.mutate(code.trim(), {
      onSuccess: () => setCode(''),
      onError: (err) => setError(isApiError(err) ? (err.fields?.code ?? err.message) : 'Não foi possível aplicar o cupom.'),
    })
  }

  if (cart.coupon) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-sm border border-success/50 px-3 py-2 text-sm" role="status">
        <span>
          Cupom <b>{cart.coupon.code}</b> aplicado — {cart.coupon.description}
        </span>
        <Button size="icon-sm" variant="ghost" aria-label={`Remover cupom ${cart.coupon.code}`} disabled={remove.isPending} onClick={() => remove.mutate()}>
          <X />
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-bold max-md:sr-only">
        Código promocional
      </label>
      <div className="flex">
        <input
          id={id}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Digite o código promocional..."
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-erro` : `${id}-dica`}
          className="h-10 min-w-0 flex-1 rounded-l-sm border border-primary bg-background px-3 text-sm aria-[invalid=true]:border-destructive max-md:h-12 max-md:rounded-l-full max-md:border-border max-md:px-5"
        />
        <Button type="submit" className="h-10 rounded-l-none px-5 text-base max-md:h-12 max-md:rounded-r-full max-md:bg-gradient-to-r max-md:from-price max-md:to-primary" disabled={apply.isPending}>
          {apply.isPending ? 'Aplicando…' : 'Aplicar'}
        </Button>
      </div>
      {error ? (
        <p id={`${id}-erro`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p id={`${id}-dica`} className="text-xs text-muted-foreground">
          Experimente KURIO10 ou GENESIS.
        </p>
      )}
    </form>
  )
}
