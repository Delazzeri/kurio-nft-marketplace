import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { ImageIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { isApiError } from '@/api/client'
import { passwordChangeSchema, profileInputSchema, type PasswordChangeInput, type ProfileInput } from '@/api/contracts'
import { applyServerErrors, FormAlert, TextField } from '@/components/form'
import { ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useProfile, useProfileMutations } from '@/features/account/queries'

export const Route = createFileRoute('/_auth/perfil/')({
  head: () => ({ meta: [{ title: 'Meu perfil — Kurio' }] }),
  component: ProfilePage,
})

/** Redimensiona para 256 px (webp) no cliente antes de enviar — mantém o payload pequeno. */
async function toAvatarDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Use uma imagem PNG, JPG ou WebP.')
  if (file.size > 5 * 1024 * 1024) throw new Error('A imagem deve ter até 5 MB.')
  const bitmap = await createImageBitmap(file)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const scale = Math.max(size / bitmap.width, size / bitmap.height)
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h)
  return canvas.toDataURL('image/webp', 0.85)
}

function ProfilePage() {
  const { data: profile, isPending, error, refetch } = useProfile()
  if (isPending) {
    return (
      <div className="grid gap-6 sm:grid-cols-2" aria-busy="true" aria-label="Carregando perfil">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-16" />
        ))}
      </div>
    )
  }
  if (!profile) return <ErrorState error={error} onRetry={() => void refetch()} />
  return (
    <div className="flex flex-col gap-12">
      <ProfileForm key={profile.updatedAt} defaults={profile} avatarUrl={profile.avatarUrl} />
      <PasswordForm />
    </div>
  )
}

function ProfileForm({ defaults, avatarUrl }: { defaults: ProfileInput; avatarUrl: string | null }) {
  const { update, setAvatar, removeAvatar } = useProfileMutations()
  const [formError, setFormError] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileInputSchema),
    defaultValues: {
      displayName: defaults.displayName,
      username: defaults.username,
      email: defaults.email,
      ensName: defaults.ensName,
      walletNickname: defaults.walletNickname,
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await update.mutateAsync(values)
      toast.success('Perfil atualizado.')
    } catch (e) {
      setFormError(applyServerErrors(e, setError))
    }
  })

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setAvatarError(null)
    try {
      const dataUrl = await toAvatarDataUrl(file)
      await setAvatar.mutateAsync(dataUrl)
      toast.success('Avatar atualizado.')
    } catch (e) {
      setAvatarError(isApiError(e) ? (e.fields?.avatar ?? e.message) : (e as Error).message)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="perfil-titulo" className="flex flex-col gap-6">
      <h1 id="perfil-titulo" className="text-base font-bold">
        Perfil do colecionador
      </h1>
      <FormAlert message={formError} />
      <div className="grid gap-x-7 gap-y-6 sm:grid-cols-2">
        <TextField label="Nome de exibição" required autoComplete="name" error={errors.displayName?.message} {...register('displayName')} />
        <TextField label="Nome de usuário" required autoComplete="username" error={errors.username?.message} {...register('username')} />
        <TextField label="E-mail" required type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <TextField
          label="Nome ENS"
          required
          error={errors.ensName?.message}
          addon={<span className="flex h-10 items-center rounded-sm border border-border px-3 text-sm">.eth</span>}
          {...register('ensName')}
        />
        <TextField label="Apelido da carteira" required error={errors.walletNickname?.message} {...register('walletNickname')} />
        <div className="flex flex-col gap-2">
          <span id="avatar-label" className="text-sm">
            Avatar
          </span>
          <div className="flex items-center gap-6" role="group" aria-labelledby="avatar-label">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Seu avatar" width={50} height={50} className="size-[50px] rounded-full object-cover" />
            ) : (
              <span className="flex size-[50px] items-center justify-center rounded-full border border-border bg-secondary" aria-label="Sem avatar">
                <ImageIcon aria-hidden className="size-5 text-primary" />
              </span>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id="avatar-input" onChange={(e) => void onFile(e.target.files?.[0])} aria-describedby={avatarError ? 'avatar-erro' : undefined} />
            <Button type="button" onClick={() => fileRef.current?.click()} disabled={setAvatar.isPending}>
              {setAvatar.isPending ? 'Enviando…' : 'Alterar'}
            </Button>
            <Button type="button" variant="ghost" disabled={!avatarUrl || removeAvatar.isPending} onClick={() => removeAvatar.mutate()}>
              Remover
            </Button>
          </div>
          {avatarError && (
            <p id="avatar-erro" role="alert" className="text-xs text-destructive">
              {avatarError}
            </p>
          )}
        </div>
      </div>
      <Button type="submit" className="w-fit min-w-[131px]" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

function PasswordForm() {
  const { changePassword } = useProfileMutations()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<PasswordChangeInput>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  useEffect(() => {
    if (isSubmitSuccessful && !formError) reset()
  }, [isSubmitSuccessful, formError, reset])

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await changePassword.mutateAsync(values)
      toast.success('Senha alterada com sucesso.')
    } catch (e) {
      setFormError(applyServerErrors(e, setError))
      throw e
    }
  })

  return (
    <form onSubmit={(e) => void onSubmit(e).catch(() => undefined)} noValidate aria-labelledby="senha-titulo" className="flex max-w-[417px] flex-col gap-4">
      <h2 id="senha-titulo" className="text-base font-bold">
        Alterar senha
      </h2>
      <FormAlert message={formError} />
      <TextField label="Senha atual" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
      <TextField label="Nova senha" type="password" autoComplete="new-password" hint="Mínimo de 8 caracteres, com letras e números." error={errors.newPassword?.message} {...register('newPassword')} />
      <TextField label="Confirmar nova senha" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
      <Button type="submit" className="mt-4 w-fit min-w-[131px]" disabled={isSubmitting}>
        {isSubmitting ? 'Salvando…' : 'Alterar senha'}
      </Button>
    </form>
  )
}
