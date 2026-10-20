import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isApiError } from '@/api/client'
import type { AddCartItemInput, Cart, NetworkId } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/query-keys'
import { guestCart, useSession } from '@/auth/session-store'
import { announce } from '@/lib/announce'

/** Dono do carrinho: usuário autenticado ou visitante. Isola o cache por dono. */
export function useCartOwner() {
  const { user } = useSession()
  return user?.id ?? guestCart.id()
}

export function useCart() {
  const owner = useCartOwner()
  return useQuery({
    queryKey: qk.cart(owner),
    queryFn: ({ signal }) => api.cart.get({ signal }),
    staleTime: 10_000,
  })
}

export function useQuote(network: NetworkId, cart: Cart | undefined) {
  const owner = useCartOwner()
  return useQuery({
    queryKey: qk.quote(owner, cart?.version ?? 0, network),
    queryFn: ({ signal }) => api.quotes.create(network, { signal }),
    enabled: !!cart && cart.items.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

function useCartMutation<V>(fn: (vars: V) => Promise<Cart>, opts: { success?: (cart: Cart, vars: V) => string | null } = {}) {
  const client = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart, vars) => {
      client.setQueryData(qk.cart(owner), cart)
      void client.invalidateQueries({ queryKey: qk.quoteAll })
      const message = opts.success?.(cart, vars)
      if (message) announce(message)
    },
    onError: (error) => {
      const message = isApiError(error) ? error.message : 'Não foi possível atualizar o carrinho.'
      toast.error(message)
      announce(message, 'assertive')
      // conflito de disponibilidade: o carrinho no servidor é a verdade
      void client.invalidateQueries({ queryKey: qk.cart(owner) })
    },
  })
}

export function useAddToCart() {
  return useCartMutation((input: AddCartItemInput & { name?: string }) => api.cart.add({ nftId: input.nftId, editionId: input.editionId, quantity: input.quantity }), {
    success: (_c, v) => `${v.name ?? 'Item'} adicionado ao carrinho.`,
  })
}

export function useUpdateCartItem() {
  return useCartMutation(({ itemId, quantity }: { itemId: string; quantity: number }) => api.cart.update(itemId, quantity), {
    success: (_cart, v) => `Quantidade atualizada para ${v.quantity}.`,
  })
}

export function useRemoveCartItem() {
  return useCartMutation(({ itemId }: { itemId: string; name: string }) => api.cart.remove(itemId), {
    success: (_cart, v) => `${v.name} removido do carrinho.`,
  })
}

export function useAcknowledgePrice() {
  return useCartMutation((itemId: string) => api.cart.acknowledge(itemId), {
    success: () => 'Novo preço confirmado.',
  })
}

export function useCoupon() {
  const client = useQueryClient()
  const owner = useCartOwner()
  const apply = useMutation({
    mutationFn: (code: string) => api.cart.applyCoupon(code),
    onSuccess: (cart) => {
      client.setQueryData(qk.cart(owner), cart)
      void client.invalidateQueries({ queryKey: qk.quoteAll })
      announce(`Cupom ${cart.coupon?.code ?? ''} aplicado: ${cart.coupon?.description ?? ''}.`)
    },
  })
  const remove = useMutation({
    mutationFn: () => api.cart.removeCoupon(),
    onSuccess: (cart) => {
      client.setQueryData(qk.cart(owner), cart)
      void client.invalidateQueries({ queryKey: qk.quoteAll })
      announce('Cupom removido.')
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'Não foi possível remover o cupom.'),
  })
  return { apply, remove }
}
