import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { registerInputSchema, type RegisterInput } from '@/api/contracts'
import { authService } from '@/auth/auth-service'
import { sessionStore } from '@/auth/session-store'
import { applyServerErrors, FormAlert, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { safeRedirect } from '@/auth/redirect'
import { AuthShell } from '@/features/auth/AuthShell'
import { announce } from '@/lib/announce'

export const Route = createFileRoute('/cadastro')({
  validateSearch: (raw: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof raw.redirect === 'string' ? raw.redirect : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (sessionStore.get().status === 'authenticated') throw redirect({ to: safeRedirect(search.redirect) })
  },
  staticData: { authScreen: true },
  head: () => ({ meta: [{ title: 'Criar conta — Kurio' }] }),
  component: RegisterPage,
})

function RegisterPage() {
  const { redirect: target } = Route.useSearch()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerInputSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const user = await authService.register(values)
      announce(`Conta criada. Bem-vindo, ${user.displayName}.`)
      await navigate({ to: safeRedirect(target), replace: true })
    } catch (error) {
      // conflito (e-mail/usuário já cadastrados) volta associado ao campo
      setFormError(applyServerErrors(error, setError))
    }
  })

  return (
    <AuthShell
      mode="register"
      redirect={target}
      mobileTitle="Criar perfil de colecionador"
      description="Crie seu perfil de colecionador e conecte uma carteira quando quiser."
      footer={
        <Link to="/entrar" search={{ redirect: target }} className="hover:text-primary">
          Já tem uma conta? Entre
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <FormAlert message={formError} />
        <TextField label="Nome de usuário" hideLabel autoComplete="username" placeholder="Nome de usuário" error={errors.username?.message} {...register('username')} />
        <TextField label="E-mail" hideLabel type="email" autoComplete="email" placeholder="Digite seu e-mail" error={errors.email?.message} {...register('email')} />
        <TextField
          label="Senha"
          hideLabel
          type="password"
          autoComplete="new-password"
          placeholder="Senha"
          hint="Mínimo de 8 caracteres, com letras e números."
          error={errors.password?.message}
          {...register('password')}
        />
        <TextField label="Confirmar senha" hideLabel type="password" autoComplete="new-password" placeholder="Confirmar senha" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" size="lg" className="mt-3 h-14 rounded-lg md:h-10 md:rounded-sm" disabled={isSubmitting}>
          {isSubmitting ? 'Criando…' : 'Criar perfil'}
        </Button>
      </form>
    </AuthShell>
  )
}
