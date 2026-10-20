import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { isApiError } from '@/api/client'
import { networks, walletInputSchema, walletTypes, type Wallet, type WalletInput, type WalletSlot } from '@/api/contracts'
import { applyServerErrors, FormAlert, TextField } from '@/components/form'
import { ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useWalletMutations } from '@/features/account/queries'
import { useWallets } from '@/features/checkout/wallet-connection'

export const Route = createFileRoute('/_auth/perfil/carteiras')({
  head: () => ({ meta: [{ title: 'Carteiras — Kurio' }] }),
  component: WalletsPage,
})

const empty: WalletInput = {
  displayName: '',
  nickname: '',
  network: undefined as unknown as WalletInput['network'],
  profileName: '',
  address: '',
  secondaryAddress: '',
  walletType: undefined as unknown as WalletInput['walletType'],
  referralCode: '',
  email: '',
  ensName: '',
}

function toInput(w: Wallet | null): WalletInput {
  if (!w) return empty
  return {
    displayName: w.displayName,
    nickname: w.nickname,
    network: w.network,
    profileName: w.profileName,
    address: w.address,
    secondaryAddress: w.secondaryAddress,
    walletType: w.walletType,
    referralCode: w.referralCode,
    email: w.email,
    ensName: w.ensName,
  }
}

function WalletForm({ slot, wallet, onSaved }: { slot: WalletSlot; wallet: Wallet | null; onSaved?: () => void }) {
  const { save } = useWalletMutations()
  const [formError, setFormError] = useState<string | null>(null)
  const prefix = `w-${slot}`
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WalletInput>({ resolver: zodResolver(walletInputSchema), defaultValues: toInput(wallet) })

  const onSubmit = handleSubmit(async (input) => {
    setFormError(null)
    try {
      await save.mutateAsync({ slot, input })
      toast.success(slot === 'primary' ? 'Carteira principal salva.' : 'Carteira secundária salva.')
      onSaved?.()
    } catch (e) {
      setFormError(applyServerErrors(e, setError))
    }
  })

  const selectField = (name: 'network' | 'walletType', label: string, placeholder: string, options: readonly { id: string; label: string }[]) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${prefix}-${name}`} className="text-sm">
        {label}
        <span aria-hidden className="ml-0.5 text-destructive">
          *
        </span>
        <span className="sr-only"> (obrigatório)</span>
      </label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={field.value ?? ''} onValueChange={field.onChange}>
            <SelectTrigger
              id={`${prefix}-${name}`}
              className="w-full"
              aria-invalid={!!errors[name]}
              aria-describedby={errors[name] ? `${prefix}-${name}-erro` : undefined}
              onBlur={field.onBlur}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {errors[name] && (
        <p id={`${prefix}-${name}-erro`} className="text-xs text-destructive">
          {errors[name]?.message}
        </p>
      )}
    </div>
  )

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5" aria-label={slot === 'primary' ? 'Carteira principal' : 'Carteira secundária'}>
      <FormAlert message={formError} />
      <div className="grid gap-x-7 gap-y-5 sm:grid-cols-2">
        <TextField label="Nome de exibição" required error={errors.displayName?.message} {...register('displayName')} />
        <TextField label="Apelido da carteira" required error={errors.nickname?.message} {...register('nickname')} />
        {selectField('network', 'Rede', 'Selecione uma rede', networks)}
        <TextField label="Nome do perfil" required error={errors.profileName?.message} {...register('profileName')} />
        <TextField label="Endereço da carteira" required placeholder="Endereço 0x da carteira" spellCheck={false} error={errors.address?.message} {...register('address')} />
        <TextField label="ENS ou carteira secundária (opcional)" placeholder="ENS ou carteira secundária (opcional)" spellCheck={false} error={errors.secondaryAddress?.message} {...register('secondaryAddress')} />
        {selectField('walletType', 'Tipo de carteira', 'Selecione uma carteira', walletTypes)}
        <TextField label="Código de indicação" required error={errors.referralCode?.message} {...register('referralCode')} />
        <TextField label="E-mail" required type="email" error={errors.email?.message} {...register('email')} />
        <TextField
          label="Nome ENS"
          required
          error={errors.ensName?.message}
          addon={<span className="flex h-10 items-center rounded-sm border border-border px-3 text-sm">.eth</span>}
          {...register('ensName')}
        />
      </div>
      <Button type="submit" className="w-fit" disabled={isSubmitting}>
        {isSubmitting ? 'Salvando…' : 'Salvar carteira'}
      </Button>
    </form>
  )
}

function WalletsPage() {
  const { data, isPending, error, refetch } = useWallets()
  const { mirror, removeSecondary } = useWalletMutations()
  const [editingSecondary, setEditingSecondary] = useState(false)
  /** escolha refletida na hora; volta ao valor do servidor quando a API responde */
  const [pendingSame, setPendingSame] = useState<boolean | null>(null)

  if (isPending) return <div className="skeleton h-96" aria-busy="true" aria-label="Carregando carteiras" />
  if (!data) return <ErrorState error={error} onRetry={() => void refetch()} />

  const secondary = data.secondary
  const sameAsPrimary = !!secondary?.sameAsPrimary

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="principal-titulo" className="flex flex-col gap-5">
        <header>
          <h1 id="principal-titulo" className="text-base font-bold">
            Carteira principal
          </h1>
          <p className="text-sm text-muted-foreground">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
        </header>
        <WalletForm key={data.primary?.updatedAt ?? 'novo'} slot="primary" wallet={data.primary} />
      </section>

      <section aria-labelledby="secundaria-titulo" className="flex flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="secundaria-titulo" className="text-base font-bold">
            Carteira secundária
          </h2>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={pendingSame ?? sameAsPrimary}
                disabled={!data.primary || mirror.isPending || removeSecondary.isPending}
                onChange={(e) => {
                  setEditingSecondary(false)
                  const next = e.target.checked
                  setPendingSame(next)
                  const opts = {
                    onError: (err: unknown) => toast.error(isApiError(err) ? err.message : 'Não foi possível atualizar.'),
                    onSettled: () => setPendingSame(null),
                  }
                  if (next) mirror.mutate(undefined, opts)
                  else removeSecondary.mutate(undefined, opts)
                }}
              />
              Igual à carteira principal
            </label>
            {!sameAsPrimary && (
              <Button variant="link" className="h-auto p-0 text-base font-bold" onClick={() => setEditingSecondary((v) => !v)} aria-expanded={editingSecondary}>
                {editingSecondary ? 'Cancelar' : secondary ? 'Editar' : 'Adicionar'}
              </Button>
            )}
          </div>
        </header>
        {!data.primary && <p className="text-sm text-muted-foreground">Cadastre a carteira principal primeiro.</p>}
        {sameAsPrimary ? (
          <p className="text-sm text-muted-foreground">A carteira secundária usa os mesmos dados da principal.</p>
        ) : editingSecondary ? (
          <WalletForm key={secondary?.updatedAt ?? 'novo'} slot="secondary" wallet={secondary} onSaved={() => setEditingSecondary(false)} />
        ) : secondary ? (
          <p className="text-sm">
            {walletTypes.find((t) => t.id === secondary.walletType)?.label} · {secondary.nickname} · <span className="text-muted-foreground">{secondary.address}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Você ainda não adicionou uma carteira secundária.</p>
        )}
      </section>
    </div>
  )
}
