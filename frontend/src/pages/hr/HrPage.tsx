import { PageWrapper } from '@/components/layout/PageWrapper'

export function HrPage() {
  return (
    <PageWrapper title="HR & Staff" description="Manage school staff registry, department hierarchy, and leave applications.">
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 text-5xl">👔</div>
        <h2 className="text-lg font-medium">Module coming soon</h2>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          The HR module is scaffolded and ready for implementation.
        </p>
      </div>
    </PageWrapper>
  )
}
