import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Loader2, PlugZap, Unplug } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { isApiError } from '@/api/client'
import { buyerSchema, networkIds, networks, walletTypes, type Quote, type Wallet } from '@/api/contracts'
import { qk } from '@/api/query-keys'
import { useSession } from '@/auth/session-store'
import { FormAlert, TextField } from '@/components/form'
import { ErrorState } from '@/components/states'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useProfile } from '@/features/account/queries'
import { CouponForm } from '@/features/cart/CouponForm'
import { OrderTotals } from '@/features/cart/OrderTotals'
import { useCart, useQuote } from '@/features/cart/queries'
import { QuoteStaleError, usePendingOrder, useSubmitOrder } from '@/features/checkout/order-hooks'
import { useWalletConnection, useWallets } from '@/features/checkout/wallet-connection'
import { WalletsPill } from '@/components/layout/Footer'
import { announce } from '@/lib/announce'
import { formatEth } from '@/lib/eth'
import { storage } from '@/lib/storage'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_auth/pagamento')({
  head: () => ({ meta: [{ title: 'Pagamento — Kurio' }] }),
  component: CheckoutPage,
})

const checkoutSchema = buyerSchema.extend({
  network: z.enum(networkIds, { message: 'Selecione uma rede' }),
  useSecondary: z.boolean(),
})
type CheckoutForm = z.input<typeof checkoutSchema>

const draftKey = (uid: string) => `kurio:checkout-draft:${uid}`
const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)

/** Impressão digital dos valores que o usuário revisou. */
function fingerprint(q: Quote) {
  return JSON.stringify([q.subtotal, q.discount, q.networkFee, q.total, q.items.map((i) => [i.nftId, i.editionId, i.quantity, i.unitPrice])])
}

