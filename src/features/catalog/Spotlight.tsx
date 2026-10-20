import { Link } from '@tanstack/react-router'
import { useFeatured } from './queries'

export function Spotlight() {
  const { data } = useFeatured()
  return (
    <section aria-labelledby="destaque-titulo" className="bg-card">
      <div className="px-3 pt-4 pb-2">
        <h2 id="destaque-titulo" className="text-xl font-bold text-primary">
          NFT EM DESTAQUE
        </h2>
        <p className="text-center text-base font-bold">OFERTA LIMITADA</p>
      </div>
      {data ? (
        <Link to="/nft/$nftId" params={{ nftId: data.spotlight.id }} className="block" aria-label={`Ver ${data.spotlight.name} em destaque`}>
          <img src={data.spotlight.image} alt={data.spotlight.imageAlt} width={310} height={260} loading="lazy" className="aspect-[310/260] w-full rounded-xl object-cover" />
        </Link>
      ) : (
        <div className="skeleton aspect-[310/260] w-full" aria-hidden />
      )}
    </section>
  )
}
