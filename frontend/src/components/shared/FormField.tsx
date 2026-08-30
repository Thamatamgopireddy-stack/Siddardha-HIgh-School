import { cn } from '@/utils'

interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  helperText?: string
  children: React.ReactNode
  className?: string
}

export function FormField({
  label,
  error,
  required = false,
  helperText,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="ml-0.5 text-danger font-bold">*</span>}
      </label>
      <div>{children}</div>
      {error && <p className="text-xs text-danger font-medium">{error}</p>}
      {!error && helperText && <p className="text-2xs text-slate-400">{helperText}</p>}
    </div>
  )
}
