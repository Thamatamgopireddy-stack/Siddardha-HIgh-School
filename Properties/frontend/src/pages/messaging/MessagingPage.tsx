import { useState } from 'react'
import { toast } from 'sonner'
import { Send, Inbox, Mail, MailOpen, User, CheckCircle } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { Modal } from '@/components/shared/Modal'
import { FormField } from '@/components/shared/FormField'
import { Badge } from '@/components/ui/Badge'
import { useMessages, useSendMessage, useMarkMessageRead } from '@/api/hooks'

export function MessagingPage() {
  const [activeTab, setActiveTab] = useState<'inbox' | 'compose'>('inbox')
  
  const { data: messages, isLoading } = useMessages()
  const sendMessageMutation = useSendMessage()
  const readMessageMutation = useMarkMessageRead()

  const [formValues, setFormValues] = useState({
    recipient_role: 'teacher',
    title: '',
    body: '',
  })

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await sendMessageMutation.mutateAsync(formValues)
      toast.success('Message/notification dispatched successfully')
      setActiveTab('inbox')
      setFormValues({ recipient_role: 'teacher', title: '', body: '' })
    } catch {
      toast.error('Failed to send message')
    }
  }

  const handleMarkRead = async (id: string) => {
    try {
      await readMessageMutation.mutateAsync(id)
      toast.success('Notification marked as read')
    } catch {
      toast.error('Failed to mark read')
    }
  }

  return (
    <PageWrapper
      title="Internal Messaging"
      description="Send direct system notifications and broadcast announcements to students, teachers, or parents."
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`border-b-2 px-6 py-3 text-sm font-semibold ${
              activeTab === 'inbox'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Inbox Notifications
          </button>
          <button
            onClick={() => setActiveTab('compose')}
            className={`border-b-2 px-6 py-3 text-sm font-semibold ${
              activeTab === 'compose'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Broadcast Message
          </button>
        </div>

        {activeTab === 'inbox' ? (
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex min-h-[200px] items-center justify-center">Loading notifications...</div>
            ) : !messages || messages.length === 0 ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                <Inbox className="h-8 w-8 text-slate-400" />
                <p className="mt-2 text-sm text-slate-500">Inbox is empty. No notifications received.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex items-start justify-between rounded-xl border p-4 shadow-sm transition-colors ${
                      msg.is_read
                        ? 'border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/20'
                        : 'border-indigo-100 bg-indigo-50/10 dark:border-indigo-900/10 dark:bg-indigo-950/5'
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="mt-0.5">
                        {msg.is_read ? (
                          <MailOpen className="h-5 w-5 text-slate-400" />
                        ) : (
                          <Mail className="h-5 w-5 text-indigo-500" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">{msg.title}</h4>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{msg.body}</p>
                        {msg.created_at && (
                          <span className="mt-2 block text-xs text-slate-400">
                            Received: {new Date(msg.created_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {!msg.is_read && (
                      <button
                        onClick={() => handleMarkRead(msg.id)}
                        className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-100"
                      >
                        <CheckCircle className="h-3 w-3" /> Mark Read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <form onSubmit={handleSend} className="space-y-4">
              <FormField label="Target Audience Role" required>
                <select
                  value={formValues.recipient_role}
                  onChange={(e) => setFormValues({ ...formValues, recipient_role: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 text-sm capitalize"
                >
                  <option value="student">All Students</option>
                  <option value="teacher">All Teachers</option>
                  <option value="parent">All Parents</option>
                  <option value="librarian">All Librarians</option>
                </select>
              </FormField>

              <FormField label="Message Title / Headline" required>
                <input
                  type="text"
                  required
                  placeholder="e.g., Mandatory Staff Review Meeting"
                  value={formValues.title}
                  onChange={(e) => setFormValues({ ...formValues, title: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </FormField>

              <FormField label="Message Body Details" required>
                <textarea
                  required
                  rows={4}
                  placeholder="Type your message description here..."
                  value={formValues.body}
                  onChange={(e) => setFormValues({ ...formValues, body: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </FormField>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                >
                  <Send className="h-4 w-4" /> Send Notification
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
