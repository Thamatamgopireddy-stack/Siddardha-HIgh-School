import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, CreditCard, Receipt, FileDown, Download, AlertCircle } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { FormField } from '@/components/shared/FormField'
import { Modal } from '@/components/shared/Modal'
import { DataTable } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/Badge'
import {
  useAcademicYears,
  useFeeStructures,
  useCreateFeeStructure,
  useFeePayments,
  useCreateFeePayment,
  useUploadFeeReceipt,
  useStudents,
  useClasses,
  useSections,
  useStudentFeeBalances,
} from '@/api/hooks'
import { API_URL } from '@/api/client'


type FeesTab = 'transactions' | 'structures' | 'balances'

export function FeesPage() {
  const [activeTab, setActiveTab] = useState<FeesTab>('transactions')
  
  // Modals state
  const [isAddStructureOpen, setIsAddStructureOpen] = useState(false)
  const [isLogPaymentOpen, setIsLogPaymentOpen] = useState(false)

  // API Hooks
  const { data: academicYears } = useAcademicYears()
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')

  // Initialize selected Academic Year
  if (!selectedAcademicYear && academicYears && academicYears.length > 0) {
    const current = academicYears.find((y) => y.is_current)
    setSelectedAcademicYear(current ? current.id : academicYears[0].id)
  }

  const { data: structures, isLoading: isStructuresLoading } = useFeeStructures(selectedAcademicYear || undefined)
  const { data: payments, isLoading: isPaymentsLoading } = useFeePayments()
  const { data: studentsData } = useStudents(1, '', '', selectedAcademicYear)
  const students = studentsData?.data || []

  // Filters for balances tab
  const [filterClass, setFilterClass] = useState('')
  const [filterSection, setFilterSection] = useState('')

  // Hooks for filters
  const { data: classes } = useClasses(selectedAcademicYear || undefined)
  const { data: sections } = useSections(filterClass || undefined)
  const { data: balances, isLoading: isBalancesLoading } = useStudentFeeBalances(
    filterClass || undefined,
    filterSection || undefined
  )

  const createStructureMutation = useCreateFeeStructure()
  const createPaymentMutation = useCreateFeePayment()
  const uploadReceiptMutation = useUploadFeeReceipt()

  // Form states
  const [structureForm, setStructureForm] = useState({
    name: '',
    amount: 1000,
    frequency: 'monthly',
    is_mandatory: true,
  })

  const [paymentForm, setPaymentForm] = useState({
    student_id: '',
    fee_structure_id: '',
    amount_paid: 1000,
    payment_date: new Date().toISOString().split('T')[0],
    receipt_number: '',
  })
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  const handleCreateStructure = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createStructureMutation.mutateAsync({
        academic_year_id: selectedAcademicYear,
        ...structureForm,
      })
      toast.success('Fee structure created successfully!')
      setIsAddStructureOpen(false)
      setStructureForm({ name: '', amount: 1000, frequency: 'monthly', is_mandatory: true })
    } catch {
      toast.error('Failed to create fee structure')
    }
  }

  const handleLogPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createPaymentMutation.mutateAsync({
        ...paymentForm,
        amount_paid: Number(paymentForm.amount_paid),
      })
      toast.success('Fee payment transaction logged successfully!')
      setIsLogPaymentOpen(false)
      setPaymentForm({
        student_id: '',
        fee_structure_id: '',
        amount_paid: 1000,
        payment_date: new Date().toISOString().split('T')[0],
        receipt_number: '',
      })
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to record payment transaction')
    }
  }

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const res = await uploadReceiptMutation.mutateAsync({
        file,
        studentId: paymentForm.student_id || undefined,
        feeStructureId: paymentForm.fee_structure_id || undefined,
      })
      toast.success(res?.message || 'Receipt processed successfully')
      setReceiptFile(file)
      setPaymentForm((prev) => ({
        ...prev,
        amount_paid: Number(res?.amount_paid || prev.amount_paid),
        receipt_number: res?.receipt_number || prev.receipt_number,
      }))
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Receipt upload failed')
    }
  }

  const handleDownloadReceipt = (paymentId: string) => {
    const url = `${API_URL}/api/v1/fees/payments/${paymentId}/receipt`
    window.open(url, '_blank')
  }

  return (
    <PageWrapper
      title="Fees & Accounts"
      description="Manage tuition fee schedules, collection registers, and ledgers."
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => setIsAddStructureOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            Create Category
          </button>
          <button
            onClick={() => {
              // Generate simple receipt number
              const rand = Math.floor(100000 + Math.random() * 900000)
              setPaymentForm((prev) => ({ ...prev, receipt_number: `REC-${new Date().getFullYear()}-${rand}` }))
              setIsLogPaymentOpen(true)
            }}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <CreditCard className="h-4 w-4" />
            Log Fee Payment
          </button>
        </div>
      }
    >
      {/* Tabs Selector */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-[2px] ${
            activeTab === 'transactions'
              ? 'border-accent text-accent'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Transaction History
        </button>
        <button
          onClick={() => setActiveTab('structures')}
          className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-[2px] ${
            activeTab === 'structures'
              ? 'border-accent text-accent'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Fee Structures
        </button>
        <button
          onClick={() => setActiveTab('balances')}
          className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-[2px] ${
            activeTab === 'balances'
              ? 'border-accent text-accent'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Student Fee Balances
        </button>
      </div>

      {activeTab === 'transactions' && (
        <DataTable
          columns={[
            { accessorKey: 'receipt_number', header: 'Receipt No', cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.receipt_number}</span> },
            { accessorKey: 'student_name', header: 'Student Name' },
            { accessorKey: 'admission_number', header: 'Admission ID', cell: ({ row }) => <span className="font-mono text-xs text-slate-500">{row.original.admission_number}</span> },
            { accessorKey: 'fee_category', header: 'Category' },
            { accessorKey: 'amount_paid', header: 'Amount Paid', cell: ({ row }) => <span className="font-semibold text-slate-900 dark:text-white">₹{row.original.amount_paid}</span> },
            { accessorKey: 'payment_date', header: 'Payment Date' },
          ]}
          data={payments || []}
          isLoading={isPaymentsLoading}
          rowActions={(row) => (
            <button
              onClick={() => handleDownloadReceipt(row.id)}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Download className="h-4 w-4 text-slate-500" />
              Download Receipt
            </button>
          )}
        />
      )}

      {activeTab === 'structures' && (
        <DataTable
          columns={[
            { accessorKey: 'name', header: 'Structure Name', cell: ({ row }) => <span className="font-semibold text-slate-900 dark:text-white">{row.original.name}</span> },
            { accessorKey: 'amount', header: 'Amount', cell: ({ row }) => <span>₹{row.original.amount}</span> },
            { accessorKey: 'frequency', header: 'Frequency', cell: ({ row }) => <span className="capitalize">{row.original.frequency}</span> },
            {
              accessorKey: 'is_mandatory',
              header: 'Requirement',
              cell: ({ row }) => (
                <Badge variant={row.original.is_mandatory ? 'danger' : 'neutral'}>
                  {row.original.is_mandatory ? 'Mandatory' : 'Optional'}
                </Badge>
              ),
            },
          ]}
          data={structures || []}
          isLoading={isStructuresLoading}
        />
      )}

      {activeTab === 'balances' && (
        <div className="space-y-6">
          {/* Class/Section Filters */}
          <div className="grid gap-4 sm:grid-cols-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <FormField label="Academic Year">
              <select
                value={selectedAcademicYear}
                onChange={(e) => {
                  setSelectedAcademicYear(e.target.value)
                  setFilterClass('')
                  setFilterSection('')
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {academicYears?.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name} {y.is_current ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Filter by Class">
              <select
                value={filterClass}
                onChange={(e) => {
                  setFilterClass(e.target.value)
                  setFilterSection('')
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">All Classes</option>
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Filter by Section">
              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                disabled={!filterClass}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 disabled:opacity-50"
              >
                <option value="">All Sections</option>
                {sections?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <DataTable
            columns={[
              { accessorKey: 'admission_number', header: 'Admission No', cell: ({ row }) => <span className="font-mono text-xs">{row.original.admission_number}</span> },
              { accessorKey: 'student_name', header: 'Student Name', cell: ({ row }) => <span className="font-semibold">{row.original.first_name} {row.original.last_name}</span> },
              { accessorKey: 'class_name', header: 'Class' },
              { accessorKey: 'section_name', header: 'Section' },
              { accessorKey: 'total_fee', header: 'Total Mandated Fee', cell: ({ row }) => <span className="font-medium">₹{row.original.total_fee}</span> },
              { accessorKey: 'total_paid', header: 'Paid Amount', cell: ({ row }) => <span className="font-semibold text-emerald-600">₹{row.original.total_paid}</span> },
              { 
                accessorKey: 'pending_fee', 
                header: 'Pending Balance', 
                cell: ({ row }) => (
                  <span className={`font-bold ${row.original.pending_fee > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    ₹{row.original.pending_fee}
                  </span>
                ) 
              },
            ]}
            data={balances || []}
            isLoading={isBalancesLoading}
          />
        </div>
      )}

      {/* Create Fee Structure Modal */}
      {isAddStructureOpen && (
        <Modal isOpen={true} onClose={() => setIsAddStructureOpen(false)} title="Create Fee Category">
          <form onSubmit={handleCreateStructure} className="space-y-4">
            <FormField label="Category Name" required>
              <input
                type="text"
                value={structureForm.name}
                onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })}
                placeholder="e.g. Admission Registration Fee"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Amount (INR)" required>
                <input
                  type="number"
                  value={structureForm.amount}
                  onChange={(e) => setStructureForm({ ...structureForm, amount: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
              <FormField label="Billing Frequency" required>
                <select
                  value={structureForm.frequency}
                  onChange={(e) => setStructureForm({ ...structureForm, frequency: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                  <option value="one_time">One-Time Fee</option>
                </select>
              </FormField>
            </div>

            <FormField label="Mandatory Fee?">
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  checked={structureForm.is_mandatory}
                  onChange={(e) => setStructureForm({ ...structureForm, is_mandatory: e.target.checked })}
                  className="rounded border-slate-300 text-accent focus:ring-accent"
                />
                <span className="text-xs text-slate-500">Require payment for all students enrolled.</span>
              </div>
            </FormField>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddStructureOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createStructureMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create Category
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Log Payment Modal */}
      {isLogPaymentOpen && (
        <Modal isOpen={true} onClose={() => setIsLogPaymentOpen(false)} title="Log Fee Payment Transaction">
          <form onSubmit={handleLogPayment} className="space-y-4">
            <FormField label="Receipt Number" required>
              <input
                type="text"
                value={paymentForm.receipt_number}
                onChange={(e) => setPaymentForm({ ...paymentForm, receipt_number: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </FormField>

            <FormField label="Select Enrolled Student" required>
              <select
                value={paymentForm.student_id}
                onChange={(e) => setPaymentForm({ ...paymentForm, student_id: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              >
                <option value="">Select Student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} ({s.admission_number})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Select Fee Category" required>
              <select
                value={paymentForm.fee_structure_id}
                onChange={(e) => setPaymentForm({ ...paymentForm, fee_structure_id: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              >
                <option value="">Select Structure...</option>
                {structures?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (₹{s.amount})
                  </option>
                ))}
              </select>
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Amount Paid (INR)" required>
                <input
                  type="number"
                  value={paymentForm.amount_paid}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount_paid: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
              <FormField label="Payment Date" required>
                <input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
            </div>

            <FormField label="Upload Fee Receipt (Image/PDF)">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleReceiptUpload}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              {receiptFile && <p className="mt-2 text-xs text-slate-500">Loaded: {receiptFile.name}</p>}
            </FormField>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsLogPaymentOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createPaymentMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Log Transaction
              </button>
            </div>
          </form>
        </Modal>
      )}
    </PageWrapper>
  )
}
