import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, CreditCard, Receipt, FileDown, Download, AlertCircle, Layers, CheckCircle2, ShieldAlert, Sparkles, Filter } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { FormField } from '@/components/shared/FormField'
import { Modal } from '@/components/shared/Modal'
import { DataTable } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/shared/StatCard'
import { useAuthStore } from '@/store'
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
  useFeeInvoices,
  useGenerateBulkInvoices,
  useMyFeeDues,
  useOutstandingReport,
} from '@/api/hooks'
import { API_URL } from '@/api/client'

type FeesTab = 'invoices' | 'structures' | 'transactions' | 'reports'

export function FeesPage() {
  const role = useAuthStore((s) => s.user?.role)
  const isParentOrStudent = role === 'student' || role === 'parent'

  const [activeTab, setActiveTab] = useState<FeesTab>('invoices')

  // Modals state
  const [isAddStructureOpen, setIsAddStructureOpen] = useState(false)
  const [isBulkInvoiceOpen, setIsBulkInvoiceOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)

  // Academic Year
  const { data: academicYears } = useAcademicYears()
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')

  if (!selectedAcademicYear && academicYears && academicYears.length > 0) {
    const current = academicYears.find((y) => y.is_current)
    setSelectedAcademicYear(current ? current.id : academicYears[0].id)
  }

  // Filters
  const [filterClass, setFilterClass] = useState('')
  const [filterSection, setFilterSection] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const { data: classes } = useClasses(selectedAcademicYear || undefined)
  const { data: sections } = useSections(filterClass || undefined)

  // API Data Hooks
  const { data: structures, isLoading: isStructuresLoading } = useFeeStructures(selectedAcademicYear || undefined)
  const { data: invoices, isLoading: isInvoicesLoading } = useFeeInvoices(filterClass || undefined, filterSection || undefined, filterStatus || undefined)
  const { data: payments, isLoading: isPaymentsLoading } = useFeePayments()
  const { data: reportData, isLoading: isReportLoading } = useOutstandingReport(filterClass || undefined, filterSection || undefined)
  const { data: myDues, isLoading: isMyDuesLoading } = useMyFeeDues()
  const { data: studentsData } = useStudents(1, '', '', selectedAcademicYear)
  const students = studentsData?.data || []

  // Mutations
  const createStructureMutation = useCreateFeeStructure()
  const generateBulkInvoicesMutation = useGenerateBulkInvoices()
  const createPaymentMutation = useCreateFeePayment()
  const uploadReceiptMutation = useUploadFeeReceipt()

  // Form States
  const [structureForm, setStructureForm] = useState({
    class_id: '',
    name: '',
    fee_head: 'Tuition Fee',
    amount: 5000,
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    frequency: 'monthly',
    is_mandatory: true,
  })

  const [bulkInvoiceForm, setBulkInvoiceForm] = useState({
    fee_structure_id: '',
    class_id: '',
    section_id: '',
    due_date: '',
  })

  const [paymentForm, setPaymentForm] = useState({
    student_id: '',
    fee_structure_id: '',
    invoice_id: '',
    amount_paid: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    transaction_reference: '',
    receipt_number: '',
    paid_by: '',
  })

  const handleCreateStructure = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createStructureMutation.mutateAsync({
        academic_year_id: selectedAcademicYear,
        class_id: structureForm.class_id || undefined,
        name: structureForm.name,
        fee_head: structureForm.fee_head,
        amount: Number(structureForm.amount),
        due_date: structureForm.due_date || undefined,
        frequency: structureForm.frequency,
        is_mandatory: structureForm.is_mandatory,
      })
      toast.success('Fee structure category created!')
      setIsAddStructureOpen(false)
      setStructureForm({
        class_id: '',
        name: '',
        fee_head: 'Tuition Fee',
        amount: 5000,
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        frequency: 'monthly',
        is_mandatory: true,
      })
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create fee structure')
    }
  }

  const handleGenerateBulkInvoices = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bulkInvoiceForm.fee_structure_id || !bulkInvoiceForm.class_id) {
      toast.error('Please select both a fee structure and a target class.')
      return
    }
    try {
      const res = await generateBulkInvoicesMutation.mutateAsync({
        fee_structure_id: bulkInvoiceForm.fee_structure_id,
        class_id: bulkInvoiceForm.class_id,
        section_id: bulkInvoiceForm.section_id || undefined,
        due_date: bulkInvoiceForm.due_date || undefined,
      })
      toast.success(res.message || 'Invoices generated successfully!')
      setIsBulkInvoiceOpen(false)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to generate bulk invoices')
    }
  }

  const handleOpenPaymentForInvoice = (inv: any) => {
    setSelectedInvoice(inv)
    const pending = inv.pending_amount || (inv.amount_due - inv.amount_paid)
    const rand = Math.floor(100000 + Math.random() * 900000)
    setPaymentForm({
      student_id: inv.student_id,
      fee_structure_id: inv.fee_structure_id || '',
      invoice_id: inv.id,
      amount_paid: pending > 0 ? pending : inv.amount_due,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'cash',
      transaction_reference: '',
      receipt_number: `REC-${new Date().getFullYear()}-${rand}`,
      paid_by: '',
    })
    setIsPaymentModalOpen(true)
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (paymentForm.amount_paid <= 0) {
      toast.error('Payment amount must be greater than zero.')
      return
    }
    try {
      const res = await createPaymentMutation.mutateAsync({
        student_id: paymentForm.student_id || undefined,
        fee_structure_id: paymentForm.fee_structure_id || undefined,
        invoice_id: paymentForm.invoice_id || undefined,
        amount_paid: Number(paymentForm.amount_paid),
        payment_date: paymentForm.payment_date,
        payment_method: paymentForm.payment_method,
        transaction_reference: paymentForm.transaction_reference || undefined,
        receipt_number: paymentForm.receipt_number || undefined,
        paid_by: paymentForm.paid_by || undefined,
      })
      toast.success(res?.message || 'Fee payment recorded successfully!')
      setIsPaymentModalOpen(false)
      setSelectedInvoice(null)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to record payment transaction')
    }
  }

  const handleDownloadReceipt = (paymentId: string) => {
    const url = `${API_URL}/api/v1/fees/payments/${paymentId}/receipt`
    window.open(url, '_blank')
  }

  // Parent / Student Portal View
  if (isParentOrStudent) {
    return (
      <PageWrapper title="My Fee Statements & Payments" description="View tuition dues, billing history, and official fee receipts.">
        {isMyDuesLoading ? (
          <div className="flex h-48 items-center justify-center text-sm text-slate-400">Loading fee records...</div>
        ) : (
          <div className="space-y-6">
            {/* Overview Stat Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Total Mandated Fees" value={`₹${myDues?.total_due || 0}`} subtext="Assigned for Academic Year" icon={<Receipt className="h-5 w-5" />} />
              <StatCard label="Total Paid Amount" value={`₹${myDues?.total_paid || 0}`} subtext="Verified Payments" icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} color="bg-emerald-600" />
              <StatCard
                label="Net Outstanding Balance"
                value={`₹${myDues?.outstanding_balance || 0}`}
                subtext={myDues?.outstanding_balance > 0 ? 'Payment Due' : 'All Dues Cleared'}
                icon={<ShieldAlert className="h-5 w-5 text-rose-500" />}
                color={myDues?.outstanding_balance > 0 ? 'bg-rose-600' : 'bg-slate-700'}
              />
            </div>

            {/* Active Fee Invoices */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Active Fee Invoices</h3>
              <DataTable
                columns={[
                  { accessorKey: 'invoice_number', header: 'Invoice #', cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.invoice_number}</span> },
                  { accessorKey: 'title', header: 'Fee Category / Item' },
                  { accessorKey: 'amount_due', header: 'Amount Due', cell: ({ row }) => <span className="font-semibold">₹{row.original.amount_due}</span> },
                  { accessorKey: 'amount_paid', header: 'Amount Paid', cell: ({ row }) => <span className="text-emerald-600 font-medium">₹{row.original.amount_paid}</span> },
                  { accessorKey: 'pending_amount', header: 'Pending Dues', cell: ({ row }) => <span className="font-bold text-rose-600">₹{row.original.pending_amount}</span> },
                  { accessorKey: 'due_date', header: 'Due Date' },
                  {
                    accessorKey: 'status',
                    header: 'Status',
                    cell: ({ row }) => {
                      const s = row.original.status
                      const variant = s === 'paid' ? 'success' : s === 'partial' ? 'warning' : 'danger'
                      return <Badge variant={variant} className="capitalize">{s}</Badge>
                    },
                  },
                ]}
                data={myDues?.invoices || []}
                rowActions={(row) =>
                  row.status !== 'paid' ? (
                    <button
                      onClick={() => handleOpenPaymentForInvoice(row)}
                      className="flex items-center gap-1 rounded bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      Pay Online
                    </button>
                  ) : null
                }
              />
            </div>

            {/* Payment History */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Payment Receipt Register</h3>
              <DataTable
                columns={[
                  { accessorKey: 'receipt_number', header: 'Receipt No', cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.receipt_number}</span> },
                  { accessorKey: 'amount_paid', header: 'Paid Amount', cell: ({ row }) => <span className="font-semibold text-emerald-600">₹{row.original.amount_paid}</span> },
                  { accessorKey: 'payment_date', header: 'Date' },
                  { accessorKey: 'payment_method', header: 'Method', cell: ({ row }) => <span className="capitalize">{row.original.payment_method}</span> },
                  { accessorKey: 'transaction_reference', header: 'Ref ID', cell: ({ row }) => <span className="font-mono text-xs">{row.original.transaction_reference || '—'}</span> },
                ]}
                data={myDues?.payments || []}
                rowActions={(row: any) => (
                  <button
                    onClick={() => handleDownloadReceipt(row.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-accent hover:underline font-medium"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download PDF
                  </button>
                )}
              />
            </div>
          </div>
        )}

        {/* Online Payment Modal for Student / Parent */}
        {isPaymentModalOpen && selectedInvoice && (
          <Modal isOpen={true} onClose={() => setIsPaymentModalOpen(false)} title={`Pay Fee Invoice: ${selectedInvoice.invoice_number}`}>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800 text-xs space-y-1">
                <p><strong>Item:</strong> {selectedInvoice.title}</p>
                <p><strong>Amount Due:</strong> ₹{selectedInvoice.amount_due} | <strong>Already Paid:</strong> ₹{selectedInvoice.amount_paid}</p>
                <p><strong>Remaining Dues:</strong> ₹{selectedInvoice.pending_amount}</p>
              </div>

              <FormField label="Payment Amount (INR)" required>
                <input
                  type="number"
                  value={paymentForm.amount_paid}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount_paid: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>

              <FormField label="Payment Method" required>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                >
                  <option value="online">Online Payment (Razorpay / UPI / NetBanking)</option>
                  <option value="cash">Cash Payment at Counter</option>
                  <option value="cheque">Bank Cheque / DD</option>
                </select>
              </FormField>

              {paymentForm.payment_method !== 'cash' && (
                <FormField label="Transaction Ref / UTR Number">
                  <input
                    type="text"
                    value={paymentForm.transaction_reference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, transaction_reference: e.target.value })}
                    placeholder="e.g. UPI/2026/987123"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </FormField>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={createPaymentMutation.isPending} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  Confirm Payment
                </button>
              </div>
            </form>
          </Modal>
        )}
      </PageWrapper>
    )
  }

  // Admin / Accountant Management Portal View
  return (
    <PageWrapper
      title="Fees & Financial Accounts"
      description="Manage fee structures, class invoice generation, collection registers, and dues reports."
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => setIsAddStructureOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <Plus className="h-4 w-4" />
            Create Fee Category
          </button>
          <button
            onClick={() => setIsBulkInvoiceOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Layers className="h-4 w-4" />
            Generate Bulk Invoices
          </button>
        </div>
      }
    >
      {/* Tabs Selector */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-[2px] ${
            activeTab === 'invoices' ? 'border-accent text-accent' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Fee Invoices & Dues
        </button>
        <button
          onClick={() => setActiveTab('structures')}
          className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-[2px] ${
            activeTab === 'structures' ? 'border-accent text-accent' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Fee Structures
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-[2px] ${
            activeTab === 'transactions' ? 'border-accent text-accent' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Payment Transactions
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-[2px] ${
            activeTab === 'reports' ? 'border-accent text-accent' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Outstanding Dues Report
        </button>
      </div>

      {/* Class / Section / Status Filter Toolbar */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
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

        <FormField label="Payment Status">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">All Statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </FormField>
      </div>

      {/* Tab 1: Invoices */}
      {activeTab === 'invoices' && (
        <DataTable
          columns={[
            { accessorKey: 'invoice_number', header: 'Invoice #', cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.invoice_number}</span> },
            { accessorKey: 'student_name', header: 'Student Name', cell: ({ row }) => <span className="font-semibold">{row.original.student_name}</span> },
            { accessorKey: 'admission_number', header: 'Admission ID', cell: ({ row }) => <span className="font-mono text-xs">{row.original.admission_number}</span> },
            { accessorKey: 'class_name', header: 'Class / Sec', cell: ({ row }) => <span>{row.original.class_name} - {row.original.section_name}</span> },
            { accessorKey: 'title', header: 'Fee Item' },
            { accessorKey: 'amount_due', header: 'Amount Due', cell: ({ row }) => <span className="font-medium">₹{row.original.amount_due}</span> },
            { accessorKey: 'amount_paid', header: 'Paid', cell: ({ row }) => <span className="text-emerald-600 font-medium">₹{row.original.amount_paid}</span> },
            { accessorKey: 'pending_amount', header: 'Pending', cell: ({ row }) => <span className="font-bold text-rose-600">₹{row.original.pending_amount}</span> },
            { accessorKey: 'due_date', header: 'Due Date' },
            {
              accessorKey: 'status',
              header: 'Status',
              cell: ({ row }) => {
                const s = row.original.status
                const variant = s === 'paid' ? 'success' : s === 'partial' ? 'warning' : 'danger'
                return <Badge variant={variant} className="capitalize">{s}</Badge>
              },
            },
          ]}
          data={invoices || []}
          isLoading={isInvoicesLoading}
          rowActions={(row) =>
            row.status !== 'paid' ? (
              <button
                onClick={() => handleOpenPaymentForInvoice(row)}
                className="flex items-center gap-1 rounded bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Record Payment
              </button>
            ) : null
          }
        />
      )}

      {/* Tab 2: Structures */}
      {activeTab === 'structures' && (
        <DataTable
          columns={[
            { accessorKey: 'name', header: 'Category Name', cell: ({ row }) => <span className="font-semibold">{row.original.name}</span> },
            { accessorKey: 'fee_head', header: 'Fee Head' },
            { accessorKey: 'amount', header: 'Amount', cell: ({ row }) => <span>₹{row.original.amount}</span> },
            { accessorKey: 'frequency', header: 'Frequency', cell: ({ row }) => <span className="capitalize">{row.original.frequency}</span> },
            { accessorKey: 'due_date', header: 'Default Due Date', cell: ({ row }) => <span>{row.original.due_date || '—'}</span> },
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

      {/* Tab 3: Transactions */}
      {activeTab === 'transactions' && (
        <DataTable
          columns={[
            { accessorKey: 'receipt_number', header: 'Receipt No', cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.receipt_number}</span> },
            { accessorKey: 'student_name', header: 'Student Name' },
            { accessorKey: 'admission_number', header: 'Admission ID', cell: ({ row }) => <span className="font-mono text-xs text-slate-500">{row.original.admission_number}</span> },
            { accessorKey: 'fee_category', header: 'Category' },
            { accessorKey: 'amount_paid', header: 'Amount Paid', cell: ({ row }) => <span className="font-semibold text-slate-900 dark:text-white">₹{row.original.amount_paid}</span> },
            { accessorKey: 'payment_date', header: 'Payment Date' },
            { accessorKey: 'payment_method', header: 'Method', cell: ({ row }) => <span className="capitalize">{row.original.payment_method}</span> },
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

      {/* Tab 4: Dues Report */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total Expected Fees" value={`₹${reportData?.total_expected || 0}`} subtext="Assigned Invoices Sum" icon={<Receipt className="h-5 w-5" />} />
            <StatCard label="Total Collected Fees" value={`₹${reportData?.total_collected || 0}`} subtext="Realized Revenue" icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} color="bg-emerald-600" />
            <StatCard label="Total Outstanding Dues" value={`₹${reportData?.total_outstanding || 0}`} subtext="Uncollected Balance" icon={<ShieldAlert className="h-5 w-5 text-rose-500" />} color="bg-rose-600" />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Dues Summary by Student</h3>
            <DataTable
              columns={[
                { accessorKey: 'invoice_number', header: 'Invoice #' },
                { accessorKey: 'student_name', header: 'Student' },
                { accessorKey: 'class_name', header: 'Class / Sec', cell: ({ row }) => <span>{row.original.class_name} - {row.original.section_name}</span> },
                { accessorKey: 'amount_due', header: 'Amount Due', cell: ({ row }) => <span>₹{row.original.amount_due}</span> },
                { accessorKey: 'amount_paid', header: 'Paid', cell: ({ row }) => <span className="text-emerald-600">₹{row.original.amount_paid}</span> },
                { accessorKey: 'pending_amount', header: 'Outstanding', cell: ({ row }) => <span className="font-bold text-rose-600">₹{row.original.pending_amount}</span> },
                { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={row.original.status === 'paid' ? 'success' : 'danger'} className="capitalize">{row.original.status}</Badge> },
              ]}
              data={invoices || []}
              isLoading={isInvoicesLoading}
            />
          </div>
        </div>
      )}

      {/* Create Fee Structure Modal */}
      {isAddStructureOpen && (
        <Modal isOpen={true} onClose={() => setIsAddStructureOpen(false)} title="Create Fee Structure Category">
          <form onSubmit={handleCreateStructure} className="space-y-4">
            <FormField label="Category Name" required>
              <input
                type="text"
                value={structureForm.name}
                onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })}
                placeholder="e.g. Term 1 Tuition Fee"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Fee Head" required>
                <select
                  value={structureForm.fee_head}
                  onChange={(e) => setStructureForm({ ...structureForm, fee_head: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                >
                  <option value="Tuition Fee">Tuition Fee</option>
                  <option value="Transport Fee">Transport Fee</option>
                  <option value="Exam Fee">Exam Fee</option>
                  <option value="Admission Fee">Admission Fee</option>
                  <option value="Annual Charges">Annual Charges</option>
                </select>
              </FormField>

              <FormField label="Target Class (Optional)">
                <select
                  value={structureForm.class_id}
                  onChange={(e) => setStructureForm({ ...structureForm, class_id: e.target.value })}
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
            </div>

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
              <FormField label="Default Due Date">
                <input
                  type="date"
                  value={structureForm.due_date}
                  onChange={(e) => setStructureForm({ ...structureForm, due_date: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setIsAddStructureOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={createStructureMutation.isPending} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Create Category
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Bulk Generate Invoices Modal */}
      {isBulkInvoiceOpen && (
        <Modal isOpen={true} onClose={() => setIsBulkInvoiceOpen(false)} title="Generate Bulk Invoices for Class">
          <form onSubmit={handleGenerateBulkInvoices} className="space-y-4">
            <FormField label="Select Fee Category / Structure" required>
              <select
                value={bulkInvoiceForm.fee_structure_id}
                onChange={(e) => setBulkInvoiceForm({ ...bulkInvoiceForm, fee_structure_id: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              >
                <option value="">Select Category...</option>
                {structures?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (₹{s.amount}) - {s.fee_head}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Target Class" required>
              <select
                value={bulkInvoiceForm.class_id}
                onChange={(e) => setBulkInvoiceForm({ ...bulkInvoiceForm, class_id: e.target.value, section_id: '' })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              >
                <option value="">Select Class...</option>
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Target Section (Optional)">
              <select
                value={bulkInvoiceForm.section_id}
                onChange={(e) => setBulkInvoiceForm({ ...bulkInvoiceForm, section_id: e.target.value })}
                disabled={!bulkInvoiceForm.class_id}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 disabled:opacity-50"
              >
                <option value="">All Sections in Class</option>
                {sections?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Custom Due Date (Optional)">
              <input
                type="date"
                value={bulkInvoiceForm.due_date}
                onChange={(e) => setBulkInvoiceForm({ ...bulkInvoiceForm, due_date: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </FormField>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setIsBulkInvoiceOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" disabled={generateBulkInvoicesMutation.isPending} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Generate Invoices
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Record Payment Modal for Admin */}
      {isPaymentModalOpen && selectedInvoice && (
        <Modal isOpen={true} onClose={() => setIsPaymentModalOpen(false)} title={`Record Payment: ${selectedInvoice.invoice_number}`}>
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800 text-xs space-y-1">
              <p><strong>Student:</strong> {selectedInvoice.student_name} ({selectedInvoice.admission_number})</p>
              <p><strong>Item:</strong> {selectedInvoice.title}</p>
              <p><strong>Amount Due:</strong> ₹{selectedInvoice.amount_due} | <strong>Already Paid:</strong> ₹{selectedInvoice.amount_paid}</p>
              <p className="text-rose-600 font-bold"><strong>Remaining Balance:</strong> ₹{selectedInvoice.pending_amount}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Amount Received (INR)" required>
                <input
                  type="number"
                  value={paymentForm.amount_paid}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount_paid: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>

              <FormField label="Payment Method" required>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                >
                  <option value="cash">Cash</option>
                  <option value="online">Online / UPI</option>
                  <option value="cheque">Cheque / DD</option>
                </select>
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Receipt Number" required>
                <input
                  type="text"
                  value={paymentForm.receipt_number}
                  onChange={(e) => setPaymentForm({ ...paymentForm, receipt_number: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>

              <FormField label="Transaction / UTR Reference">
                <input
                  type="text"
                  value={paymentForm.transaction_reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transaction_reference: e.target.value })}
                  placeholder="e.g. CHQ-99120 / UPI-8821"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" disabled={createPaymentMutation.isPending} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Log Payment
              </button>
            </div>
          </form>
        </Modal>
      )}
    </PageWrapper>
  )
}
