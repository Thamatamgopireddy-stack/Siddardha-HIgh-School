import { useState } from 'react'
import { toast } from 'sonner'
import { ColumnDef } from '@tanstack/react-table'
import { Upload, FileText, CheckCircle, GraduationCap, Phone, Calendar, UserPlus, Eye, Edit2, ShieldAlert, Sparkles } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { DataTable } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { FileUpload } from '@/components/shared/FileUpload'
import { FormField } from '@/components/shared/FormField'
import { Badge } from '@/components/ui/Badge'
import {
  useAdmissions,
  useAcademicYears,
  useClasses,
  useSections,
  useCreateAdmission,
  useUpdateAdmission,
  useOCROnDocument,
  useConvertAdmissionToStudent,
} from '@/api/hooks'

export function AdmissionsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')

  // Modals / forms state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingAdmission, setEditingAdmission] = useState<any | null>(null)
  const [isOCRLoading, setIsOCRLoading] = useState(false)
  
  // Convert Modal State
  const [convertCandidate, setConvertCandidate] = useState<any | null>(null)
  const [targetClass, setTargetClass] = useState('')
  const [targetSection, setTargetSection] = useState('')
  const [rollNumber, setRollNumber] = useState('')

  // API hooks
  const { data: academicYears } = useAcademicYears()
  const { data: classes } = useClasses(academicYears?.[0]?.id)
  const { data: sections } = useSections(targetClass)

  const { data: admissionsData, isLoading } = useAdmissions(page, search, selectedStatus)
  const createMutation = useCreateAdmission()
  const updateMutation = useUpdateAdmission(editingAdmission?.id || '')
  const ocrMutation = useOCROnDocument()
  const convertMutation = useConvertAdmissionToStudent(convertCandidate?.id || '')

  // Form fields
  const [formValues, setFormValues] = useState({
    applicant_name: '',
    date_of_birth: '',
    gender: 'male',
    phone: '',
    applying_for_class_id: '',
    academic_year_id: '',
  })

  const resetForm = () => {
    setFormValues({
      applicant_name: '',
      date_of_birth: '',
      gender: 'male',
      phone: '',
      applying_for_class_id: '',
      // academic_year_id will be set via useEffect when academicYears are loaded
      academic_year_id: '',
    })
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createMutation.mutateAsync({
        ...formValues,
        status: 'applied',
        application_date: new Date().toISOString().split('T')[0],
      })
      toast.success('Admission application submitted successfully')
      setIsAddOpen(false)
      resetForm()
    } catch {
      toast.error('Failed to submit application')
    }
  }

  const handleUpdateStatusSubmit = async (status: string) => {
    if (!editingAdmission) return
    try {
      await updateMutation.mutateAsync({ status })
      toast.success(`Application status updated to ${status}`)
      setEditingAdmission(null)
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handleOCRFile = async (files: File[]) => {
    if (files.length === 0) return
    setIsOCRLoading(true)
    try {
      const data = await ocrMutation.mutateAsync(files[0])
      toast.success('Document scanned and parsed using OCR')
      
      // Update form values with OCR extracted details
      setFormValues((prev) => ({
        ...prev,
        applicant_name: data.applicant_name || prev.applicant_name,
        date_of_birth: data.date_of_birth || prev.date_of_birth,
        gender: data.gender || prev.gender,
      }))
    } catch {
      toast.error('OCR document scanning failed')
    } finally {
      setIsOCRLoading(false)
    }
  }

  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!convertCandidate || !targetSection) return
    try {
      const res = await convertMutation.mutateAsync({
        section_id: targetSection,
        roll_number: rollNumber || undefined,
      })
      toast.success(`Candidate converted! Created Student Admission No: ${res.admission_number}`)
      setConvertCandidate(null)
      setTargetClass('')
      setTargetSection('')
      setRollNumber('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Conversion failed')
    }
  }

  const getStatusBadge = (status: string) => {
    const maps: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'purple'> = {
      applied: 'info',
      documents_pending: 'warning',
      under_review: 'purple',
      shortlisted: 'success',
      admitted: 'success',
      rejected: 'danger',
      waitlisted: 'neutral',
    }
    return <Badge variant={maps[status] || 'neutral'}>{status.replace('_', ' ')}</Badge>
  }

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'applicant_name',
      header: 'Applicant Name',
      cell: ({ row }) => <span className="font-semibold text-slate-800 dark:text-slate-200">{row.original.applicant_name}</span>,
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
    },
    {
      accessorKey: 'date_of_birth',
      header: 'DOB',
    },
    {
      accessorKey: 'gender',
      header: 'Gender',
      cell: ({ row }) => <span className="capitalize">{row.original.gender}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      accessorKey: 'application_date',
      header: 'Applied On',
    },
  ]

  return (
    <PageWrapper
      title="Admissions"
      description="Manage student admission enquiries and formal applications."
      actions={
        <button
          onClick={() => {
            resetForm()
            setIsAddOpen(true)
          }}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <UserPlus className="h-4 w-4" />
          Add Application
        </button>
      }
    >
      {/* Search and Filters */}
      <div className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex-1">
          <input
            type="search"
            placeholder="Search by candidate name or contact phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div className="w-48">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">All Statuses</option>
            <option value="applied">Applied</option>
            <option value="documents_pending">Docs Pending</option>
            <option value="under_review">Under Review</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="admitted">Admitted</option>
            <option value="rejected">Rejected</option>
            <option value="waitlisted">Waitlisted</option>
          </select>
        </div>
      </div>

      {/* Grid List DataTable */}
      <DataTable
        columns={columns}
        data={admissionsData?.data || []}
        isLoading={isLoading}
        pagination={
          admissionsData?.meta
            ? {
                page,
                limit: 20,
                total: admissionsData.meta.total || 0,
              }
            : undefined
        }
        onPageChange={(p) => setPage(p)}
        rowActions={(row) => (
          <div className="space-y-0.5">
            <button
              onClick={() => setEditingAdmission(row)}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Edit2 className="h-4 w-4 text-slate-500" />
              Review Status
            </button>
            {row.status === 'shortlisted' && (
              <button
                onClick={() => {
                  setConvertCandidate(row)
                  setTargetClass(row.applying_for_class_id)
                }}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs text-accent hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <GraduationCap className="h-4 w-4" />
                Convert to Student
              </button>
            )}
          </div>
        )}
      />

      {/* Add application uploader Modal */}
      {isAddOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddOpen(false)}
          title="New Admission Application"
          size="lg"
        >
          <div className="mb-6 rounded-xl border border-dashed border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-300">
              <Sparkles className="h-4 w-4" />
              OCR Document Auto-Fill
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Upload the applicant's Birth Certificate or ID. The Google Vision API OCR parser will auto-fill fields.
            </p>
            <div className="mt-3.5">
              <FileUpload
                accept=".jpg,.jpeg,.png,.pdf"
                maxSize={5}
                onUpload={handleOCRFile}
              />
              {isOCRLoading && (
                <div className="mt-2 text-xs font-medium text-slate-500 animate-pulse flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
                  Running Google OCR Parser...
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <FormField label="Applicant Name" required>
              <input
                type="text"
                value={formValues.applicant_name}
                onChange={(e) => setFormValues({ ...formValues, applicant_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Date of Birth" required>
                <input
                  type="date"
                  value={formValues.date_of_birth}
                  onChange={(e) => setFormValues({ ...formValues, date_of_birth: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
              <FormField label="Gender" required>
                <select
                  value={formValues.gender}
                  onChange={(e) => setFormValues({ ...formValues, gender: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </FormField>
              <FormField label="Contact Phone" required>
                <input
                  type="tel"
                  value={formValues.phone}
                  onChange={(e) => setFormValues({ ...formValues, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
              <FormField label="Target Class" required>
                <select
                  value={formValues.applying_for_class_id}
                  onChange={(e) => setFormValues({ ...formValues, applying_for_class_id: e.target.value })}
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
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Submit Application
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Review Status Modal */}
      {editingAdmission && (
        <Modal
          isOpen={true}
          onClose={() => setEditingAdmission(null)}
          title="Review Application Status"
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
              <h5 className="font-semibold text-slate-900 dark:text-white">{editingAdmission.applicant_name}</h5>
              <p className="mt-1 text-xs text-slate-500">Contact: {editingAdmission.phone}</p>
              <p className="mt-0.5 text-xs text-slate-500">Applying for class ID: {editingAdmission.applying_for_class_id}</p>
            </div>

            <h6 className="font-semibold text-slate-700 dark:text-slate-300">Set Evaluation Decision:</h6>
            <div className="grid gap-2">
              {['applied', 'documents_pending', 'under_review', 'shortlisted', 'rejected', 'waitlisted'].map((status) => (
                <button
                  key={status}
                  onClick={() => handleUpdateStatusSubmit(status)}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                >
                  <span className="capitalize">{status.replace('_', ' ')}</span>
                  {getStatusBadge(status)}
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Convert shortlisted candidate to registry Student */}
      {convertCandidate && (
        <Modal
          isOpen={true}
          onClose={() => setConvertCandidate(null)}
          title="Register Student Record"
          description="Assign section and roll number to register the candidate in the student registry."
        >
          <form onSubmit={handleConvertSubmit} className="space-y-4">
            <FormField label="Target Section" required>
              <select
                value={targetSection}
                onChange={(e) => setTargetSection(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              >
                <option value="">Select Section...</option>
                {sections?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Roll Number">
              <input
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="e.g. 10"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </FormField>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConvertCandidate(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={convertMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Finalize Registry
              </button>
            </div>
          </form>
        </Modal>
      )}
    </PageWrapper>
  )
}
