import { useState } from 'react'
import {
  Users,
  CalendarCheck,
  Wallet,
  GraduationCap,
  Bell,
  ChevronRight,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  BookOpen,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { usePortalOverview } from '@/api/hooks'
import { API_URL } from '@/api/client'

export function ParentStudentPortal() {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')

  const { data: portalData, isLoading, isError } = usePortalOverview(selectedStudentId || undefined)

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Loading consolidated student portal overview...
      </div>
    )
  }

  if (isError || !portalData) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 dark:border-rose-900 dark:bg-rose-950/20">
        Unable to load portal overview. Please try refreshing or logging in again.
      </div>
    )
  }

  const { children, active_student, attendance, fees, exams, announcements } = portalData

  return (
    <div className="space-y-6">
      {/* Top Header Card with Child Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent font-bold text-lg">
            {active_student?.first_name?.[0] || 'S'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {active_student ? `${active_student.first_name} ${active_student.last_name}` : 'Student Portal'}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
              <span>Adm No: <strong className="font-mono text-slate-700 dark:text-slate-300">{active_student?.admission_number}</strong></span>
              <span>•</span>
              <span>Class: <strong className="text-slate-700 dark:text-slate-300">{active_student?.class_name} - {active_student?.section_name}</strong></span>
              <span>•</span>
              <span>Roll: <strong className="text-slate-700 dark:text-slate-300">{active_student?.roll_number || '—'}</strong></span>
            </div>
          </div>
        </div>

        {/* Child Switcher for Parents with multiple linked children */}
        {children && children.length > 1 && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Select Child:</span>
            <select
              value={selectedStudentId || active_student?.student_id || ''}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {children.map((child: any) => (
                <option key={child.student_id} value={child.student_id}>
                  {child.first_name} {child.last_name} ({child.class_name}-{child.section_name})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Grid Layout for Consolidated Modules */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Module 1: Attendance Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 dark:text-white">Attendance Overview</h3>
            </div>
            <Badge variant={attendance?.overall_percentage >= 75 ? 'success' : 'danger'}>
              {attendance?.overall_percentage}%
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
              <span className="text-slate-400">Total Sessions</span>
              <p className="text-base font-bold text-slate-800 dark:text-white">{attendance?.total_sessions || 0}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2.5 dark:bg-emerald-950/30">
              <span className="text-emerald-600 dark:text-emerald-400">Present</span>
              <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">{attendance?.present_days || 0}</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-2.5 dark:bg-rose-950/30">
              <span className="text-rose-600 dark:text-rose-400">Absent</span>
              <p className="text-base font-bold text-rose-700 dark:text-rose-300">{attendance?.absent_days || 0}</p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recent Attendance History</h4>
            <div className="space-y-1.5">
              {attendance?.recent_logs && attendance.recent_logs.length > 0 ? (
                attendance.recent_logs.map((log: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 dark:border-slate-800/50">
                    <span className="text-slate-600 dark:text-slate-400 font-mono">{log.date}</span>
                    <Badge variant={log.status === 'present' ? 'success' : log.status === 'absent' ? 'danger' : 'warning'}>
                      {log.status.toUpperCase()}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No recent attendance entries recorded.</p>
              )}
            </div>
          </div>
        </div>

        {/* Module 2: Fee Dues Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-amber-600" />
              <h3 className="font-bold text-slate-900 dark:text-white">Fee Balance & Dues</h3>
            </div>
            <Badge variant={fees?.net_outstanding === 0 ? 'success' : 'warning'}>
              {fees?.net_outstanding === 0 ? 'CLEARED' : `₹${fees?.net_outstanding} DUE`}
            </Badge>
          </div>

          <div className="rounded-xl bg-amber-50/50 p-3.5 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-2xs text-amber-700 dark:text-amber-400 font-semibold">Net Outstanding Balance</span>
                <p className="text-xl font-black text-amber-900 dark:text-amber-200">₹{fees?.net_outstanding || 0}</p>
              </div>
              {fees?.next_due_date && (
                <div className="text-right">
                  <span className="text-2xs text-slate-500">Next Due Date</span>
                  <p className="text-xs font-bold text-rose-600">{fees.next_due_date}</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Active Invoices</h4>
            <div className="space-y-2">
              {fees?.invoices && fees.invoices.length > 0 ? (
                fees.invoices.slice(0, 3).map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{inv.title}</span>
                      <p className="text-2xs text-slate-400">Due: {inv.due_date}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900 dark:text-white">₹{inv.amount_due}</span>
                      <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'partial' ? 'warning' : 'danger'} className="block mt-0.5">
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No active fee invoices.</p>
              )}
            </div>
          </div>
        </div>

        {/* Module 3: Latest Exam Performance Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-accent" />
              <h3 className="font-bold text-slate-900 dark:text-white">Latest Exam Results</h3>
            </div>
            {exams && (
              <Badge variant={exams.is_passed ? 'success' : 'danger'}>
                {exams.grade} ({exams.percentage}%)
              </Badge>
            )}
          </div>

          {exams ? (
            <>
              <div className="flex items-center justify-between rounded-xl bg-blue-50/50 p-3.5 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">{exams.exam_name}</h4>
                  <p className="text-2xs text-slate-500">Total Score: {exams.total_obtained} / {exams.total_max}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const url = `${API_URL}/api/v1/exams/${exams.exam_id}/report-card/${active_student?.student_id}`
                    window.open(url, '_blank')
                  }}
                  className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-2xs font-semibold text-white hover:bg-blue-700"
                >
                  <Download className="h-3 w-3" />
                  Report Card
                </button>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Subject Breakdown</h4>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {exams.subject_marks?.map((sm: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-slate-800/50">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{sm.subject_name}</span>
                      <span className={`font-bold ${sm.marks_obtained < sm.pass_marks ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {sm.marks_obtained} / {sm.max_marks}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              No published examination results available yet.
            </div>
          )}
        </div>
      </div>

      {/* Module 4: Announcements & School Notices */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <Bell className="h-5 w-5 text-indigo-600" />
          <h3 className="font-bold text-slate-900 dark:text-white">School Announcements & Circulars</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {announcements && announcements.length > 0 ? (
            announcements.map((item: any) => (
              <div key={item.id} className="rounded-xl border border-slate-150 p-4 dark:border-slate-800 hover:border-slate-300 transition-all">
                <div className="flex items-center justify-between text-2xs text-slate-400 mb-1">
                  <span className="font-mono">{item.published_at.split('T')[0]}</span>
                  <Badge variant="neutral" className="capitalize">{item.target_role}</Badge>
                </div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-1">{item.title}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{item.content}</p>
              </div>
            ))
          ) : (
            <div className="col-span-2 py-6 text-center text-xs text-slate-400">
              No active announcements posted.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
