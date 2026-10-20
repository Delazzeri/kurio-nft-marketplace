import { useEffect, useRef, type ReactNode } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

/**
 * Drawer de filtros (mobile/tablet). Carregado sob demanda: o Dialog do Radix e suas
 * dependências só entram quando o usuário abre o drawer.
 * Ao fechar, o foco volta ao elemento que o abriu.
 */
export default function FiltersDrawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const opener = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null)
  useEffect(() => {
    const target = opener.current
    return () => target?.focus()
  }, [])
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="left"
        className="w-[88vw] max-w-sm overflow-y-auto border-border bg-background"
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          opener.current?.focus()
        }}
      >
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Os resultados são atualizados a cada seleção.</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  )
}
