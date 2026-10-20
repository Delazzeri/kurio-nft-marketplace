import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PasswordChangeInput, ProfileInput, WalletInput, WalletSlot } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/query-keys'
import { sessionStore, useSession } from '@/auth/session-store'
import { announce } from '@/lib/announce'

export function useProfile() {
  const { user } = useSession()
  return useQuery({
    queryKey: qk.private.profile(user?.id ?? 'anon'),
    queryFn: ({ signal }) => api.profile.get({ signal }),
    enabled: !!user,
  })
}

export function useProfileMutations() {
  const { user } = useSession()
  const client = useQueryClient()
  const key = qk.private.profile(user?.id ?? 'anon')
  const syncUser = (p: { displayName: string; username: string; email: string; avatarUrl: string | null }) =>
    sessionStore.updateUser({ displayName: p.displayName, username: p.username, email: p.email, avatarUrl: p.avatarUrl })

  const update = useMutation({
    mutationFn: (input: ProfileInput) => api.profile.update(input),
    onSuccess: (p) => {
      client.setQueryData(key, p)
      syncUser(p)
      announce('Perfil atualizado.')
    },
  })
  const setAvatar = useMutation({
    mutationFn: (dataUrl: string) => api.profile.setAvatar(dataUrl),
    onSuccess: (p) => {
      client.setQueryData(key, p)
      syncUser(p)
      announce('Avatar atualizado.')
    },
  })
  const removeAvatar = useMutation({
    mutationFn: () => api.profile.removeAvatar(),
    onSuccess: (p) => {
      client.setQueryData(key, p)
      syncUser(p)
      announce('Avatar removido.')
    },
  })
  const changePassword = useMutation({
    mutationFn: (input: PasswordChangeInput) => api.profile.changePassword(input),
    onSuccess: () => announce('Senha alterada com sucesso.'),
  })
  return { update, setAvatar, removeAvatar, changePassword }
}

export function useWalletMutations() {
  const { user } = useSession()
  const client = useQueryClient()
  const key = qk.private.wallets(user?.id ?? 'anon')
  const save = useMutation({
    mutationFn: ({ slot, input }: { slot: WalletSlot; input: WalletInput }) => api.wallets.save(slot, input),
    onSuccess: (data, v) => {
      client.setQueryData(key, data)
      announce(v.slot === 'primary' ? 'Carteira principal salva.' : 'Carteira secundária salva.')
    },
  })
  const mirror = useMutation({
    mutationFn: () => api.wallets.mirrorPrimary(),
    onSuccess: (data) => {
      client.setQueryData(key, data)
      announce('Carteira secundária igual à principal.')
    },
  })
  const removeSecondary = useMutation({
    mutationFn: () => api.wallets.removeSecondary(),
    onSuccess: (data) => {
      client.setQueryData(key, data)
      announce('Carteira secundária removida.')
    },
  })
  return { save, mirror, removeSecondary }
}
