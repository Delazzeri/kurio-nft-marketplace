import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { loginInputSchema, type LoginInput } from '@/api/contracts'
import { authService } from '@/auth/auth-service'
import { sessionStore } from '@/auth/session-store'
import { applyServerErrors, FormAlert, TextField } from '@/components/form'
import { notAvailable } from '@/components/states'
import { Button } from '@/components/ui/button'
import { AuthShell, safeRedirect } from '@/features/auth/AuthShell'
import { announce } from '@/lib/announce'

const reasons: Record<string, string> = {
  expirada: 'Sua sessão expirou. Entre novamente para continuar de onde parou.',
  favoritos: 'Entre para salvar seus favoritos.',
}

export const Route = createFileRoute('/entrar')({
  validateSearch: z.object({
    redirect: z.string().optional().catch(undefined),
    motivo: z.string().optional().catch(undefined),
  }),
  beforeLoad: ({ search }) => {
    if (sessionStore.get().status === 'authenticated') throw redirect({ to: safeRedirect(search.redirect) })
  },
  staticData: { authScreen: true },
  head: () => ({ meta: [{ title: 'Entrar — Kurio' }] }),
  component: LoginPage,
})

function LoginPage() {
  const { redirect: target, motivo } = Route.useSearch()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginInputSchema), defaultValues: { email: '', password: '' } })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const user = await authService.login(values)
      announce(`Bem-vindo, ${user.displayName}.`)
      await navigate({ to: safeRedirect(target), replace: true })
    } catch (error) {
      setFormError(applyServerErrors(error, setError))
    }
  })

  return (
    <AuthShell
      mode="login"
      redirect={target}
      mobileTitle="Entrar"
      description="Entre para gerenciar sua carteira, coleção e perfil de criador."
      footer={
        <Link to="/cadastro" search={{ redirect: target }} className="hover:text-primary">
          Novo na Kurio? Crie uma conta
        </Link>
      }
    >
      {motivo && reasons[motivo] && (
        <p role="status" className="rounded-sm border border-price/60 bg-price/10 px-3 py-2 text-sm text-price">
          {reasons[motivo]}
        </p>
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert message={formError} />
        <TextField label="E-mail" hideLabel type="email" autoComplete="email" placeholder="contato@email.com" error={errors.email?.message} {...register('email')} />
        <TextField label="Senha" hideLabel type="password" autoComplete="current-password" placeholder="Senha" error={errors.password?.message} {...register('password')} />
        <button type="button" onClick={() => notAvailable('A recuperação de senha')} className="-mt-2 self-end text-xs text-primary hover:underline">
          Esqueceu a senha?
        </button>
        <Button type="submit" size="lg" className="h-14 rounded-lg md:h-10 md:rounded-sm" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
        {import.meta.env.VITE_ENABLE_MOCKS !== 'false' && (
          <p className="text-center text-[11px] text-muted-foreground">
            Demo: <b>ana@kurio.dev</b> ou <b>bruno@kurio.dev</b> · senha <b>Kurio@2026</b>
          </p>
        )}
      </form>
    </AuthShell>
  )
}
