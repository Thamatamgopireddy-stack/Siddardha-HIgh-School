import { cn } from '@/utils'

interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  icon?: React.ReactNode
  color?: string
  trend?: number
}

export function StatCard({ label, value, subtext, icon, color = 'bg-accent', trend }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
          {subtext && <p className="mt-1 text-xs text-slate-400">{subtext}</p>}
          {trend !== undefined && (
            <p className={cn('mt-1 text-xs font-medium', trend >= 0 ? 'text-success' : 'text-danger')}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </p>
          )}
        </div>
        {icon && <div className={cn('rounded-lg p-3 text-white', color)}>{icon}</div>}
      </div>
    </div>
  )
}
