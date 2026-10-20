import { useCart } from '@/features/cart/queries'

/** Contador do carrinho (carregado sob demanda: depende da camada de dados). */
export default function CartCountBadge() {
  const { data } = useCart()
  const count = data?.itemCount ?? 0
  return (
    <>
      <span className="sr-only">
        , {count} {count === 1 ? 'item' : 'itens'}
      </span>
      {count > 0 && (
        <span aria-hidden className="absolute top-0.5 right-0 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-bold text-primary-foreground">
          {count}
        </span>
      )}
    </>
  )
}
