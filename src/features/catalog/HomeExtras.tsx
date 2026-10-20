import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { notAvailable } from '@/components/states'
import { Button } from '@/components/ui/button'

export function PromoBanners() {
  const promos = [
    {
      title: 'Lançamentos gênesis de edição limitada',
      text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
      image: '/nfts/emerald.webp',
      alt: 'Emerald Ape, macaco com óculos verdes',
      search: { tab: 'new' as const },
    },
    {
      title: 'Arte digital selecionada e muito mais',
      text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
      image: '/nfts/baron.webp',
      alt: 'Ivory Baron, macaco de blazer marfim',
      search: { cat: ['arte-digital' as const] },
    },
  ]
  return (
    <section aria-label="Coleções em destaque" className="container-page mt-24 grid gap-6 md:grid-cols-2">
      {promos.map((p) => (
        <article key={p.title} className="grid grid-cols-[minmax(0,45%)_1fr] items-center overflow-hidden rounded-sm bg-card">
          <img src={p.image} alt={p.alt} width={240} height={210} loading="lazy" className="h-full w-full object-cover" />
          <div className="flex flex-col items-end gap-3 p-4 text-right">
            <h2 className="text-sm font-bold sm:text-base">{p.title}</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">{p.text}</p>
            <Button asChild size="sm">
              <Link to="/" search={p.search} hash="catalogo">
                Explorar <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}

const posts = [
  { date: '12 de setembro', read: '6 min', title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', image: '/nfts/baron.webp' },
  { date: '13 de setembro', read: '2 min', title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', image: '/nfts/emerald.webp' },
  { date: '15 de setembro', read: '3 min', title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', image: '/nfts/sage.webp' },
  { date: '15 de setembro', read: '2 min', title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', image: '/nfts/golden.webp' },
]

export function Journal() {
  return (
    <section aria-labelledby="diario-titulo" className="container-page mt-24">
      <h2 id="diario-titulo" className="text-center text-2xl font-bold">
        Diário da Cunhagem
      </h2>
      <p className="mt-3 text-center text-xs text-muted-foreground">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {posts.map((p) => (
          <li key={p.title}>
            <article className="flex h-full flex-col bg-card">
              <img src={p.image} alt="" width={224} height={162} loading="lazy" className="aspect-[224/162] w-full object-cover" />
              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {p.date} | Leitura de {p.read}
                </p>
                <h3 className="text-sm font-bold">{p.title}</h3>
                <p className="text-[11px] text-muted-foreground">{p.text}</p>
                <button
                  type="button"
                  className="mt-auto w-fit text-[11px] font-semibold text-primary hover:underline"
                  onClick={() => notAvailable('O blog')}
                  aria-label={`Ler mais: ${p.title}`}
                >
                  Ler mais →
                </button>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
