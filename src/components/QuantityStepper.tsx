import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  disabled,
  size = 'md',
}: {
  value: number
  min?: number
  max: number
  onChange: (v: number) => void
  label: string
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  const btn = cn(
    'flex items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-price disabled:cursor-not-allowed disabled:opacity-40',
    size === 'md' ? 'h-10 w-7' : 'h-6 w-5',
  )
  return (
    <div role="group" aria-label={label} className="flex items-center gap-3">
      <button type="button" className={btn} aria-label="Diminuir quantidade" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>
        <Minus aria-hidden className={size === 'md' ? 'size-4' : 'size-3'} strokeWidth={3} />
      </button>
      <output aria-live="polite" aria-label="Quantidade" className={cn('min-w-5 text-center tabular-nums', size === 'md' ? 'text-lg' : 'text-base')}>
        {value}
      </output>
      <button type="button" className={btn} aria-label="Aumentar quantidade" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        <Plus aria-hidden className={size === 'md' ? 'size-4' : 'size-3'} strokeWidth={3} />
      </button>
    </div>
  )
}
