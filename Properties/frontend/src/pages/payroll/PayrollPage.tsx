import { useState } from 'react'
import { toast } from 'sonner'
import { Landmark, Settings, Coins, Check } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { DataTable } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { FormField } from '@/components/shared/FormField'
import { Badge } from '@/components/ui/Badge'
import {
  usePayrollStructures,
  useSaveSalaryStructure,
  useGeneratePayroll,
  useMonthlyPayrolls,
  usePaySalary,
  useHRStaff,
} from '@/api/hooks'

const MONTHS = [
  { name: 'January', val: 1 },
  { name: 'February', val: 2 },
  { name: 'March', val: 3 },
  { name: 'April', val: 4 },
  { name: 'May', val: 5 },
  { name: 'June', val: 6 },
  { name: 'July', val: 7 },
  { name: 'August', val: 8 },
  { name: 'September', val: 9 },
  { name: 'October', val: 10 },
  { name: 'November', val: 11 },
  { name: 'December', val: 12 },
]

export function PayrollPage() {
  const [activeTab, setActiveTab] = useState<'payrun' | 'structures'>('payrun')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const { data: structures, isLoading: isStructuresLoading } = usePayrollStructures()
  const { data: payrolls, isLoading: isPayrollsLoading } = useMonthlyPayrolls(selectedMonth, selectedYear)
  const { data: staffList } = useHRStaff()

  const saveStructureMutation = useSaveSalaryStructure()
  const generatePayrollMutation = useGeneratePayroll()
  const paySalaryMutation = usePaySalary()

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [configValues, setConfigValues] = useState({
    staff_id: '',
    base_salary: 0,
    allowances: 0,
    deductions: 0,
  })

  const [genValues, setGenValues] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  })

  const structuresColumns = [
    {
      accessorKey: 'employee_id',
      header: 'Employee ID',
      cell: ({ row }: any) => <span className="font-mono text-xs font-semibold">{row.original.employee_id}</span>,
    },
    {
      accessorKey: 'staff_name',
      header: 'Name',
      cell: ({ row }: any) => <span className="font-medium">{row.original.staff_name}</span>,
    },
    {
      accessorKey: 'base_salary',
      header: 'Base Salary',
      cell: ({ row }: any) => <span>₹{row.original.base_salary.toLocaleString()}</span>,
    },
    {
      accessorKey: 'allowances',
      header: 'Allowances',
      cell: ({ row }: any) => <span>₹{row.original.allowances.toLocaleString()}</span>,
    },
    {
      accessorKey: 'deductions',
      header: 'Deductions',
      cell: ({ row }: any) => <span className="text-red-500">₹{row.original.deductions.toLocaleString()}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <button
          onClick={() => {
            setConfigValues({
              staff_id: row.original.staff_id,
              base_salary: row.original.base_salary,
              allowances: row.original.allowances,
              deductions: row.original.deductions,
            })
            setIsConfigModalOpen(true)
          }}
          className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-100"
        >
          Update Rules
        </button>
      ),
    },
  ]

  const payrollColumns = [
    {
      accessorKey: 'employee_id',
      header: 'Employee ID',
      cell: ({ row }: any) => <span className="font-mono text-xs font-semibold">{row.original.employee_id}</span>,
    },
    {
      accessorKey: 'staff_name',
      header: 'Name',
      cell: ({ row }: any) => <span className="font-medium">{row.original.staff_name}</span>,
    },
    {
      accessorKey: 'net_salary',
      header: 'Net Payout',
      cell: ({ row }: any) => <span className="font-semibold">₹{row.original.net_salary.toLocaleString()}</span>,
    },
    {
      accessorKey: 'payment_status',
      header: 'Status',
      cell: ({ row }: any) => (
        <Badge variant={row.original.payment_status === 'paid' ? 'success' : 'warning'}>
          {row.original.payment_status}
        </Badge>
      ),
    },
    {
      accessorKey: 'payment_date',
      header: 'Payment Date',
      cell: ({ row }: any) => row.original.payment_date || '—',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) =>
        row.original.payment_status === 'unpaid' ? (
          <button
            onClick={() => handlePaySalary(row.original.id)}
            className="flex items-center gap-1 rounded-lg bg-green-50 px-2 py-1 text-xs font-semibold text-green-600 hover:bg-green-100"
          >
            <Check className="h-3.5 w-3.5" /> Mark Paid
          </button>
        ) : (
          <span className="text-xs text-slate-400">Processed</span>
        ),
    },
  ]

  const handlePaySalary = async (id: string) => {
    try {
      await paySalaryMutation.mutateAsync(id)
      toast.success('Payout marked as paid')
    } catch {
      toast.error('Failed to mark payroll payment')
    }
  }

  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!configValues.staff_id) {
      toast.error('Please select staff member')
      return
    }
    try {
      await saveStructureMutation.mutateAsync(configValues)
      toast.success('Salary rules saved successfully')
      setIsConfigModalOpen(false)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save salary configuration')
    }
  }

  const handleGeneratePayroll = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await generatePayrollMutation.mutateAsync(genValues)
      toast.success(`Generated payout entries for ${res.generated_records} staff members`)
      setIsGenerateModalOpen(false)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to generate payroll')
    }
  }

  return (
    <PageWrapper
      title="Payroll & Salary"
      description="Manage employee payouts, generate monthly salaries, and customize allowances/deductions."
      actions={
        <div className="flex gap-3">
          <button
            onClick={() => {
              setConfigValues({ staff_id: '', base_salary: 0, allowances: 0, deductions: 0 })
              setIsConfigModalOpen(true)
            }}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700"
          >
            <Settings className="h-4 w-4" /> Config Salary Rules
          </button>
          <button
            onClick={() => setIsGenerateModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <Coins className="h-4 w-4" /> Run Monthly Payrun
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('payrun')}
            className={`border-b-2 px-6 py-3 text-sm font-semibold ${
              activeTab === 'payrun'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Monthly Payrun
          </button>
          <button
            onClick={() => setActiveTab('structures')}
            className={`border-b-2 px-6 py-3 text-sm font-semibold ${
              activeTab === 'structures'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Configure Salaries
          </button>
        </div>

        {activeTab === 'payrun' ? (
          <div className="space-y-4">
            {/* Filter */}
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:w-1/2">
              <FormField label="Month">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {MONTHS.map((m) => (
                    <option key={m.val} value={m.val}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Year">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </FormField>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <DataTable
                columns={payrollColumns}
                data={payrolls || []}
                isLoading={isPayrollsLoading}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <DataTable
              columns={structuresColumns}
              data={structures || []}
              isLoading={isStructuresLoading}
            />
          </div>
        )}
      </div>

      {/* Save salary config modal */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title="Configure Staff Salary Structure"
      >
        <form onSubmit={handleSaveStructure} className="space-y-4">
          <FormField label="Staff Member" required>
            <select
              value={configValues.staff_id}
              onChange={(e) => setConfigValues({ ...configValues, staff_id: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              disabled={!!configValues.staff_id} // Disable if updating existing
            >
              <option value="">Select Employee</option>
              {staffList?.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} ({s.employee_id})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Base Monthly Salary (₹)" required>
            <input
              type="number"
              required
              value={configValues.base_salary}
              onChange={(e) => setConfigValues({ ...configValues, base_salary: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Allowances (₹)">
              <input
                type="number"
                value={configValues.allowances}
                onChange={(e) => setConfigValues({ ...configValues, allowances: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </FormField>
            <FormField label="Deductions (₹)">
              <input
                type="number"
                value={configValues.deductions}
                onChange={(e) => setConfigValues({ ...configValues, deductions: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsConfigModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Save Salary Config
            </button>
          </div>
        </form>
      </Modal>

      {/* Generate monthly payroll modal */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="Run Monthly Payrun"
      >
        <form onSubmit={handleGeneratePayroll} className="space-y-4">
          <p className="text-xs text-slate-500">
            This will auto-generate monthly payouts for all staff profiles who have an active salary structure configured.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Month" required>
              <select
                value={genValues.month}
                onChange={(e) => setGenValues({ ...genValues, month: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {MONTHS.map(m => <option key={m.val} value={m.val}>{m.name}</option>)}
              </select>
            </FormField>
            <FormField label="Year" required>
              <select
                value={genValues.year}
                onChange={(e) => setGenValues({ ...genValues, year: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </FormField>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsGenerateModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Generate Payouts
            </button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  )
}
