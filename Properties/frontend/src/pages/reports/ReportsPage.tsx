import { useState } from 'react'
import { FileText, Award, BarChart3, TrendingUp, AlertCircle, Printer } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { FormField } from '@/components/shared/FormField'
import { DataTable } from '@/components/shared/DataTable'
import {
  useAttendanceSummary,
  useFeeOutstanding,
  useAcademicYears,
  useStudents,
} from '@/api/hooks'
import { API_URL } from '@/api/client'

type ReportsTab = 'analytics' | 'certificates'

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportsTab>('analytics')
  
  // Certificate Form state
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [certificateType, setCertificateType] = useState('Bonafide Certificate')

  // API Hooks
  const { data: attendanceSummary, isLoading: isAttLoading } = useAttendanceSummary()
  const { data: feeOutstanding, isLoading: isFeeLoading } = useFeeOutstanding()

  const { data: academicYears } = useAcademicYears()
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
  if (!selectedAcademicYear && academicYears && academicYears.length > 0) {
    const current = academicYears.find((y) => y.is_current)
    setSelectedAcademicYear(current ? current.id : academicYears[0].id)
  }

  const { data: studentsData } = useStudents(1, '', '', selectedAcademicYear || undefined)
  const students = studentsData?.data || []

  const handlePrintCertificate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudentId) return
    const url = `${API_URL}/api/v1/reports/certificates/issue?student_id=${selectedStudentId}&cert_type=${encodeURIComponent(
      certificateType
    )}`
    window.open(url, '_blank')
  }

  return (
    <PageWrapper
      title="Reports & Analytics"
      description="Consolidated school metrics, ledgers, and printable certificates builder."
    >
      {/* Tabs Selector */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-[2px] ${
            activeTab === 'analytics'
              ? 'border-accent text-accent'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Performance Analytics
        </button>
        <button
          onClick={() => setActiveTab('certificates')}
          className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-[2px] ${
            activeTab === 'certificates'
              ? 'border-accent text-accent'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Certificate Builder
        </button>
      </div>

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Fee stats cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <span className="text-3xs font-semibold uppercase tracking-wider text-slate-400">Total Demanded Fees</span>
                <h4 className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">
                  {isFeeLoading ? '...' : `₹${feeOutstanding?.total_expected?.toLocaleString()}`}
                </h4>
              </div>
              <span className="text-3xs text-slate-400 mt-2">mandatory structured logs</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <span className="text-3xs font-semibold uppercase tracking-wider text-slate-400">Total Collected</span>
                <h4 className="mt-1 text-lg font-bold text-success">
                  {isFeeLoading ? '...' : `₹${feeOutstanding?.total_collected?.toLocaleString()}`}
                </h4>
              </div>
              <span className="text-3xs text-slate-400 mt-2">payment receipts ledger</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <span className="text-3xs font-semibold uppercase tracking-wider text-slate-400">Outstanding Balance</span>
                <h4 className="mt-1 text-lg font-bold text-danger">
                  {isFeeLoading ? '...' : `₹${feeOutstanding?.total_outstanding?.toLocaleString()}`}
                </h4>
              </div>
              <span className="text-3xs text-slate-400 mt-2">pending accounts deficit</span>
            </div>
          </div>

          {/* Attendance Section stats */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <BarChart3 className="h-5 w-5 text-accent" />
              <h4 className="font-semibold text-slate-800 dark:text-white">Attendance Rates by Class Section</h4>
            </div>

            <DataTable
              columns={[
                { accessorKey: 'class_name', header: 'Class Name' },
                { accessorKey: 'section_name', header: 'Section Name' },
                { accessorKey: 'present_days', header: 'Present Days (Aggregate)' },
                { accessorKey: 'total_days', header: 'Total Days Logged' },
                {
                  accessorKey: 'rate',
                  header: 'Attendance Rate',
                  cell: ({ row }) => (
                    <span className={`font-semibold ${row.original.rate >= 90 ? 'text-success' : 'text-danger'}`}>
                      {row.original.rate}%
                    </span>
                  ),
                },
              ]}
              data={attendanceSummary || []}
              isLoading={isAttLoading}
            />
          </div>
        </div>
      )}

      {activeTab === 'certificates' && (
        <div className="max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 border-b border-slate-100 pb-3 dark:border-slate-800">
            <h4 className="font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
              <Award className="h-5 w-5 text-accent" />
              Dynamic Certificate Generator
            </h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Issue printable Transfer, Character, or Bonafide Certificates for students.
            </p>
          </div>

          <form onSubmit={handlePrintCertificate} className="space-y-4">
            <FormField label="Select Student Registry" required>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              >
                <option value="">Select Enrolled Student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} ({s.admission_number})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Certificate Type / Template" required>
              <select
                value={certificateType}
                onChange={(e) => setCertificateType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              >
                <option value="Bonafide Certificate">Bonafide Student Certificate</option>
                <option value="Transfer Certificate">School Leaving Transfer Certificate (TC)</option>
                <option value="Character Certificate">Conduct & Character Certificate</option>
              </select>
            </FormField>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                disabled={!selectedStudentId}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                Build PDF Certificate
              </button>
            </div>
          </form>
        </div>
      )}
    </PageWrapper>
  )
}
