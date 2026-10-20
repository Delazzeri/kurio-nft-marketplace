import { z } from 'zod'
import { buyerSchema, networkIds } from '@/api/contracts'

/** Formulário do pagamento: dados do comprador + rede + carteira escolhida. */
export const checkoutSchema = buyerSchema.extend({
  network: z.enum(networkIds, { message: 'Selecione uma rede' }),
  useSecondary: z.boolean(),
})

export type CheckoutForm = z.input<typeof checkoutSchema>
