import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { authService } from '@/auth/auth-service'

/**
 * Layout sem path que protege checkout, pedidos, perfil e carteiras.
 * A sessão persistida é confirmada na API antes de liberar a rota; sem sessão,
 * o usuário vai para o login com `redirect` para retomar exatamente onde estava.
 */
export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ location }) => {
    const user = await authService.ensureSession()
    if (!user) {
      throw redirect({ to: '/entrar', search: { redirect: location.href } })
    }
    return { user }
  },
  component: Outlet,
})
