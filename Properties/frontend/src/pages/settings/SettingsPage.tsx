import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Database, FileSpreadsheet, Key, Bell, Shield, Sparkles, RefreshCw } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { FormField } from '@/components/shared/FormField'
import { useSyncToSheets } from '@/api/hooks'

type SettingsTab = 'general' | 'integrations' | 'notifications' | 'security'

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('integrations')
  const [spreadsheetId, setSpreadsheetId] = useState('')
  const syncMutation = useSyncToSheets()

  // Load spreadsheet ID from local storage
  useEffect(() => {
    const saved = localStorage.getItem('siddardha_gsheet_id') || ''
    setSpreadsheetId(saved)
  }, [])

  const handleSaveSpreadsheetId = (e: React.FormEvent) => {
    e.preventDefault()
    localStorage.setItem('siddardha_gsheet_id', spreadsheetId)
    toast.success('Google Spreadsheet ID saved successfully!')
  }

  const handleSyncModule = async (module: string) => {
    if (!spreadsheetId.trim()) {
      toast.error('Please configure and save your Google Spreadsheet ID first.')
      return
    }

    try {
      await syncMutation.mutateAsync({
        spreadsheet_id: spreadsheetId,
        module,
      })
      toast.success(`${module.replace(/^\w/, (c) => c.toUpperCase())} synced successfully to Google Sheets!`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Sheets synchronization failed. Check ID/credentials.')
    }
  }

  return (
    <PageWrapper
      title="Settings"
      description="Configure default system preferences, schedules, and Google/SMS integrations."
    >
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left tabs selector panel */}
        <div className="w-full shrink-0 space-y-1 lg:w-64">
          {[
            { id: 'general', label: 'General Info', icon: Database },
            { id: 'integrations', label: 'External Integrations', icon: FileSpreadsheet },
            { id: 'notifications', label: 'SMS & Email Keys', icon: Bell },
            { id: 'security', label: 'System Security', icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Right Content Panel */}
        <div className="flex-1 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {activeTab === 'integrations' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Google Sheets Integration</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Synchronize school registries and ledger records directly to Google Sheets using service account sync.
                </p>
              </div>

              {/* ID configuration form */}
              <form onSubmit={handleSaveSpreadsheetId} className="space-y-4">
                <FormField label="Google Spreadsheet ID" required>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 1a2b3c4d5e6f7g8h9i0j..."
                      value={spreadsheetId}
                      onChange={(e) => setSpreadsheetId(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      required
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Save ID
                    </button>
                  </div>
                </FormField>
              </form>

              {/* Sync triggers grid */}
              <div className="border-t border-slate-100 pt-6 dark:border-slate-800">
                <h4 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Synchronize Modules</h4>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { id: 'students', label: 'Students Registry', desc: 'Sync all student records and classes.' },
                    { id: 'fees', label: 'Fees Ledger', desc: 'Sync transaction history and receipts.' },
                    { id: 'attendance', label: 'Attendance logs', desc: 'Sync daily attendance statistics.' },
                  ].map((mod) => (
                    <div
                      key={mod.id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50"
                    >
                      <div>
                        <h5 className="font-semibold text-slate-800 dark:text-slate-200">{mod.label}</h5>
                        <p className="mt-1 text-2xs text-slate-500 leading-normal">{mod.desc}</p>
                      </div>
                      <button
                        onClick={() => handleSyncModule(mod.id)}
                        disabled={syncMutation.isPending}
                        className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                        Sync Now
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="py-12 text-center text-slate-400">
              <Sparkles className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm">General settings configuration is managed in standard config parameters.</p>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="py-12 text-center text-slate-400">
              <Bell className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm">Notification SMS/Email auth keys are set in environmental .env parameters.</p>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="py-12 text-center text-slate-400">
              <Shield className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm">System roles and backup schedules are managed dynamically by the database.</p>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}
