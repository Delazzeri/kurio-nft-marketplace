import { useLocation, useNavigate } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { useSession } from '@/auth/session-store'
import { cn } from '@/lib/utils'
import { useFavorites, useToggleFavorite } from './queries'

/** Favoritar exige login: visitante é levado ao login e volta para a mesma página. */
export function useFavoriteState(nftId: string, name: string) {
  const { user } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const { data } = useFavorites()
  const toggle = useToggleFavorite()
  const isFavorite = !!data?.nftIds.includes(nftId)
  const onToggle = () => {
    if (!user) {
      void navigate({ to: '/entrar', search: { redirect: location.href, motivo: 'favoritos' } })
      return
    }
    toggle.mutate({ nftId, favorite: !isFavorite, name })
  }
  return { isFavorite, onToggle, pending: toggle.isPending }
}

export function FavoriteIconButton({ nftId, name, className }: { nftId: string; name: string; className?: string }) {
  const { isFavorite, onToggle } = useFavoriteState(nftId, name)
  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remover ${name} dos favoritos` : `Favoritar ${name}`}
      onClick={onToggle}
      className={cn('flex size-9 items-center justify-center rounded-sm bg-card/90 text-foreground hover:text-primary', className)}
    >
      <Heart aria-hidden className={cn('size-5', isFavorite && 'fill-primary text-primary')} />
    </button>
  )
}