function CheckoutPage() {
  const { user } = useSession()
  const uid = user!.id
  const navigate = useNavigate()
  const client = useQueryClient()
  const cart = useCart()
  const wallets = useWallets()
  const profile = useProfile()
  const pending = usePendingOrder()
  const submit = useSubmitOrder()
  const { session, connect, disconnect, reset: resetSession } = useWalletConnection()

  const draft = useMemo(() => storage.get<CheckoutForm>(draftKey(uid)), [uid])
  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: draft ?? {
      displayName: '',
      username: '',
      profileName: '',
      email: '',
      ensName: '',
      referralCode: '',
      note: '',
      network: 'ethereum',
      useSecondary: false,
    },
  })
  const { register, control, watch, setValue, formState } = form

  // pré-preenche com perfil/carteira (sem sobrescrever rascunho salvo)
  useEffect(() => {
    if (draft || !profile.data || !wallets.data) return
    const w = wallets.data.primary
    form.reset({
      displayName: profile.data.displayName,
      username: profile.data.username,
      email: profile.data.email,
      ensName: profile.data.ensName,
      profileName: w?.profileName ?? profile.data.username,
      referralCode: w?.referralCode ?? '',
      note: '',
      network: w?.network ?? 'ethereum',
      useSecondary: false,
    })
  }, [draft, profile.data, wallets.data, form])

  // rascunho preservado (sessão expirada → login → retomada)
  useEffect(() => {
    const sub = watch((values) => storage.set(draftKey(uid), values))
    return () => sub.unsubscribe()
  }, [watch, uid])

  const network = watch('network')
  const useSecondary = watch('useSecondary')
  const wallet: Wallet | null = (useSecondary ? wallets.data?.secondary : wallets.data?.primary) ?? null
  const connected = !!session && !!wallet && session.walletId === wallet.id && session.network === network
  const quote = useQuote(network, cart.data)

  // trocar carteira/rede invalida a conexão
  useEffect(() => {
    if (session && (!wallet || session.walletId !== wallet.id || session.network !== network)) resetSession()
  }, [wallet, network, session, resetSession])

  const [review, setReview] = useState<Quote | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [preflightError, setPreflightError] = useState<string | null>(null)

  const current = quote.data
  const changed = !!review && !!current && fingerprint(review) !== fingerprint(current)
  const blocked = !!current && current.blockingIssues.length > 0

  useEffect(() => {
    if (changed && reviewOpen) announce('Os valores do pedido mudaram. Revise e confirme novamente.', 'assertive')
  }, [changed, reviewOpen])

  const openReview = form.handleSubmit(
    () => {
      setPreflightError(null)
      if (!wallet) return setPreflightError('Cadastre uma carteira para continuar.')
      if (!connected) return setPreflightError('Conecte a carteira selecionada para continuar.')
      if (!current || quote.isFetching) return setPreflightError('Aguarde a atualização dos valores.')
      if (blocked) return setPreflightError('Há itens indisponíveis no pedido. Ajuste o carrinho.')
      setSubmitError(null)
      setReview(current)
      setReviewOpen(true)
    },
    () => setPreflightError('Revise os campos destacados.'),
  )

  const confirm = () => {
    if (!review || !wallet || !session || changed || submit.isPending) return
    const values = checkoutSchema.parse(form.getValues())
    setSubmitError(null)
    submit.mutate(
      {
        quoteId: review.id,
        walletId: wallet.id,
        walletSessionId: session.id,
        network: values.network,
        buyer: {
          displayName: values.displayName,
          username: values.username,
          profileName: values.profileName,
          email: values.email,
          ensName: values.ensName,
          referralCode: values.referralCode,
          note: values.note ?? '',
        },
      },
      {
        onSuccess: (order) => {
          storage.remove(draftKey(uid))
          setReviewOpen(false)
          void navigate({ to: '/pedidos/$orderId', params: { orderId: order.id } })
        },
        onError: (error) => {
          if (error instanceof QuoteStaleError) {
            setSubmitError(error.message)
            void client.invalidateQueries({ queryKey: qk.cartAll })
            void client.invalidateQueries({ queryKey: qk.quoteAll })
            return
          }
          if (isApiError(error) && error.code === 'CONFLICT') resetSession()
          setSubmitError(isApiError(error) ? error.message : 'Não foi possível enviar o pedido.')
        },
      },
    )
  }

  if (cart.isPending || wallets.isPending || profile.isPending) return <CheckoutSkeleton />
  if (!cart.data) return <ErrorState className="container-page mt-8" error={cart.error} onRetry={() => void cart.refetch()} />

  if (cart.data.items.length === 0) {
    return (
      <div className="container-page flex flex-col items-center gap-4 py-20 text-center">
        <h1 className="text-xl font-bold">Seu carrinho está vazio</h1>
        {pending.data && <PendingBanner orderId={pending.data.id} />}
        <Button asChild>
          <Link to="/" hash="catalogo">
            Explorar NFTs
          </Link>
        </Button>
      </div>
    )
  }

  const errors = formState.errors

  return (
    <div className="container-page pt-6">
      <Breadcrumb>
        <BreadcrumbList className="text-sm font-semibold text-foreground">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Início</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/carrinho">Carrinho</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-semibold text-foreground">Pagamento</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <h1 className="sr-only">Pagamento</h1>
      {pending.data && <PendingBanner orderId={pending.data.id} className="mt-4" />}

      <form onSubmit={openReview} noValidate className="mt-6 grid gap-10 lg:grid-cols-[1fr_405px] lg:gap-8">
        <section aria-labelledby="perfil-titulo" className="flex flex-col gap-5">
          <h2 id="perfil-titulo" className="text-base font-bold">
            Perfil do colecionador
          </h2>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <TextField label="Nome de exibição" required autoComplete="name" error={errors.displayName?.message} {...register('displayName')} />
            <TextField label="Nome de usuário" required autoComplete="username" error={errors.username?.message} {...register('username')} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="rede" className="text-sm">
                Rede<span aria-hidden className="ml-0.5 text-destructive">*</span>
                <span className="sr-only"> (obrigatório)</span>
              </label>
              <Controller
                control={control}
                name="network"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="rede" className="w-full" aria-invalid={!!errors.network}>
                      <SelectValue placeholder="Selecione uma rede" />
                    </SelectTrigger>
                    <SelectContent>
                      {networks.map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <TextField label="Nome do perfil" required error={errors.profileName?.message} {...register('profileName')} />
            <TextField label="Endereço da carteira" required readOnly value={wallet?.address ?? ''} placeholder="Endereço 0x da carteira" hint="Definido pela carteira selecionada." />
            <TextField label="ENS ou carteira secundária (opcional)" readOnly value={wallet?.secondaryAddress ?? ''} placeholder="ENS ou carteira secundária (opcional)" />
            <TextField label="Tipo de carteira" required readOnly value={walletTypes.find((t) => t.id === wallet?.walletType)?.label ?? ''} placeholder="Selecione uma carteira" />
            <TextField label="Código de indicação" required error={errors.referralCode?.message} {...register('referralCode')} />
            <TextField label="E-mail" required type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
            <TextField
              label="Nome ENS"
              required
              error={errors.ensName?.message}
              inputClassName="pr-14"
              addon={<span className="flex h-10 items-center rounded-sm border border-border px-3 text-sm">.eth</span>}
              {...register('ensName')}
            />
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" {...register('useSecondary')} disabled={!wallets.data?.secondary} />
            Usar outra carteira?
            {!wallets.data?.secondary && (
              <Link to="/perfil/carteiras" className="text-xs text-primary underline">
                cadastrar carteira secundária
              </Link>
            )}
          </label>
          <div className="flex max-w-[350px] flex-col gap-1.5">
            <label htmlFor="observacao" className="text-sm">
              Observação do colecionador (opcional)
            </label>
            <Textarea id="observacao" rows={6} className="min-h-36" aria-invalid={!!errors.note} aria-describedby={errors.note ? 'obs-erro' : undefined} {...register('note')} />
            {errors.note && (
              <p id="obs-erro" className="text-xs text-destructive">
                {errors.note.message}
              </p>
            )}
          </div>
        </section>

        <aside aria-labelledby="seus-nfts" className="flex flex-col gap-5">
          <h2 id="seus-nfts" className="text-base font-bold">
            Seus NFTs
          </h2>
          <ul className="flex flex-col gap-3">
            {(current?.items ?? []).map((i) => (
              <li key={i.cartItemId} className="grid grid-cols-[62px_1fr_auto] items-center gap-3 bg-card p-1 pr-4">
                <img src={i.image} alt={i.imageAlt} width={62} height={62} className="size-[62px] object-cover" />
                <div className="min-w-0">
                  <p className="truncate font-bold">{i.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ID do token: {i.tokenId} · {i.editionLabel} · (x {i.quantity})
                  </p>
                </div>
                <p className="font-bold text-price">{formatEth(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <details className="text-sm">
            <summary className="cursor-pointer text-center">Tem um código promocional? Aplique aqui</summary>
            <div className="mt-3">
              <CouponForm cart={cart.data} />
            </div>
          </details>
          {quote.isError && !current ? (
            <ErrorState error={quote.error} onRetry={() => void quote.refetch()} retrying={quote.isFetching} title="Não foi possível calcular os totais" />
          ) : (
            <OrderTotals quote={current} loading={quote.isFetching} />
          )}
          {blocked && (
            <ul role="alert" className="flex flex-col gap-1 text-sm text-destructive">
              {current!.blockingIssues.map((b) => (
                <li key={b.cartItemId}>{b.message}</li>
              ))}
              <li>
                <Link to="/carrinho" className="underline">
                  Ajustar carrinho
                </Link>
              </li>
            </ul>
          )}

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-center text-base font-bold">Carteira e rede</legend>
            <div className="flex items-center gap-3 rounded-sm border border-border px-4 py-3">
              <WalletsPill />
              <span className="sr-only">Carteiras compatíveis</span>
            </div>
            {!wallets.data?.primary ? (
              <p className="rounded-sm border border-price/60 p-3 text-sm">
                Você ainda não tem carteira cadastrada.{' '}
                <Link to="/perfil/carteiras" className="text-primary underline">
                  Cadastrar carteira
                </Link>
              </p>
            ) : (
              (['primary', 'secondary'] as const).map((slot) => {
                const w = wallets.data?.[slot]
                if (!w) return null
                const selected = (slot === 'secondary') === useSecondary
                return (
                  <label
                    key={slot}
                    className={cn('flex cursor-pointer items-center gap-3 rounded-sm border px-4 py-3 text-sm', selected ? 'border-foreground' : 'border-border')}
                  >
                    <input
                      type="radio"
                      name="carteira"
                      className="size-4 accent-[var(--primary)]"
                      checked={selected}
                      onChange={() => setValue('useSecondary', slot === 'secondary', { shouldDirty: true })}
                    />
                    <span className="flex flex-col">
                      <span>{walletTypes.find((t) => t.id === w.walletType)?.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {slot === 'primary' ? 'Principal' : 'Secundária'} · {short(w.address)}
                      </span>
                    </span>
                  </label>
                )
              })
            )}
            {wallet && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm" aria-live="polite">
                {connected ? (
                  <>
                    <span className="flex items-center gap-2 text-success">
                      <span aria-hidden className="size-2 rounded-full bg-success" /> Conectada na {networks.find((n) => n.id === network)?.label}
                    </span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                      <Unplug aria-hidden /> Desconectar
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground">Carteira desconectada</span>
                    <Button type="button" size="sm" variant="outline" disabled={connect.isPending} onClick={() => connect.mutate({ walletId: wallet.id, network })}>
                      {connect.isPending ? <Loader2 aria-hidden className="animate-spin" /> : <PlugZap aria-hidden />}
                      {connect.isPending ? 'Aguardando a carteira…' : 'Conectar carteira'}
                    </Button>
                  </>
                )}
              </div>
            )}
          </fieldset>
          <FormAlert message={preflightError} />
          <Button type="submit" size="lg" className="w-full" disabled={blocked || !current}>
            Revisar e confirmar compra
          </Button>
        </aside>
      </form>

      <Dialog open={reviewOpen} onOpenChange={(o) => !submit.isPending && setReviewOpen(o)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto border-border bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Revise seu pedido</DialogTitle>
            <DialogDescription>Confira itens, taxas e carteira. O pedido só é enviado ao confirmar.</DialogDescription>
          </DialogHeader>
          {review && (
            <div className="flex flex-col gap-4 text-sm">
              {changed && current && (
                <div role="alert" className="flex flex-col gap-2 rounded-sm border border-price p-3 text-price">
                  <p className="flex items-center gap-2 font-semibold">
                    <AlertTriangle aria-hidden className="size-4" /> Os valores mudaram desde a sua revisão.
                  </p>
                  <p>
                    Total anterior {formatEth(review.total)} → novo total <b>{formatEth(current.total)}</b>.
                  </p>
                  <Button size="sm" variant="outline" className="w-fit" onClick={() => setReview(current)} disabled={quote.isFetching}>
                    Revisar novos valores
                  </Button>
                </div>
              )}
              <ul className="flex flex-col gap-2">
                {review.items.map((i) => (
                  <li key={i.cartItemId} className="flex justify-between gap-3">
                    <span>
                      {i.name} <span className="text-muted-foreground">({i.editionLabel}) x {i.quantity}</span>
                    </span>
                    <span className="tabular-nums">{formatEth(i.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <OrderTotals quote={review} />
              <p className="text-muted-foreground">
                Carteira: {walletTypes.find((t) => t.id === wallet?.walletType)?.label} · {short(wallet?.address ?? '')} · {networks.find((n) => n.id === review.network)?.label}
              </p>
              <FormAlert message={submitError} />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setReviewOpen(false)} disabled={submit.isPending}>
              Voltar
            </Button>
            <Button onClick={confirm} disabled={changed || submit.isPending || quote.isFetching} aria-describedby={changed ? undefined : undefined}>
              {submit.isPending ? (
                <>
                  <Loader2 aria-hidden className="animate-spin" /> Enviando pedido…
                </>
              ) : submitError ? (
                'Tentar novamente'
              ) : (
                'Confirmar compra'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PendingBanner({ orderId, className }: { orderId: string; className?: string }) {
  return (
    <p role="status" className={cn('flex flex-wrap items-center gap-2 rounded-sm border border-price/60 bg-price/10 px-4 py-3 text-sm', className)}>
      <Loader2 aria-hidden className="size-4 animate-spin text-price" />
      Você tem um pedido em processamento.
      <Link to="/pedidos/$orderId" params={{ orderId }} className="font-semibold text-primary underline">
        Acompanhar pedido
      </Link>
    </p>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="container-page mt-12 grid gap-10 lg:grid-cols-[1fr_405px]" aria-busy="true" aria-label="Carregando pagamento" data-testid="checkout-skeleton">
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-10" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="skeleton h-[70px]" />
        ))}
        <OrderTotals quote={undefined} />
        <div className="skeleton h-12" />
      </div>
    </div>
  )
}
