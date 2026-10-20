import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isApiError } from '@/api/errors'
import type { FavoritesResponse } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/query-keys'
import { useSession } from '@/auth/session-store'
import { announce } from '@/lib/announce'

export function useFavorites() {
  const { user, status } = useSession()
  return useQuery({
    queryKey: qk.private.favorites(user?.id ?? 'anon'),
    queryFn: ({ signal }) => api.favorites.list({ signal }),
    enabled: !!user && status !== 'anonymous',
  })
}

/**
 * Atualização otimista com rollback: o coração muda na hora; se a API falhar,
 * o estado anterior é restaurado e o usuário é avisado (com opção de tentar de novo).
 */
export function useToggleFavorite() {
  const client = useQueryClient()
  const { user } = useSession()
  const key = qk.private.favorites(user?.id ?? 'anon')

  const mutation = useMutation({
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? api.favorites.add(nftId) : api.favorites.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<FavoritesResponse>(key)
      client.setQueryData<FavoritesResponse>(key, (old) => {
        const ids = new Set(old?.nftIds ?? [])
        if (favorite) ids.add(nftId)
        else ids.delete(nftId)
        return { nftIds: [...ids] }
      })
      return { previous }
    },
    onError: (error, vars, context) => {
      // rollback (se ainda não havia cache, descarta o otimista e busca do servidor)
      if (context?.previous) client.setQueryData(key, context.previous)
      else client.removeQueries({ queryKey: key, exact: true })
      const action = vars.favorite ? 'Não foi possível favoritar' : 'Não foi possível remover dos favoritos'
      const message = `${action} ${vars.name}. ${isApiError(error) ? error.message : ''}`.trim()
      toast.error(message, { action: { label: 'Tentar novamente', onClick: () => mutation.mutate(vars) } })
      announce(message, 'assertive')
    },
    onSettled: () => {
      // reconcilia com o servidor ao fim de qualquer tentativa
      void client.invalidateQueries({ queryKey: key })
    },
    onSuccess: (data, vars) => {
      client.setQueryData(key, data)
      announce(vars.favorite ? `${vars.name} adicionado aos favoritos.` : `${vars.name} removido dos favoritos.`)
    },
  })
  return mutation
}
