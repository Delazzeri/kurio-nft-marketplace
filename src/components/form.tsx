import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { isApiError } from '@/api/client'
import { cn } from '@/lib/utils'

/**
 * Campo com label, erro associado (aria-describedby) e aria-invalid.
 * `hideLabel` mantém o visual do Figma (só placeholder) sem perder o rótulo acessível.
 */
export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    label: string
    error?: string
    hint?: ReactNode
    required?: boolean
    hideLabel?: boolean
    addon?: ReactNode
    inputClassName?: string
  }
>(function TextField({ label, error, hint, required, hideLabel, addon, className, inputClassName, id: idProp, type = 'text', ...props }, ref) {
  const autoId = useId()
  const id = idProp ?? autoId
  const [reveal, setReveal] = useState(false)
  const isPassword = type === 'password'
  const describedBy = [error ? `${id}-erro` : null, hint ? `${id}-dica` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('text-sm', hideLabel && 'sr-only')}>
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-destructive">
            *
          </span>
        )}
        {required && <span className="sr-only"> (obrigatório)</span>}
      </label>
      <div className="flex gap-2">
        {addon}
        <div className="relative flex-1">
          <input
            ref={ref}
            id={id}
            type={isPassword && reveal ? 'text' : type}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={cn(
              'h-10 w-full rounded-sm border border-border bg-background px-3 text-sm placeholder:text-muted-foreground/80 focus:border-primary',
              'aria-[invalid=true]:border-destructive',
              isPassword && 'pr-11',
              inputClassName,
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={reveal}
              className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-primary"
            >
              {reveal ? <Eye aria-hidden className="size-4" /> : <EyeOff aria-hidden className="size-4" />}
            </button>
          )}
        </div>
      </div>
      {hint && !error && (
        <p id={`${id}-dica`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-erro`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
})

/** Mapeia erros de validação/conflito da API para os campos do formulário. Retorna a mensagem geral. */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fieldMap: Record<string, Path<T>> = {}) {
  if (!isApiError(error)) return 'Erro inesperado. Tente novamente.'
  let focused = false
  for (const [field, message] of Object.entries(error.fields ?? {})) {
    const target = (fieldMap[field] ?? field) as Path<T>
    setError(target, { type: 'server', message }, { shouldFocus: !focused })
    focused = true
  }
  return error.message
}

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-sm border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  )
}
