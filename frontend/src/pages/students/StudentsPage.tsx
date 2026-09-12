import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ColumnDef } from '@tanstack/react-table'
import { FileDown, Upload, UserPlus, Eye, Edit2, Trash2, Key, CheckCircle, HelpCircle } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { DataTable } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FileUpload } from '@/components/shared/FileUpload'
import { FormField } from '@/components/shared/FormField'
import { Avatar } from '@/components/shared/Avatar'
import { Badge } from '@/components/ui/Badge'
import {
  useStudents,
  useAcademicYears,
  useClasses,
  useSections,
  useCreateStudent,
  useUpdateStudent,
  useDeleteStudent,
  useProvisionPortalAccess,
  useBulkImportStudents,
  useImportStudentsFromGoogleSheets,
} from '@/api/hooks'
import type { Student } from '@/types'
import { API_URL } from '@/api/client'


export function StudentsPage() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [search, setSearch] = useState('')
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [entryClassId, setEntryClassId] = useState('')
  const [entrySectionId, setEntrySectionId] = useState('')

  // Modals / Drawers State
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null)
  const [entryMode, setEntryMode] = useState<'single' | 'bulk'>('single')
  const [importMode, setImportMode] = useState<'csv' | 'gsheets'>('csv')
  const [sheetSpreadsheetId, setSheetSpreadsheetId] = useState('')
  const [sheetRangeName, setSheetRangeName] = useState('Sheet1!A:Z')

  // API hooks
  const { data: academicYears } = useAcademicYears()
  const { data: classes } = useClasses(selectedAcademicYear)
  const { data: sections } = useSections(selectedClass)
  const { data: entrySections } = useSections(entryClassId)

  const { data: studentsData, isLoading } = useStudents(
    page,
    search,
    selectedSection,
    selectedAcademicYear
  )

  const createStudentMutation = useCreateStudent()
  const updateStudentMutation = useUpdateStudent(editingStudent?.id || '')
  const deleteStudentMutation = useDeleteStudent()
  const provisionAccessMutation = useProvisionPortalAccess()
  const bulkImportMutation = useBulkImportStudents()
  const importFromSheetsMutation = useImportStudentsFromGoogleSheets()

  // Form State
  const [formValues, setFormValues] = useState<Partial<Student>>({
    admission_number: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    date_of_birth: '',
    gender: 'male',
    roll_number: '',
    phone: '',
    email: '',
    category: 'general',
    blood_group: '',
    nationality: 'Indian',
    religion: '',
    aadhaar_number: '',
    previous_school: '',
    tc_number: '',
    address_line1: '',
    city: '',
    state: '',
    pincode: '',
  })

  useEffect(() => {
    if (!selectedAcademicYear && academicYears && academicYears.length > 0) {
      const current = academicYears.find((y) => y.is_current)
      setSelectedAcademicYear(current ? current.id : academicYears[0].id)
    }
  }, [academicYears, selectedAcademicYear])

  useEffect(() => {
    if (selectedClass && !entryClassId) {
      setEntryClassId(selectedClass)
    }
  }, [selectedClass, entryClassId])

  useEffect(() => {
    if (selectedSection && !entrySectionId) {
      setEntrySectionId(selectedSection)
    }
  }, [selectedSection, entrySectionId])

  const columns: ColumnDef<Student>[] = [
    {
      accessorKey: 'profile_photo_url',
      header: 'Photo',
      cell: ({ row }) => (
        <Avatar
          src={row.original.profile_photo_url}
          firstName={row.original.first_name}
          lastName={row.original.last_name}
          size="sm"
        />
      ),
    },
    {
      accessorKey: 'admission_number',
      header: 'Admission No',
      cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.admission_number}</span>,
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="font-medium text-slate-900 dark:text-white">
          {row.original.first_name} {row.original.last_name}
        </div>
      ),
    },
    {
      accessorKey: 'roll_number',
      header: 'Roll No',
      cell: ({ row }) => row.original.roll_number || '—',
    },
    {
      accessorKey: 'gender',
      header: 'Gender',
      cell: ({ row }) => <span className="capitalize">{row.original.gender}</span>,
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => row.original.phone || '—',
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? 'success' : 'neutral'}>
          {row.original.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ]

  const resetForm = () => {
    setFormValues({
      admission_number: '',
      first_name: '',
      middle_name: '',
      last_name: '',
      date_of_birth: '',
      gender: 'male',
      roll_number: '',
      phone: '',
      email: '',
      category: 'general',
      blood_group: '',
      nationality: 'Indian',
      religion: '',
      aadhaar_number: '',
      previous_school: '',
      tc_number: '',
      address_line1: '',
      city: '',
      state: '',
      pincode: '',
    })
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAcademicYear) {
      toast.error('Please select an academic year first.')
      return
    }
    if (!entryClassId) {
      toast.error('Please select a class for this student.')
      return
    }
    if (!entrySectionId) {
      toast.error('Please select a section for this student.')
      return
    }

    try {
      if (editingStudent) {
        await updateStudentMutation.mutateAsync({
          ...formValues,
          section_id: entrySectionId || undefined,
        })
        toast.success('Student profile updated successfully')
        setEditingStudent(null)
      } else {
        await createStudentMutation.mutateAsync({
          ...formValues,
          academic_year_id: selectedAcademicYear,
          section_id: entrySectionId || undefined,
        })
        toast.success('Student added successfully')
        setIsAddDrawerOpen(false)
      }
      resetForm()
      setEntrySectionId('')
      setEntryClassId('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save student details')
    }
  }

  const handleEditClick = (student: Student) => {
    setEditingStudent(student)
    setFormValues({ ...student })
  }

  const handleDeleteConfirm = async () => {
    if (!deletingStudentId) return
    try {
      await deleteStudentMutation.mutateAsync(deletingStudentId)
      toast.success('Student profile deleted successfully')
      setDeletingStudentId(null)
    } catch {
      toast.error('Failed to delete student')
    }
  }

  const handleProvisionAccess = async (studentId: string) => {
    try {
      const res = await provisionAccessMutation.mutateAsync(studentId)
      toast.success(`Access created! Username: ${res.username}, Password: ${res.default_password}`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to provision access')
    }
  }

  const [importFile, setImportFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<any | null>(null)
  const [importResult, setImportResult] = useState<any | null>(null)

  const handleBulkImportPreview = async (files: File[]) => {
    if (files.length === 0) return
    if (!selectedAcademicYear) {
      toast.error('Please select an academic year first.')
      return
    }
    if (!entryClassId || !entrySectionId) {
      toast.error('Please select a class and section for the bulk import.')
      return
    }

    const file = files[0]
    setImportFile(file)
    setImportResult(null)

    try {
      const res = await bulkImportMutation.mutateAsync({
        file,
        academicYearId: selectedAcademicYear,
        sectionId: entrySectionId,
        dryRun: true,
      })
      setPreviewData(res)
      toast.info(`Preview generated: ${res.imported} valid rows, ${res.invalid_count} invalid rows.`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Dry-run preview failed')
    }
  }

  const handleConfirmImport = async () => {
    if (!importFile) return
    try {
      const res = await bulkImportMutation.mutateAsync({
        file: importFile,
        academicYearId: selectedAcademicYear,
        sectionId: entrySectionId,
        dryRun: false,
      })
      setImportResult(res)
      setPreviewData(null)
      toast.success(`Import confirmed! Successfully imported ${res.imported} students.`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Bulk import confirmation failed')
    }
  }

  const handleGoogleSheetsImport = async () => {
    if (!selectedAcademicYear) {
      toast.error('Please select an academic year first.')
      return
    }
    if (!entryClassId) {
      toast.error('Please select a class for the imported students.')
      return
    }
    if (!entrySectionId) {
      toast.error('Please select a section for the imported students.')
      return
    }
    const rawId = sheetSpreadsheetId.trim()
    if (!rawId) {
      toast.error('Please provide the Google Sheets spreadsheet ID.')
      return
    }

    const match = rawId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    const cleanId = match && match[1] ? match[1] : rawId.replace(/^['"]|['"]$/g, '')

    try {
      const res = await importFromSheetsMutation.mutateAsync({
        spreadsheetId: cleanId,
        rangeName: sheetRangeName.trim() || 'Sheet1!A:Z',
        academicYearId: selectedAcademicYear,
        sectionId: entrySectionId,
      })
      toast.success(`Google Sheets import completed: ${res.imported} students created.`)
      if (res.errors && res.errors.length > 0) {
        console.warn('Google Sheets import errors:', res.errors)
        toast.warning(`${res.errors.length} rows encountered issues.`)
      }
      setIsImportModalOpen(false)
      setSheetSpreadsheetId('')
      setSheetRangeName('Sheet1!A:Z')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Google Sheets import failed')
    }
  }

  return (
    <PageWrapper
      title="Students"
      description="Student Information Registry"
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEntryMode('bulk')
              setImportMode('csv')
              setIsImportModalOpen(true)
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <Upload className="h-4 w-4" />
            Bulk Data
          </button>
          <button
            onClick={() => {
              setEntryMode('single')
              setIsAddDrawerOpen(true)
            }}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4" />
            Single Student Data
          </button>
        </div>
      }
    >
      {/* Search & Filter Header */}
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase">Academic Year</label>
          <select
            value={selectedAcademicYear}
            onChange={(e) => {
              setSelectedAcademicYear(e.target.value)
              setSelectedClass('')
              setSelectedSection('')
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">Select Year...</option>
            {academicYears?.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} {y.is_current ? '(Current)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase">Class</label>
          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value)
              setSelectedSection('')
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
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase">Section</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">All Sections</option>
            {sections?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase">Search</label>
          <input
            type="search"
            placeholder="Search by name or admission number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </div>

      {/* Main Student list Table */}
      <DataTable
        columns={columns}
        data={studentsData?.data || []}
        isLoading={isLoading}
        pagination={
          studentsData?.meta
            ? {
                page,
                limit,
                total: studentsData.meta.total || 0,
              }
            : undefined
        }
        onPageChange={(p) => setPage(p)}
        onLimitChange={(l) => {
          setLimit(l)
          setPage(1)
        }}
        rowActions={(row) => (
          <div className="space-y-0.5">
            <Link
              to={`/students/${row.id}`}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Eye className="h-4 w-4 text-slate-500" />
              View Profile
            </Link>
            <button
              onClick={() => handleEditClick(row)}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Edit2 className="h-4 w-4 text-slate-500" />
              Edit Profile
            </button>
            <button
              onClick={() => handleProvisionAccess(row.id)}
              disabled={!!row.user_id}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              <Key className="h-4 w-4 text-slate-500" />
              Provision Access
            </button>
            <button
              onClick={() => setDeletingStudentId(row.id)}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs text-danger hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Trash2 className="h-4 w-4" />
              Delete Student
            </button>
          </div>
        )}
      />

      {/* Add / Edit Form Modal */}
      {(isAddDrawerOpen || editingStudent) && (
        <Modal
          isOpen={true}
          onClose={() => {
            setIsAddDrawerOpen(false)
            setEditingStudent(null)
            resetForm()
          }}
          title={editingStudent ? 'Edit Student Details' : 'Register New Student'}
          size="lg"
        >
          <form onSubmit={handleFormSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Admission Number" required>
                <input
                  type="text"
                  value={formValues.admission_number}
                  onChange={(e) => setFormValues({ ...formValues, admission_number: e.target.value })}
                  disabled={!!editingStudent}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
              <FormField label="Roll Number">
                <input
                  type="text"
                  value={formValues.roll_number || ''}
                  onChange={(e) => setFormValues({ ...formValues, roll_number: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </FormField>
              <FormField label="First Name" required>
                <input
                  type="text"
                  value={formValues.first_name}
                  onChange={(e) => setFormValues({ ...formValues, first_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
              <FormField label="Last Name" required>
                <input
                  type="text"
                  value={formValues.last_name}
                  onChange={(e) => setFormValues({ ...formValues, last_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
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
              <FormField label="Class" required>
                <select
                  value={entryClassId}
                  onChange={(e) => {
                    setEntryClassId(e.target.value)
                    setEntrySectionId('')
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
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
              <FormField label="Section" required>
                <select
                  value={entrySectionId}
                  onChange={(e) => setEntrySectionId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                  disabled={!entryClassId}
                >
                  <option value="">Select Section...</option>
                  {entrySections?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Mobile Phone">
                <input
                  type="tel"
                  value={formValues.phone || ''}
                  onChange={(e) => setFormValues({ ...formValues, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </FormField>
              <FormField label="Email Address">
                <input
                  type="email"
                  value={formValues.email || ''}
                  onChange={(e) => setFormValues({ ...formValues, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </FormField>
            </div>

            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <h4 className="mb-3 font-semibold text-slate-700 dark:text-slate-300">Identity & Demographic Details</h4>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Category">
                  <select
                    value={formValues.category || 'general'}
                    onChange={(e) => setFormValues({ ...formValues, category: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="general">General</option>
                    <option value="obc">OBC</option>
                    <option value="sc">SC</option>
                    <option value="st">ST</option>
                    <option value="ews">EWS</option>
                  </select>
                </FormField>
                <FormField label="Blood Group">
                  <input
                    type="text"
                    value={formValues.blood_group || ''}
                    onChange={(e) => setFormValues({ ...formValues, blood_group: e.target.value })}
                    placeholder="e.g. O+"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </FormField>
                <FormField label="Aadhaar Number">
                  <input
                    type="text"
                    value={formValues.aadhaar_number || ''}
                    onChange={(e) => setFormValues({ ...formValues, aadhaar_number: e.target.value })}
                    placeholder="XXXX-XXXX-XXXX"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </FormField>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <h4 className="mb-3 font-semibold text-slate-700 dark:text-slate-300">Permanent Address</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Street Address" className="sm:col-span-2">
                  <input
                    type="text"
                    value={formValues.address_line1 || ''}
                    onChange={(e) => setFormValues({ ...formValues, address_line1: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </FormField>
                <FormField label="City">
                  <input
                    type="text"
                    value={formValues.city || ''}
                    onChange={(e) => setFormValues({ ...formValues, city: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </FormField>
                <FormField label="Pincode">
                  <input
                    type="text"
                    value={formValues.pincode || ''}
                    onChange={(e) => setFormValues({ ...formValues, pincode: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </FormField>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/50 p-4 -mx-6 -mb-6 dark:border-slate-800 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => {
                  setIsAddDrawerOpen(false)
                  setEditingStudent(null)
                  resetForm()
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createStudentMutation.isPending || updateStudentMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Save Student
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Bulk Import Modal */}
      {isImportModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsImportModalOpen(false)}
          title="Student Data Entry"
          description="Choose a bulk import mode for student records."
        >
          <div className="space-y-4">
            <div className="flex gap-2 rounded-lg border border-slate-200 p-1 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setImportMode('csv')}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${importMode === 'csv' ? 'bg-accent text-white' : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'}`}
              >
                CSV Upload
              </button>
              <button
                type="button"
                onClick={() => setImportMode('gsheets')}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${importMode === 'gsheets' ? 'bg-accent text-white' : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'}`}
              >
                Google Sheets
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Class" required>
                <select
                  value={entryClassId}
                  onChange={(e) => {
                    setEntryClassId(e.target.value)
                    setEntrySectionId('')
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
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
              <FormField label="Section" required>
                <select
                  value={entrySectionId}
                  onChange={(e) => setEntrySectionId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                  disabled={!entryClassId}
                >
                  <option value="">Select Section...</option>
                  {entrySections?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            {importMode === 'csv' ? (
              <>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3.5 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2.5">
                    <FileDown className="h-5 w-5 text-accent" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">CSV Template</span>
                  </div>
                  <a
                    href={`${API_URL}/api/v1/students/export?academic_year_id=${selectedAcademicYear}`}
                    download
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    Download Sample Template
                  </a>
                </div>

                {!previewData && !importResult && (
                  <FileUpload
                    accept=".csv"
                    maxSize={5}
                    onUpload={handleBulkImportPreview}
                  />
                )}

                {previewData && (
                  <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-slate-900 dark:text-white">Import Dry-Run Preview</h4>
                      <Badge variant="warning">Preview Mode (0 DB Commits)</Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-white p-2.5 shadow-xs dark:bg-slate-800">
                        <span className="text-slate-400">Total Rows</span>
                        <p className="text-base font-bold text-slate-800 dark:text-white">{previewData.total_rows}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-2.5 shadow-xs dark:bg-emerald-950/30">
                        <span className="text-emerald-600 dark:text-emerald-400">Ready to Commit</span>
                        <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">{previewData.imported}</p>
                      </div>
                      <div className="rounded-lg bg-rose-50 p-2.5 shadow-xs dark:bg-rose-950/30">
                        <span className="text-rose-600 dark:text-rose-400">Will Fail</span>
                        <p className="text-base font-bold text-rose-700 dark:text-rose-300">{previewData.invalid_count}</p>
                      </div>
                    </div>

                    {previewData.error_details && previewData.error_details.length > 0 && (
                      <div className="max-h-40 overflow-y-auto rounded-lg border border-rose-200 bg-white p-2.5 dark:border-rose-900 dark:bg-slate-900">
                        <span className="text-xs font-semibold text-rose-600">Validation Failures Identified:</span>
                        <ul className="mt-1 space-y-1 text-2xs text-rose-700 dark:text-rose-400">
                          {previewData.error_details.map((err: any, i: number) => (
                            <li key={i}>
                              <strong>{err.identifier}:</strong> {err.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setPreviewData(null)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
                      >
                        Select Another File
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmImport}
                        className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Confirm Import ({previewData.imported} Records)
                      </button>
                    </div>
                  </div>
                )}

                {importResult && (
                  <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-emerald-900 dark:text-emerald-200">Import Completed Successfully</h4>
                      <Badge variant="success">Committed to Database</Badge>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Successfully created <strong>{importResult.imported}</strong> student records in the database.
                    </p>

                    {importResult.invalid_count > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30">
                        <span>{importResult.invalid_count} row(s) failed validation. Download the CSV report below for failure details:</span>
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              const csv = previewData?.error_details ? JSON.stringify(previewData.error_details) : ''
                              const blob = new Blob([csv], { type: 'text/csv' })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = 'failed_student_rows.csv'
                              a.click()
                            }}
                            className="inline-flex items-center gap-1 rounded bg-amber-700 px-3 py-1 text-2xs font-semibold text-white hover:bg-amber-800"
                          >
                            <FileDown className="h-3 w-3" />
                            Download Error Report CSV
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsImportModalOpen(false)
                          setImportResult(null)
                        }}
                        className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <FormField label="Google Spreadsheet ID" required>
                  <input
                    type="text"
                    value={sheetSpreadsheetId}
                    onChange={(e) => setSheetSpreadsheetId(e.target.value)}
                    placeholder="Paste the spreadsheet ID"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </FormField>
                <FormField label="Sheet Range">
                  <input
                    type="text"
                    value={sheetRangeName}
                    onChange={(e) => setSheetRangeName(e.target.value)}
                    placeholder="Sheet1!A:Z"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </FormField>
                <button
                  type="button"
                  onClick={handleGoogleSheetsImport}
                  disabled={importFromSheetsMutation.isPending}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {importFromSheetsMutation.isPending ? 'Importing...' : 'Import from Google Sheets'}
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deletingStudentId !== null}
        onClose={() => setDeletingStudentId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Student Profile"
        message="Are you sure you want to delete this student's profile? This operation soft deletes the record and preserves history logs."
        danger
        isLoading={deleteStudentMutation.isPending}
      />
    </PageWrapper>
  )
}
