import { cn } from '@/utils'

const variants = {
  success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: keyof typeof variants
  className?: string
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  )
}
