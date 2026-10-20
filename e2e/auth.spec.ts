import { expect, test, USERS } from './fixtures'

/** Cenário 3 — cadastro, login, expiração de sessão, logout e troca de usuário. */
test.describe('Conta e sessão', () => {
  test('cadastro valida campos, trata conflito e cria a sessão', async ({ app, page }) => {
    await app.goto('/cadastro')
    await page.getByRole('button', { name: 'Criar perfil' }).click()
    await expect(page.getByText('Mínimo de 3 caracteres')).toBeVisible()
    await expect(page.getByLabel('Nome de usuário')).toHaveAttribute('aria-invalid', 'true')

    await page.getByLabel('Nome de usuário').fill('nova.colecionadora')
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill('Segura123')
    await page.getByLabel('Confirmar senha').fill('Outra123')
    await page.getByRole('button', { name: 'Criar perfil' }).click()
    await expect(page.getByText('As senhas não coincidem')).toBeVisible()

    await page.getByLabel('Confirmar senha').fill('Segura123')
    await page.getByRole('button', { name: 'Criar perfil' }).click()
    // conflito retornado pela API fica associado ao campo
    await expect(page.getByText('Este e-mail já está cadastrado.')).toBeVisible()
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveAttribute('aria-invalid', 'true')

    await page.getByLabel('E-mail', { exact: true }).fill('nova@kurio.dev')
    await page.getByRole('button', { name: 'Criar perfil' }).click()
    await expect(page).toHaveURL('/')
    await page.reload()
    await app.goto('/perfil')
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('nova.colecionadora')
  })

  test('login com credenciais inválidas e retorno ao fluxo anterior', async ({ app, page }) => {
    await app.goto('/perfil/carteiras')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fperfil%2Fcarteiras/)
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill('errada123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' })).toBeVisible()
    await page.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/perfil/carteiras')
    // sessão recuperada após refresh
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
  })

  test('expiração durante a navegação preserva o contexto para retomada', async ({ app, page, mock }) => {
    await app.login('ana', '/perfil')
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
    await mock.call('expireSessions')
    // qualquer chamada autenticada agora retorna 401 SESSION_EXPIRED
    await page.goto('/perfil/carteiras')
    await expect(page).toHaveURL(/\/entrar\?redirect=.*motivo=expirada|\/entrar\?redirect=/)
    await expect(page.getByText('Sua sessão expirou').first()).toBeVisible()
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/perfil/carteiras')
  })

  test('logout e troca de usuário limpam dados privados da sessão anterior', async ({ app, page, mock }) => {
    test.skip(app.isMobile, 'fluxo de sessão independe do viewport')
    // Ana tem "Sage Nomad #009" nos favoritos no seed
    await app.login('ana', '/perfil/favoritos')
    await expect(page.getByRole('heading', { name: 'Sage Nomad #009' })).toBeVisible()
    await mock.waitForSocket(true)

    await page.getByRole('button', { name: 'Sair' }).first().click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
    // nenhuma conexão em tempo real autenticada sobra da sessão anterior
    await expect.poll(async () => (await mock.call('realtimeConnections')).filter(Boolean)).toEqual([])

    await app.login('bruno', '/perfil/favoritos')
    await expect(page.getByRole('heading', { name: 'Nenhum favorito ainda' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sage Nomad #009' })).toHaveCount(0)
    const users = await mock.call('realtimeConnections')
    expect(users.filter(Boolean)).toEqual(['usr_bruno'])
  })
})
