import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Database,
  FileSpreadsheet,
  Bell,
  Shield,
  Sparkles,
  RefreshCw,
  Copy,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Check,
} from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { FormField } from '@/components/shared/FormField'
import { useSyncToSheets, useGSheetsStatus, useTestGSheetsConnection } from '@/api/hooks'

type SettingsTab = 'general' | 'integrations' | 'notifications' | 'security'

function cleanSpreadsheetId(val: string): string {
  if (!val) return ''
  const trimmed = val.trim()
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (match && match[1]) {
    return match[1]
  }
  return trimmed.replace(/^['"]|['"]$/g, '')
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('integrations')
  const [spreadsheetId, setSpreadsheetId] = useState('')
  const [copied, setCopied] = useState(false)
  const [activeSyncModule, setActiveSyncModule] = useState<string | null>(null)

  const { data: gsheetsStatus, isLoading: isStatusLoading, refetch: refetchStatus } = useGSheetsStatus()
  const testMutation = useTestGSheetsConnection()
  const syncMutation = useSyncToSheets()

  // Load spreadsheet ID from local storage
  useEffect(() => {
    const saved = localStorage.getItem('educore_gsheet_id') || ''
    setSpreadsheetId(saved)
  }, [])

  const handleSpreadsheetInputChange = (val: string) => {
    const cleaned = cleanSpreadsheetId(val)
    setSpreadsheetId(cleaned)
  }

  const handleSaveSpreadsheetId = (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = cleanSpreadsheetId(spreadsheetId)
    if (!cleaned) {
      toast.error('Please enter a valid Google Spreadsheet ID or URL.')
      return
    }
    setSpreadsheetId(cleaned)
    localStorage.setItem('educore_gsheet_id', cleaned)
    toast.success('Google Spreadsheet ID saved successfully!')
  }

  const handleCopyEmail = () => {
    if (gsheetsStatus?.client_email) {
      navigator.clipboard.writeText(gsheetsStatus.client_email)
      setCopied(true)
      toast.success('Service account email copied to clipboard!')
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const handleTestConnection = async () => {
    const cleaned = cleanSpreadsheetId(spreadsheetId)
    if (!cleaned) {
      toast.error('Please enter a Google Spreadsheet ID or URL first.')
      return
    }

    try {
      const res = await testMutation.mutateAsync({ spreadsheet_id: cleaned })
      toast.success(res.message || 'Connected to Google Spreadsheet successfully!')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Connection test failed. Verify permissions.')
    }
  }

  const handleSyncModule = async (module: string) => {
    const cleaned = cleanSpreadsheetId(spreadsheetId)
    if (!cleaned) {
      toast.error('Please configure and save your Google Spreadsheet ID first.')
      return
    }

    setActiveSyncModule(module)
    try {
      const res = await syncMutation.mutateAsync({
        spreadsheet_id: cleaned,
        module,
      })
      toast.success(res.message || `${module.replace(/^\w/, (c) => c.toUpperCase())} synced successfully to Google Sheets!`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Sheets synchronization failed. Check ID/credentials.')
    } finally {
      setActiveSyncModule(null)
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
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Google Sheets Integration</h3>
                  {isStatusLoading ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      <RefreshCw className="h-3 w-3 animate-spin" /> Checking...
                    </span>
                  ) : gsheetsStatus?.configured ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Auth Configured
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      Credentials Missing
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Synchronize school registries and ledger records directly to Google Sheets using service account sync.
                </p>
              </div>

              {/* Service Account instructions & email box */}
              {gsheetsStatus?.configured && gsheetsStatus.client_email ? (
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                    Step 1: Share Google Sheet with Service Account
                  </h4>
                  <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
                    Open your Google Sheet, click the top-right <strong className="font-semibold">Share</strong> button, and add this email as an <strong className="font-semibold">Editor</strong>:
                  </p>
                  <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 dark:border-blue-800 dark:bg-slate-800">
                    <code className="flex-1 font-mono text-xs text-blue-950 dark:text-blue-200 select-all">
                      {gsheetsStatus.client_email}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="inline-flex items-center gap-1 rounded bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" /> Copy Email
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <div className="flex gap-2.5">
                    <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="text-xs text-amber-800 dark:text-amber-300">
                      <p className="font-semibold">Google Sheets Credentials Not Configured</p>
                      <p className="mt-1">
                        To enable sync, configure your Google Service Account in your backend environment variable <code className="rounded bg-amber-100 px-1 py-0.5 font-mono dark:bg-amber-900">GOOGLE_SHEETS_CREDENTIALS_JSON</code> or place <code className="rounded bg-amber-100 px-1 py-0.5 font-mono dark:bg-amber-900">service_account.json</code> in the backend directory.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ID configuration form */}
              <form onSubmit={handleSaveSpreadsheetId} className="space-y-4">
                <FormField
                  label="Step 2: Google Spreadsheet ID or URL"
                  required
                  helperText="Paste the complete Google Sheets URL or just the Spreadsheet ID."
                >
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      placeholder="https://docs.google.com/spreadsheets/d/1a2b3c4d... or 1a2b3c4d..."
                      value={spreadsheetId}
                      onChange={(e) => handleSpreadsheetInputChange(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      required
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Save ID
                      </button>
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testMutation.isPending || !spreadsheetId}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${testMutation.isPending ? 'animate-spin' : ''}`} />
                        {testMutation.isPending ? 'Testing...' : 'Test Connection'}
                      </button>
                    </div>
                  </div>
                </FormField>
              </form>

              {/* Sync triggers grid */}
              <div className="border-t border-slate-100 pt-6 dark:border-slate-800">
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Step 3: Synchronize Modules</h4>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Click any module below to sync data. Missing tabs (e.g. Students, Fees, Attendance) will be created automatically in your Google Sheet.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { id: 'students', label: 'Students Registry', desc: 'Sync all student records and classes into "Students" tab.' },
                    { id: 'fees', label: 'Fees Ledger', desc: 'Sync transaction history and receipts into "Fees" tab.' },
                    { id: 'attendance', label: 'Attendance logs', desc: 'Sync daily attendance statistics into "Attendance" tab.' },
                  ].map((mod) => {
                    const isModulePending = syncMutation.isPending && activeSyncModule === mod.id
                    return (
                      <div
                        key={mod.id}
                        className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50"
                      >
                        <div>
                          <h5 className="font-semibold text-slate-800 dark:text-slate-200">{mod.label}</h5>
                          <p className="mt-1 text-2xs text-slate-500 leading-normal">{mod.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSyncModule(mod.id)}
                          disabled={syncMutation.isPending}
                          className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${isModulePending ? 'animate-spin' : ''}`} />
                          {isModulePending ? 'Syncing...' : 'Sync Now'}
                        </button>
                      </div>
                    )
                  })}
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
