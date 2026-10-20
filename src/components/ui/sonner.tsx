import { Toaster as Sonner, type ToasterProps } from 'sonner'

/** Toasts com aria-live (o sonner anuncia via região "polite"). */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: '!bg-card !text-foreground !border !border-input !font-sans !rounded-md',
          description: '!text-muted-foreground',
          success: '!border-success/60',
          error: '!border-destructive/70',
          warning: '!border-price/70',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
