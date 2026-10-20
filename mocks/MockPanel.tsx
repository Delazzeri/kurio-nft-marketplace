/**
 * Painel de cenários (somente com mocks ativos). Ferramenta de demonstração/QA:
 * aciona a API de controle do mock — a UI do app nunca é manipulada diretamente.
 */
import { FlaskConical, X } from 'lucide-react'
import { useState } from 'react'
import { mockControl } from './control'

export default function MockPanel() {
  const [open, setOpen] = useState(false)
  const [scenario, setScenario] = useState(mockControl.getScenario())
  const [nftId, setNftId] = useState('emerald-ape-042')
  const [log, setLog] = useState<string>('')

  const apply = (id: string) => {
    mockControl.setScenario(id)
    setScenario(id)
    location.reload()
  }

  return (
    <div className="fixed right-3 bottom-[45%] z-40 font-sans text-xs md:bottom-3">
      {open ? (
        <section
          aria-label="Painel de cenários de mock"
          className="w-[min(92vw,340px)] space-y-3 rounded-md border border-input bg-card p-3 text-foreground shadow-2xl"
        >
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Cenários (MSW)</h2>
            <button type="button" aria-label="Fechar painel" onClick={() => setOpen(false)} className="rounded-sm p-1 hover:bg-accent">
              <X className="size-4" />
            </button>
          </header>
          <label className="block space-y-1">
            <span>Cenário ativo</span>
            <select
              value={scenario}
              onChange={(e) => apply(e.target.value)}
              className="h-8 w-full rounded-sm border border-border bg-background px-2"
            >
              {mockControl.scenarios().map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-muted-foreground">{mockControl.scenarios().find((s) => s.id === scenario)?.description}</p>

          <fieldset className="space-y-2 border-t border-border pt-2">
            <legend className="font-semibold">Eventos Socket.IO</legend>
            <label className="block space-y-1">
              <span>NFT (id)</span>
              <input value={nftId} onChange={(e) => setNftId(e.target.value)} className="h-8 w-full rounded-sm border border-border bg-background px-2" />
            </label>
            <div className="flex flex-wrap gap-1.5">
              <PanelButton onClick={() => setLog(JSON.stringify(mockControl.updateNft(nftId, { priceDelta: '0.10' })?.data))}>Preço +0.10</PanelButton>
              <PanelButton onClick={() => setLog(JSON.stringify(mockControl.updateNft(nftId, { available: 1 })?.data))}>Restar 1</PanelButton>
              <PanelButton onClick={() => setLog(JSON.stringify(mockControl.updateNft(nftId, { available: 0 })?.data))}>Esgotar</PanelButton>
              <PanelButton onClick={() => setLog(`duplicado: ${mockControl.replayLastEvent()?.eventId ?? 'nenhum'}`)}>Duplicar último</PanelButton>
              <PanelButton onClick={() => setLog(`antigo v${mockControl.emitStaleNftEvent(nftId).version}`)}>Evento antigo</PanelButton>
              <PanelButton onClick={() => (mockControl.disconnectRealtime(8000), setLog('socket derrubado por 8 s'))}>Derrubar socket 8 s</PanelButton>
            </div>
          </fieldset>

          <fieldset className="space-y-2 border-t border-border pt-2">
            <legend className="font-semibold">Sessão e dados</legend>
            <div className="flex flex-wrap gap-1.5">
              <PanelButton onClick={() => (mockControl.expireSessions(), setLog('sessões expiradas'))}>Expirar sessão</PanelButton>
              <PanelButton
                onClick={() => {
                  mockControl.reset()
                  localStorage.removeItem('kurio:session')
                  localStorage.removeItem('kurio:guest-cart')
                  location.assign('/')
                }}
              >
                Reset completo
              </PanelButton>
            </div>
          </fieldset>
          {log && <pre className="max-h-24 overflow-auto rounded-sm bg-background p-2 whitespace-pre-wrap">{log}</pre>}
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-input bg-card px-3 py-2 font-semibold shadow-lg hover:border-primary"
          aria-label={`Abrir painel de cenários (atual: ${scenario})`}
        >
          <FlaskConical className="size-4 text-primary" aria-hidden />
          <span className="max-md:sr-only">Mock: {scenario}</span>
        </button>
      )}
    </div>
  )
}

function PanelButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className="rounded-sm border border-primary px-2 py-1 text-primary hover:bg-primary/10" {...props} />
}
