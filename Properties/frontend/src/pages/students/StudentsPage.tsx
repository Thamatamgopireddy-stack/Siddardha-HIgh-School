import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ColumnDef } from '@tanstack/react-table'
import { useQueryClient } from '@tanstack/react-query'
import {
  Upload,
  UserPlus,
  Eye,
  Edit2,
  Trash2,
  Key,
  ArrowLeft,
  School,
  Search,
  LayoutGrid,
  List,
  Sparkles,
  ShieldCheck,
  CheckSquare,
} from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { DataTable } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ExcelImportModal } from '@/components/shared/ExcelImportModal'
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
} from '@/api/hooks'
import type { Student } from '@/types'

export function StudentsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Navigation / View State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [search, setSearch] = useState('')

  // Selection Filters
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')

  // Multi-select for deletion
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([])

  // Entry Form State
  const [entryClassId, setEntryClassId] = useState('')
  const [entrySectionId, setEntrySectionId] = useState('')

  // Modals State
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null)
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false)

  // API hooks
  const { data: academicYears } = useAcademicYears()
  const { data: classes } = useClasses(selectedAcademicYear)

  // Fetch all sections across all classes
  const { data: allSections } = useSections()

  // Sections filtered by selected class or entry class
  const currentClassSections = useMemo(
    () => allSections?.filter((s) => !selectedClass || s.class_id === selectedClass) || [],
    [allSections, selectedClass]
  )
  const entrySections = useMemo(
    () => allSections?.filter((s) => s.class_id === entryClassId) || [],
    [allSections, entryClassId]
  )

  // Active section name & details
  const activeClassObj = useMemo(() => classes?.find((c) => c.id === selectedClass), [classes, selectedClass])
  const activeSectionObj = useMemo(
    () => allSections?.find((s) => s.id === selectedSection),
    [allSections, selectedSection]
  )

  // Filtered Students query for data table
  const { data: studentsData, isLoading } = useStudents(
    page,
    search,
    selectedSection,
    selectedAcademicYear,
    limit,
    selectedClass
  )

  // Overview Query: fetch all students for the academic year to calculate section & class counts
  const { data: allStudentsData } = useStudents(1, '', '', selectedAcademicYear, 2000)

  // Mutations
  const createStudentMutation = useCreateStudent()
  const updateStudentMutation = useUpdateStudent(editingStudent?.id || '')
  const deleteStudentMutation = useDeleteStudent()
  const provisionAccessMutation = useProvisionPortalAccess()
  const bulkImportMutation = useBulkImportStudents()

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

  // Auto-select Current Academic Year
  useEffect(() => {
    if (!selectedAcademicYear && academicYears && academicYears.length > 0) {
      const current = academicYears.find((y) => y.is_current)
      setSelectedAcademicYear(current ? current.id : academicYears[0].id)
    }
  }, [academicYears, selectedAcademicYear])

  // Map students by section_id for real-time section counts
  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    if (allStudentsData?.data) {
      allStudentsData.data.forEach((st) => {
        if (st.section_id) {
          counts[st.section_id] = (counts[st.section_id] || 0) + 1
        }
      })
    }
    return counts
  }, [allStudentsData])

  // Sync Form Entry Class & Section defaults
  useEffect(() => {
    if (selectedClass && !entryClassId) setEntryClassId(selectedClass)
    if (selectedSection && !entrySectionId) setEntrySectionId(selectedSection)
  }, [selectedClass, selectedSection])

  // Clear row selection when section or search changes
  useEffect(() => {
    setSelectedStudents([])
  }, [selectedSection, selectedClass, search, page])

  // Auto-adjust gender when Section G (Girls) is selected in Single Entry Form
  const handleEntrySectionChange = (secId: string) => {
    setEntrySectionId(secId)
    const secObj = entrySections?.find((s) => s.id === secId)
    if (secObj && secObj.name.toUpperCase() === 'G') {
      setFormValues((prev) => ({ ...prev, gender: 'female' }))
      toast.info('Section G is configured for Girls. Gender set to Female.')
    }
  }

  // Refresh queries helper
  const refreshAllStudentData = () => {
    queryClient.invalidateQueries({ queryKey: ['students'] })
    queryClient.invalidateQueries({ queryKey: ['sections'] })
    queryClient.invalidateQueries({ queryKey: ['classes'] })
  }

  // Handle Single Student Form Submission
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

    // Data validation for Section G (Girls Section)
    const chosenSec = entrySections?.find((s) => s.id === entrySectionId)
    if (chosenSec && chosenSec.name.toUpperCase() === 'G' && formValues.gender !== 'female') {
      toast.error('Section G is exclusively for female students (Girls Section). Please update gender to Female.')
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
        toast.success('Student registered successfully')
        setIsAddDrawerOpen(false)
      }
      resetForm()
      refreshAllStudentData()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save student details')
    }
  }

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
    setEntryClassId('')
    setEntrySectionId('')
  }

  const handleEditClick = (student: Student) => {
    setEditingStudent(student)
    setFormValues({ ...student })
    if (student.section_id) {
      setEntrySectionId(student.section_id)
    }
  }

  const handleDeleteSingleConfirm = async () => {
    if (!deletingStudentId) return
    try {
      await deleteStudentMutation.mutateAsync(deletingStudentId)
      toast.success('Student profile deleted successfully')
      setDeletingStudentId(null)
      setSelectedStudents((prev) => prev.filter((s) => s.id !== deletingStudentId))
      refreshAllStudentData()
    } catch {
      toast.error('Failed to delete student')
    }
  }

  const handleBulkDeleteConfirm = async () => {
    if (selectedStudents.length === 0) return
    try {
      const count = selectedStudents.length
      await Promise.all(selectedStudents.map((st) => deleteStudentMutation.mutateAsync(st.id)))
      toast.success(`Successfully deleted ${count} selected student record(s).`)
      setSelectedStudents([])
      setIsBulkDeleteConfirmOpen(false)
      refreshAllStudentData()
    } catch {
      toast.error('Failed to delete selected students')
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
      cell: ({ row }) => <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{row.original.admission_number}</span>,
    },
    {
      accessorKey: 'name',
      header: 'Student Name',
      cell: ({ row }) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-white">
            {row.original.first_name} {row.original.last_name}
          </div>
          {row.original.roll_number && (
            <div className="text-2xs text-slate-400">Roll No: {row.original.roll_number}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'gender',
      header: 'Gender',
      cell: ({ row }) => {
        const isFemale = row.original.gender?.toLowerCase() === 'female'
        return (
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
            isFemale
              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
              : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
          }`}>
            {row.original.gender}
          </span>
        )
      },
    },
    {
      accessorKey: 'phone',
      header: 'Contact Phone',
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

  return (
    <PageWrapper
      title="Students Registry"
      description="Class & Section Management, Multi-Select Student Deletion, and Bulk Imports"
      actions={
        <div className="flex items-center gap-2">
          {/* Bulk Delete Trigger Action */}
          {selectedStudents.length > 0 && (
            <button
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white shadow-2xs hover:bg-rose-700 transition"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedStudents.length})
            </button>
          )}

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Upload className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Bulk Data Entry
          </button>
          <button
            onClick={() => {
              setIsAddDrawerOpen(true)
            }}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-2xs hover:bg-indigo-700"
          >
            <UserPlus className="h-4 w-4" />
            Single Student Data
          </button>
        </div>
      }
    >
      {/* Top Controls & Navigation Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <div>
            <label className="mb-1 block text-2xs font-bold uppercase tracking-wider text-slate-400">
              Academic Session
            </label>
            <select
              value={selectedAcademicYear}
              onChange={(e) => {
                setSelectedAcademicYear(e.target.value)
                setSelectedClass('')
                setSelectedSection('')
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {academicYears?.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.is_current ? '(Current Session)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Breadcrumb back button when section selected */}
          {selectedSection && (
            <button
              onClick={() => {
                setSelectedClass('')
                setSelectedSection('')
              }}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/80 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> All Classes Overview
            </button>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-2xs font-bold uppercase text-slate-400">View:</span>
          <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-800">
            <button
              onClick={() => {
                setViewMode('grid')
                if (!selectedSection) {
                  setSelectedClass('')
                }
              }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition ${
                viewMode === 'grid'
                  ? 'bg-white text-indigo-600 shadow-2xs dark:bg-slate-900 dark:text-indigo-400'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Classes & Sections
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition ${
                viewMode === 'list'
                  ? 'bg-white text-indigo-600 shadow-2xs dark:bg-slate-900 dark:text-indigo-400'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <List className="h-3.5 w-3.5" /> All Students List
            </button>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: CLASSES & SECTIONS GRID (Default View) */}
      {viewMode === 'grid' && !selectedSection && (
        <div className="space-y-6">
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-blue-50/40 to-slate-50 p-4 dark:border-indigo-900/30 dark:from-indigo-950/20 dark:via-blue-950/10 dark:to-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-indigo-950 dark:text-indigo-200">
                  <School className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  School Class Directory (Classes 6th to 10th)
                </h3>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  Each class is partitioned into three dedicated sections: <strong>Section A</strong>, <strong>Section B</strong>, and <strong>Section G (Girls Section)</strong>. Click a section to view its students.
                </p>
              </div>
              <div className="hidden sm:block">
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-white px-3 py-1 text-2xs font-semibold text-indigo-700 shadow-2xs dark:border-indigo-800 dark:bg-slate-800 dark:text-indigo-300">
                  <Sparkles className="h-3 w-3 text-amber-500" /> Live Real-Time Updating
                </span>
              </div>
            </div>
          </div>

          {/* Classes Cards Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {classes?.map((cls) => {
              // Calculate total students in this class across all its sections
              const clsSections = allSections?.filter((s) => s.class_id === cls.id) || []
              const totalClassStudents = clsSections.reduce((sum, s) => sum + (sectionCounts[s.id] || 0), 0)

              // Build dynamic section display list (merging predefined A, B, G with any imported sections like C)
              const secList = [...clsSections]
              ;['A', 'B', 'G'].forEach((stdName) => {
                if (!secList.some((s) => s.name.trim().toUpperCase() === stdName)) {
                  secList.push({ id: `${cls.id}-${stdName}`, class_id: cls.id, name: stdName })
                }
              })
              secList.sort((a, b) => a.name.localeCompare(b.name))

              return (
                <div
                  key={cls.id}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xs transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  {/* Class Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shadow-2xs">
                        {cls.name.replace(/class/i, '').trim()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{cls.name}</h4>
                        <span className="text-2xs text-slate-500 dark:text-slate-400">CBSE/ICSE Curriculum</span>
                      </div>
                    </div>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-2xs font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                      {totalClassStudents} {totalClassStudents === 1 ? 'Student' : 'Students'}
                    </span>
                  </div>

                  {/* Sections List */}
                  <div className="p-4 space-y-3 flex-1">
                    {secList.map((sec) => {
                      const isGirls = sec.name.trim().toUpperCase() === 'G'
                      const count = sectionCounts[sec.id] || 0

                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => {
                            setSelectedClass(cls.id)
                            setSelectedSection(sec.id)
                            setViewMode('grid')
                          }}
                          className={`w-full flex items-center justify-between rounded-xl border p-3 text-left transition ${
                            isGirls
                              ? 'border-rose-200 bg-rose-50/40 hover:bg-rose-100/60 dark:border-rose-900/40 dark:bg-rose-950/20 dark:hover:bg-rose-950/40'
                              : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold text-xs ${
                                isGirls
                                  ? 'bg-rose-600 text-white'
                                  : sec.name.toUpperCase() === 'A'
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-blue-600 text-white'
                              }`}
                            >
                              {sec.name}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                  Section {sec.name}
                                </span>
                                {isGirls && (
                                  <span className="rounded bg-rose-100 px-1.5 py-0.2 text-3xs font-bold uppercase text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
                                    Girls Only
                                  </span>
                                )}
                              </div>
                              <span className="text-2xs text-slate-500 dark:text-slate-400">
                                {isGirls ? 'Female Roster' : `Section ${sec.name} Roster`}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                              isGirls ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'
                            }`}>
                              {count} {count === 1 ? 'Student' : 'Students'}
                            </span>
                            <span className="block text-3xs text-slate-400">Click to View &rarr;</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: STUDENT ROSTER TABLE (Rendered in both Grid and List modes) */}
      {(selectedSection || viewMode === 'list' || viewMode === 'grid') && (
        <div className="space-y-4">
          {/* Header Banner for Selected Section */}
          {selectedSection && (
            <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-white shadow-2xs ${
                  activeSectionObj?.name.toUpperCase() === 'G' ? 'bg-rose-600' : 'bg-indigo-600'
                }`}>
                  {activeSectionObj?.name || 'Sec'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {activeClassObj?.name || 'Class'} — Section {activeSectionObj?.name || ''} Roster
                    </h3>
                    {activeSectionObj?.name.toUpperCase() === 'G' && (
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-2xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                        Girls Section
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Displaying active student roster. Select multiple checkboxes to delete multiple students at once.
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Enrolled:</span>
                <span className="ml-1 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {studentsData?.meta?.total || studentsData?.data?.length || 0} Students
                </span>
              </div>
            </div>
          )}

          {/* Floating / Active Selection Banner */}
          {selectedStudents.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 shadow-2xs dark:border-rose-900/50 dark:bg-rose-950/40">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-xs font-bold text-white shadow-2xs">
                  {selectedStudents.length}
                </div>
                <div>
                  <span className="text-xs font-bold text-rose-950 dark:text-rose-200">
                    {selectedStudents.length} {selectedStudents.length === 1 ? 'student record' : 'student records'} selected for deletion
                  </span>
                  <span className="block text-2xs text-rose-700 dark:text-rose-300">
                    Click "Delete Selected" to permanently soft-delete all selected students.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteConfirmOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-rose-700 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Selected ({selectedStudents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStudents([])}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs md:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <label className="mb-1 block text-2xs font-bold uppercase tracking-wider text-slate-400">Class</label>
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value)
                  setSelectedSection('')
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
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
              <label className="mb-1 block text-2xs font-bold uppercase tracking-wider text-slate-400">Section</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">All Sections</option>
                {currentClassSections?.map((s) => (
                  <option key={s.id} value={s.id}>
                    Section {s.name} {s.name.toUpperCase() === 'G' ? '(Girls)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-2xs font-bold uppercase tracking-wider text-slate-400">Search Roster</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="search"
                  placeholder="Search by student name, roll number, or admission ID..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Student Roster Table with Multi-Select Enabled */}
          <DataTable
            columns={columns}
            data={studentsData?.data || []}
            isLoading={isLoading}
            selectable={true}
            onSelectionChange={(selected) => setSelectedStudents(selected)}
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
            rowActions={(row) => {
              const studentId = row.id
              return (
                <div className="space-y-0.5">
                  <Link
                    to={`/students/${studentId}`}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Eye className="h-3.5 w-3.5 text-slate-400" />
                    View Student Profile
                  </Link>
                  <button
                    onClick={() => handleEditClick(row)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                    Edit Profile
                  </button>
                  <button
                    onClick={() => handleProvisionAccess(studentId)}
                    disabled={!!row.user_id}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Key className="h-3.5 w-3.5 text-slate-400" />
                    Provision Access
                  </button>
                  <button
                    onClick={() => setDeletingStudentId(studentId)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Record
                  </button>
                </div>
              )
            }}
          />
        </div>
      )}

      {/* SINGLE STUDENT REGISTRATION MODAL */}
      {(isAddDrawerOpen || editingStudent) && (
        <Modal
          isOpen={true}
          onClose={() => {
            setIsAddDrawerOpen(false)
            setEditingStudent(null)
            resetForm()
          }}
          title={editingStudent ? 'Edit Student Details' : 'Register Single Student'}
          size="lg"
        >
          <form onSubmit={handleFormSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Admission Number" required>
                <input
                  type="text"
                  value={formValues.admission_number}
                  onChange={(e) => setFormValues({ ...formValues, admission_number: e.target.value })}
                  disabled={!!editingStudent}
                  placeholder="e.g. ADM2025001"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
              <FormField label="Roll Number">
                <input
                  type="text"
                  value={formValues.roll_number || ''}
                  onChange={(e) => setFormValues({ ...formValues, roll_number: e.target.value })}
                  placeholder="e.g. 101"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </FormField>
              <FormField label="First Name" required>
                <input
                  type="text"
                  value={formValues.first_name}
                  onChange={(e) => setFormValues({ ...formValues, first_name: e.target.value })}
                  placeholder="Student First Name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
              <FormField label="Last Name" required>
                <input
                  type="text"
                  value={formValues.last_name}
                  onChange={(e) => setFormValues({ ...formValues, last_name: e.target.value })}
                  placeholder="Surname / Last Name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
              <FormField label="Class (6th to 10th)" required>
                <select
                  value={entryClassId}
                  onChange={(e) => {
                    setEntryClassId(e.target.value)
                    setEntrySectionId('')
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
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
              <FormField label="Section (A, B, or G)" required>
                <select
                  value={entrySectionId}
                  onChange={(e) => handleEntrySectionChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  required
                  disabled={!entryClassId}
                >
                  <option value="">Select Section...</option>
                  {entrySections?.map((s) => (
                    <option key={s.id} value={s.id}>
                      Section {s.name} {s.name.toUpperCase() === 'G' ? '(Girls Section)' : ''}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Date of Birth" required>
                <input
                  type="date"
                  value={formValues.date_of_birth}
                  onChange={(e) => setFormValues({ ...formValues, date_of_birth: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
              <FormField label="Gender" required>
                <select
                  value={formValues.gender}
                  onChange={(e) => setFormValues({ ...formValues, gender: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  required
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </FormField>
            </div>

            {/* Helper Notice for Section G */}
            {entrySections?.find((s) => s.id === entrySectionId)?.name.toUpperCase() === 'G' && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                <ShieldCheck className="h-4 w-4 text-rose-600" />
                <span><strong>Section G Notice:</strong> Section G is designated for female students (Girls Section). Gender has been updated accordingly.</span>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/50 p-4 -mx-6 -mb-6 dark:border-slate-800 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => {
                  setIsAddDrawerOpen(false)
                  setEditingStudent(null)
                  resetForm()
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createStudentMutation.isPending || updateStudentMutation.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs"
              >
                Save Student Record
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* BULK DATA ENTRY MODAL */}
      {isImportModalOpen && (
        <ExcelImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          title="Student Bulk Data Entry"
          description="Upload an Excel sheet (.xlsx, .xls) or CSV containing student rosters. Student records will be automatically placed into their respective Class (6-10) and Section (A, B, G) based on sheet names or column values."
          templateUrl="/students/bulk-template"
          templateFileName="students_import_template.xlsx"
          extraFields={
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Class Selection (Optional)">
                <select
                  value={entryClassId}
                  onChange={(e) => {
                    setEntryClassId(e.target.value)
                    setEntrySectionId('')
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">Auto-detect Class & Section from sheets...</option>
                  {classes?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Section Selection (Optional)">
                <select
                  value={entrySectionId}
                  onChange={(e) => setEntrySectionId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  disabled={!entryClassId}
                >
                  <option value="">Auto-detect Section from sheets...</option>
                  {entrySections?.map((s) => (
                    <option key={s.id} value={s.id}>
                      Section {s.name} {s.name.toUpperCase() === 'G' ? '(Girls Section)' : ''}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          }
          onImport={async (file) => {
            if (!selectedAcademicYear) {
              throw new Error('Please select an Academic Year first')
            }
            const res = await bulkImportMutation.mutateAsync({
              file,
              academicYearId: selectedAcademicYear,
              classId: entryClassId || undefined,
              sectionId: entrySectionId || undefined,
            })
            // Refetch queries so section cards & student tables display updated numbers immediately
            setSelectedClass('')
            setSelectedSection('')
            setViewMode('list')
            refreshAllStudentData()
            toast.success(`Bulk import complete! ${res.imported} students assigned to their respective Class & Section rosters.`)
            return res
          }}
        />
      )}

      {/* SINGLE DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={deletingStudentId !== null}
        onClose={() => setDeletingStudentId(null)}
        onConfirm={handleDeleteSingleConfirm}
        title="Delete Student Profile"
        message="Are you sure you want to delete this student profile? This operation soft deletes the record and preserves historical logs."
        danger
        isLoading={deleteStudentMutation.isPending}
      />

      {/* BULK MULTI-SELECT DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={isBulkDeleteConfirmOpen}
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        title={`Delete ${selectedStudents.length} Selected Student(s)`}
        message={`Are you sure you want to delete the ${selectedStudents.length} selected student record(s)? This operation will soft delete all selected profiles.`}
        danger
        isLoading={deleteStudentMutation.isPending}
      />
    </PageWrapper>
  )
}
