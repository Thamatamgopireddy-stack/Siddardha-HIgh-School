import { useState } from 'react'
import { toast } from 'sonner'
import { Megaphone, Plus, Calendar, User } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { Modal } from '@/components/shared/Modal'
import { FormField } from '@/components/shared/FormField'
import { Badge } from '@/components/ui/Badge'
import { useNotices, useCreateNotice, usePublishNotice } from '@/api/hooks'

export function NoticeboardPage() {
  const { data: notices, isLoading } = useNotices()
  const createNoticeMutation = useCreateNotice()
  const publishNoticeMutation = usePublishNotice()

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [formValues, setFormValues] = useState({
    title: '',
    content: '',
    target_role: 'all',
  })

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const notice = await createNoticeMutation.mutateAsync(formValues)
      await publishNoticeMutation.mutateAsync(notice.id)
      toast.success('Notice published successfully on the notice board')
      setIsAddModalOpen(false)
      setFormValues({ title: '', content: '', target_role: 'all' })
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to publish notice')
    }
  }

  return (
    <PageWrapper
      title="Notice Board"
      description="View and publish official school announcements, news, and notifications."
      actions={
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" /> Add Announcement
        </button>
      }
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">Loading notices...</div>
        ) : !notices || notices.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <Megaphone className="h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm text-slate-500">No notices posted yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {notices.map((notice: any) => (
              <div
                key={notice.id}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {notice.title}
                  </h3>
                  <Badge variant="info">Target: {notice.target_role}</Badge>
                </div>
                
                <p className="mt-3 flex-1 text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line">
                  {notice.content}
                </p>

                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" /> By {notice.published_by_name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> {notice.published_at ? new Date(notice.published_at).toLocaleDateString() : 'Draft'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Post Notice Announcement"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <FormField label="Announcement Title" required>
            <input
              type="text"
              required
              placeholder="e.g., Independence Day Holiday Notice"
              value={formValues.title}
              onChange={(e) => setFormValues({ ...formValues, title: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </FormField>

          <FormField label="Message Details" required>
            <textarea
              required
              rows={5}
              placeholder="Provide detail description of the notice..."
              value={formValues.content}
              onChange={(e) => setFormValues({ ...formValues, content: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </FormField>

          <FormField label="Target Audience" required>
            <select
              value={formValues.target_role}
              onChange={(e) => setFormValues({ ...formValues, target_role: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="all">Everyone</option>
              <option value="student">Students</option>
              <option value="teacher">Teachers</option>
              <option value="parent">Parents</option>
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
              Publish Notice
            </button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  )
}
