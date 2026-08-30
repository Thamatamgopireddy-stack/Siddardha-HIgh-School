import { cn } from '@/utils'

interface DateRangePickerProps {
  startDate?: string
  endDate?: string
  onChange: (start: string, end: string) => void
  className?: string
}

export function DateRangePicker({
  startDate = '',
  endDate = '',
  onChange,
  className,
}: DateRangePickerProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        type="date"
        value={startDate}
        onChange={(e) => onChange(e.target.value, endDate)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800"
      />
      <span className="text-xs text-slate-400">to</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => onChange(startDate, e.target.value)}
        min={startDate}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800"
      />
    </div>
  )
}
