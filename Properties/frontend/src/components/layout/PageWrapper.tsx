interface PageWrapperProps {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  loading?: boolean
}

export function PageWrapper({ title, description, actions, children, loading }: PageWrapperProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-64 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary dark:text-white">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
