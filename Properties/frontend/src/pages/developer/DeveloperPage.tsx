import { toast } from 'sonner'
import { Server, Database, RefreshCw, Terminal, Activity } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { Badge } from '@/components/ui/Badge'
import { useDevHealth, useDevSeed, useDevLogs } from '@/api/hooks'

export function DeveloperPage() {
  const { data: health, isLoading: isHealthLoading } = useDevHealth()
  const { data: logs, isLoading: isLogsLoading } = useDevLogs()
  const seedMutation = useDevSeed()

  const handleSeedTrigger = async () => {
    try {
      await seedMutation.mutateAsync()
      toast.success('System database seeded successfully!')
    } catch {
      toast.error('Failed to trigger database seeding')
    }
  }

  return (
    <PageWrapper
      title="Developer Control Panel"
      description="Superadmin operations, maintenance scripts, and system health status."
    >
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left column: health stats */}
        <div className="md:col-span-1 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Server className="h-4.5 w-4.5 text-accent" />
              System Status
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-50 pb-2 dark:border-slate-800/50">
                <span className="text-slate-500">Core Health</span>
                {isHealthLoading ? (
                  <span className="animate-pulse">Loading...</span>
                ) : (
                  <Badge variant="success">Online</Badge>
                )}
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 pb-2 dark:border-slate-800/50">
                <span className="text-slate-500">Database Engine</span>
                <span className="font-semibold text-slate-800 dark:text-slate-250">{health?.database || '—'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 pb-2 dark:border-slate-800/50">
                <span className="text-slate-500">Vision OCR Portal</span>
                <span className="font-semibold text-slate-800 dark:text-slate-250">{health?.sms_gateway || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Memory Cache</span>
                <span className="font-semibold text-slate-800 dark:text-slate-250">{health?.cache || '—'}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Database className="h-4.5 w-4.5 text-accent" />
              Database Operations
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Reset database and restore standard administrator, teacher, and mock student registry records.
            </p>
            <button
              onClick={handleSeedTrigger}
              disabled={seedMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${seedMutation.isPending ? 'animate-spin' : ''}`} />
              Re-Seed Database
            </button>
          </div>
        </div>

        {/* Right column: console logs */}
        <div className="md:col-span-2 space-y-4 flex flex-col h-full">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex-1 flex flex-col">
            <h3 className="mb-4 font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Terminal className="h-4.5 w-4.5 text-accent" />
              Console Logs Visualizer
            </h3>

            <div className="flex-1 bg-slate-950 rounded-xl p-4 font-mono text-2xs text-slate-300 min-h-[300px] overflow-y-auto space-y-2 select-text">
              {isLogsLoading ? (
                <div className="animate-pulse text-slate-500">Establishing telemetry connection...</div>
              ) : logs && logs.length > 0 ? (
                logs.map((log: string, idx: number) => (
                  <div key={idx} className="leading-relaxed hover:bg-slate-900 px-1 py-0.5 rounded">
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-slate-500">No telemetry log entries streamed yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
