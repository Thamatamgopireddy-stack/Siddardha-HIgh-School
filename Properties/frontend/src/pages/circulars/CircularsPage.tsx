import { useState } from 'react'
import { toast } from 'sonner'
import { FileText, Plus, Calendar, User } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { DataTable } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { FormField } from '@/components/shared/FormField'
import { Badge } from '@/components/ui/Badge'
import { useCircularsList, useCreateCircular } from '@/api/hooks'

export function CircularsPage() {
  const { data: circulars, isLoading } = useCircularsList()
  const createCircularMutation = useCreateCircular()

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [formValues, setFormValues] = useState({
    title: '',
    content: '',
    target_role: 'all',
  })

  const columns = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }: any) => <span className="font-semibold text-slate-900 dark:text-white">{row.original.title}</span>,
    },
    {
      accessorKey: 'content',
      header: 'Content / Scope',
      cell: ({ row }: any) => (
        <span className="max-w-xs truncate block text-xs text-slate-500">
          {row.original.content}
        </span>
      ),
    },
    {
      accessorKey: 'target_role',
      header: 'Target Audience',
      cell: ({ row }: any) => <Badge variant="info">{row.original.target_role}</Badge>,
    },
    {
      accessorKey: 'published_by_name',
      header: 'Published By',
      cell: ({ row }: any) => (
        <span className="flex items-center gap-1 text-xs">
          <User className="h-3 w-3 text-slate-400" /> {row.original.published_by_name}
        </span>
      ),
    },
    {
      accessorKey: 'published_at',
      header: 'Publish Date',
      cell: ({ row }: any) => (
        <span className="flex items-center gap-1 text-xs">
          <Calendar className="h-3 w-3 text-slate-400" /> {row.original.published_at ? new Date(row.original.published_at).toLocaleDateString() : '—'}
        </span>
      ),
    },
  ]

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createCircularMutation.mutateAsync(formValues)
      toast.success('Official circular published successfully')
      setIsAddModalOpen(false)
      setFormValues({ title: '', content: '', target_role: 'all' })
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to publish circular')
    }
  }

  return (
    <PageWrapper
      title="Official Circulars"
      description="Publish and view school circulars, academic guidelines, policy documents, and board regulations."
      actions={
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" /> Add Circular
        </button>
      }
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <DataTable
            columns={columns}
            data={circulars || []}
            isLoading={isLoading}
          />
        </div>
      </div>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create & Publish Official Circular"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <FormField label="Circular Title" required>
            <input
              type="text"
              required
              placeholder="e.g., Mid-Term Assessment Schedule Update"
              value={formValues.title}
              onChange={(e) => setFormValues({ ...formValues, title: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </FormField>

          <FormField label="Content Details" required>
            <textarea
              required
              rows={6}
              placeholder="Provide circular text here..."
              value={formValues.content}
              onChange={(e) => setFormValues({ ...formValues, content: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </FormField>

          <FormField label="Target Audience Group" required>
            <select
              value={formValues.target_role}
              onChange={(e) => setFormValues({ ...formValues, target_role: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 text-sm"
            >
              <option value="all">All School Roles</option>
              <option value="teacher">Teachers Only</option>
              <option value="student">Students Only</option>
              <option value="parent">Parents Only</option>
            </select>
          </FormField>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Publish Circular
            </button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  )
}
