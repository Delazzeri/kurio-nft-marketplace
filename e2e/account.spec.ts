import path from 'node:path'
import { expect, test } from './fixtures'

const AVATAR = path.join(import.meta.dirname, 'fixtures', 'avatar.png')

/** Cenário 8 — perfil, avatar, senha e carteiras, com erros de validação. */
test.describe('Perfil e carteiras', () => {
  test('edição do perfil com validação local e conflito da API', async ({ app, page }) => {
    await app.login('ana', '/perfil')
    const username = page.getByLabel('Nome de usuário')
    await expect(username).toHaveValue('ana.coleciona')

    await username.fill('a')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Mínimo de 3 caracteres')).toBeVisible()

    await username.fill('bruno.nft') // pertence ao outro usuário
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Este nome de usuário já está em uso.')).toBeVisible()
    await expect(username).toHaveAttribute('aria-invalid', 'true')

    await username.fill('ana.nova')
    await page.getByLabel('Nome de exibição').fill('Ana Nova')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByTestId('live-polite')).toContainText('Perfil atualizado.')
    await page.reload()
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('ana.nova')
  })

  test('avatar: envio e remoção', async ({ app, page }) => {
    await app.login('ana', '/perfil')
    await page.locator('#avatar-input').setInputFiles(AVATAR)
    await expect(page.getByRole('img', { name: 'Seu avatar' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('img', { name: 'Seu avatar' })).toBeVisible()
    await page.getByRole('button', { name: 'Remover', exact: true }).click()
    await expect(page.getByLabel('Sem avatar')).toBeVisible()
  })

  test('alteração de senha com senha atual incorreta e sucesso', async ({ app, page }) => {
    await app.login('ana', '/perfil')
    await page.getByLabel('Senha atual').fill('errada000')
    await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha1')
    await page.getByLabel('Confirmar nova senha').fill('NovaSenha1')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('Senha atual incorreta.').first()).toBeVisible()

    await page.getByLabel('Senha atual').fill('Kurio@2026')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByTestId('live-polite')).toContainText('Senha alterada com sucesso.')

    // a nova senha vale no próximo login
    await page.getByRole('button', { name: 'Sair' }).first().click()
    await page.goto('/entrar')
    await page.getByLabel('E-mail', { exact: true }).fill('ana@kurio.dev')
    await page.getByLabel('Senha', { exact: true }).fill('NovaSenha1')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/')
  })

  test('carteiras: validação, erro da API, persistência e secundária igual à principal', async ({ app, page }) => {
    await app.login('bruno', '/perfil/carteiras')
    const primary = page.getByRole('form', { name: 'Carteira principal' })
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByRole('combobox', { name: /Rede/ })).toHaveAttribute('aria-invalid', 'true')
    await expect(primary.locator('#w-primary-network-erro')).toHaveText('Selecione uma rede')
    await expect(primary.getByLabel('Endereço da carteira')).toHaveAttribute('aria-invalid', 'true')

    await primary.getByLabel('Nome de exibição').fill('Bruno Cripto')
    await primary.getByLabel('Apelido da carteira').fill('Cofre do Bruno')
    await primary.getByRole('combobox', { name: /Rede/ }).click()
    await page.getByRole('option', { name: 'Polygon' }).click()
    await primary.getByLabel('Nome do perfil').fill('bruno.nft')
    await primary.getByLabel('Endereço da carteira').fill('0x0000000000000000000000000000000000000000')
    await primary.getByRole('combobox', { name: /Tipo de carteira/ }).click()
    await page.getByRole('option', { name: 'WalletConnect' }).click()
    await primary.getByLabel('Código de indicação').fill('BRUNO2026')
    await primary.getByLabel(/^E-mail/).fill('bruno@kurio.dev')
    await primary.getByLabel('Nome ENS').fill('brunonft')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    // regra de negócio só existente na API
    await expect(primary.getByText('O endereço nulo (0x000…0) não pode receber NFTs.')).toBeVisible()

    await primary.getByLabel('Endereço da carteira').fill('0x1234567890abcdef1234567890ABCDEF12345678')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByTestId('live-polite')).toContainText('Carteira principal salva.')

    await page.getByLabel('Igual à carteira principal').check()
    await expect(page.getByText('A carteira secundária usa os mesmos dados da principal.')).toBeVisible()

    await page.reload()
    await expect(page.getByRole('form', { name: 'Carteira principal' }).getByLabel('Endereço da carteira')).toHaveValue('0x1234567890abcdef1234567890ABCDEF12345678')
    await expect(page.getByLabel('Igual à carteira principal')).toBeChecked()
  })
})
