import { useState } from 'react'
import { toast } from 'sonner'
import { FileText, Calendar, Plus, Save, BookOpen, UserCheck, AlertTriangle, CheckCircle2, Download, Eye, Globe } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { FormField } from '@/components/shared/FormField'
import { Modal } from '@/components/shared/Modal'
import { DataTable } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/shared/StatCard'
import { useAuthStore } from '@/store'
import {
  useAcademicYears,
  useClasses,
  useSections,
  useExams,
  useCreateExam,
  useExamSchedules,
  useCreateExamSchedule,
  useScheduleMarks,
  useSaveScheduleMarks,
  usePublishExam,
  useMyExamResults,
} from '@/api/hooks'
import { API_URL } from '@/api/client'

export function ExaminationsPage() {
  const role = useAuthStore((s) => s.user?.role)
  const isParentOrStudent = role === 'student' || role === 'parent'

  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')

  const [selectedExamId, setSelectedExamId] = useState<string>('')
  const [activeScheduleId, setActiveScheduleId] = useState<string>('')

  // Modals state
  const [isAddExamOpen, setIsAddExamOpen] = useState(false)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)

  // Marks Entry Form state
  const [marksState, setMarksState] = useState<Record<string, { marks: number; remarks: string }>>({})

  // API hooks
  const { data: academicYears } = useAcademicYears()
  const { data: classes } = useClasses(selectedAcademicYear)
  const { data: sections } = useSections(selectedClass)

  const { data: exams, isLoading: isExamsLoading } = useExams(selectedAcademicYear)
  const { data: schedules, isLoading: isSchedulesLoading } = useExamSchedules(selectedExamId || undefined)
  const { data: scheduleMarksData, isLoading: isMarksLoading } = useScheduleMarks(activeScheduleId || undefined)
  const { data: myResults, isLoading: isMyResultsLoading } = useMyExamResults()

  const createExamMutation = useCreateExam()
  const createScheduleMutation = useCreateExamSchedule(selectedExamId)
  const saveMarksMutation = useSaveScheduleMarks(activeScheduleId)
  const publishExamMutation = usePublishExam(selectedExamId)

  // Initialize selected Academic Year
  if (!selectedAcademicYear && academicYears && academicYears.length > 0) {
    const current = academicYears.find((y) => y.is_current)
    setSelectedAcademicYear(current ? current.id : academicYears[0].id)
  }

  const marksRecords = scheduleMarksData?.students || []
  const maxMarksAllowed = scheduleMarksData?.max_marks || 100

  // Form inputs
  const [examForm, setExamForm] = useState({ name: '', exam_type: 'Mid-Term' })
  const [scheduleForm, setScheduleForm] = useState({
    subject_id: '',
    section_id: '',
    exam_date: new Date().toISOString().split('T')[0],
    max_marks: 100,
    pass_marks: 33,
  })

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createExamMutation.mutateAsync({
        academic_year_id: selectedAcademicYear,
        name: examForm.name,
        exam_type: examForm.exam_type,
      })
      toast.success('Exam created successfully!')
      setIsAddExamOpen(false)
      setExamForm({ name: '', exam_type: 'Mid-Term' })
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create exam')
    }
  }

  const handlePublishToggle = async (exam: any) => {
    try {
      await publishExamMutation.mutateAsync(!exam.is_published)
      toast.success(`Exam status updated to ${!exam.is_published ? 'Published' : 'Draft'}`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update publication status')
    }
  }

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSection) {
      toast.error('Please select a class section first in the filter toolbar.')
      return
    }
    try {
      const dummySubjectId = scheduleForm.subject_id || '00000000-0000-0000-0000-000000000000'
      await createScheduleMutation.mutateAsync({
        subject_id: dummySubjectId,
        section_id: selectedSection,
        exam_date: scheduleForm.exam_date,
        max_marks: Number(scheduleForm.max_marks),
        pass_marks: Number(scheduleForm.pass_marks),
      })
      toast.success('Subject exam schedule created successfully!')
      setIsScheduleOpen(false)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to schedule subject')
    }
  }

  const handleSaveMarks = async (e: React.FormEvent) => {
    e.preventDefault()
    // Enforce marks_obtained <= maxMarksAllowed validation
    for (const [stId, data] of Object.entries(marksState)) {
      if (Number(data.marks) > maxMarksAllowed || Number(data.marks) < 0) {
        toast.error(`Marks obtained (${data.marks}) cannot exceed maximum allowed marks (${maxMarksAllowed}) or be negative.`)
        return
      }
    }

    const records = Object.entries(marksState).map(([studentId, data]) => ({
      student_id: studentId,
      marks_obtained: Number(data.marks),
      remarks: data.remarks || undefined,
    }))

    try {
      await saveMarksMutation.mutateAsync({ records })
      toast.success('Student grades recorded successfully!')
      setActiveScheduleId('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save exam marks')
    }
  }

  const handleMarkChange = (studentId: string, field: 'marks' | 'remarks', value: any) => {
    setMarksState((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }))
  }

  const handleDownloadReportCard = (examId: string, studentId: string) => {
    const url = `${API_URL}/api/v1/exams/${examId}/report-card/${studentId}`
    window.open(url, '_blank')
  }

  // Student / Parent View
  if (isParentOrStudent) {
    return (
      <PageWrapper title="My Academic Evaluation Results" description="View term examination results, subject scores, CBSE grades, and download official report cards.">
        {isMyResultsLoading ? (
          <div className="flex h-48 items-center justify-center text-sm text-slate-400">Loading published exam results...</div>
        ) : myResults && myResults.length > 0 ? (
          <div className="space-y-6">
            {myResults.map((res: any) => (
              <div key={res.exam_id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{res.exam_name}</h3>
                    <p className="text-xs text-slate-500 capitalize">Type: {res.exam_type}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Final Grade & Result</div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-accent">{res.grade}</span>
                        <Badge variant={res.is_passed ? 'success' : 'danger'}>{res.is_passed ? 'PASSED' : 'NEEDS IMPROVEMENT'}</Badge>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownloadReportCard(res.exam_id, res.subject_marks?.[0]?.student_id || '')}
                      className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <Download className="h-4 w-4" />
                      Download Report Card (PDF)
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl">
                  <div>
                    <span className="text-xs text-slate-500">Total Marks Obtained</span>
                    <p className="text-base font-bold text-slate-900 dark:text-white">{res.total_obtained} / {res.total_max}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Percentage</span>
                    <p className="text-base font-bold text-emerald-600">{res.percentage}%</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">CBSE Grade</span>
                    <p className="text-base font-bold text-accent">{res.grade}</p>
                  </div>
                </div>

                <DataTable
                  columns={[
                    { accessorKey: 'subject_name', header: 'Subject Name', cell: ({ row }) => <span className="font-semibold">{row.original.subject_name}</span> },
                    { accessorKey: 'subject_code', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs">{row.original.subject_code}</span> },
                    { accessorKey: 'max_marks', header: 'Max Marks' },
                    { accessorKey: 'pass_marks', header: 'Pass Marks' },
                    {
                      accessorKey: 'marks_obtained',
                      header: 'Marks Obtained',
                      cell: ({ row }) => (
                        <span className={`font-bold ${row.original.marks_obtained < row.original.pass_marks ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {row.original.marks_obtained}
                        </span>
                      ),
                    },
                  ]}
                  data={res.subject_marks || []}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
            <FileText className="h-10 w-10 text-slate-300" />
            <h4 className="mt-4 text-base font-semibold">No Published Examination Results Yet</h4>
            <p className="mt-2 text-xs text-slate-500 max-w-sm">
              Official progress report cards will appear here once examination evaluations are completed and published by the administration.
            </p>
          </div>
        )}
      </PageWrapper>
    )
  }

  // Admin / Teacher Portal View
  return (
    <PageWrapper
      title="Examinations & Student Report Cards"
      description="Configure subject evaluations, input numeric marks, publish term grades, and issue printable report cards."
      actions={
        <button
          onClick={() => setIsAddExamOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create Exam
        </button>
      }
    >
      {/* Class & Section Filter Header */}
      <div className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
        <FormField label="Academic Year">
          <select
            value={selectedAcademicYear}
            onChange={(e) => {
              setSelectedAcademicYear(e.target.value)
              setSelectedClass('')
              setSelectedSection('')
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
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value)
              setSelectedSection('')
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">Select Class...</option>
            {classes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Filter by Section">
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            disabled={!selectedClass}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 disabled:opacity-50"
          >
            <option value="">Select Section...</option>
            {sections?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Exams List Sidebar */}
        <div className="md:col-span-1 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Active Examinations</h3>
            <div className="space-y-2">
              {isExamsLoading ? (
                <div className="h-20 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              ) : exams && exams.length > 0 ? (
                exams.map((exam) => (
                  <div
                    key={exam.id}
                    onClick={() => {
                      setSelectedExamId(exam.id)
                      setActiveScheduleId('')
                    }}
                    className={`w-full rounded-lg border p-3 cursor-pointer transition-all ${
                      selectedExamId === exam.id
                        ? 'border-accent bg-blue-50/30 dark:bg-blue-950/20'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'
                    }`}
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{exam.name}</div>
                    <div className="mt-1.5 flex items-center justify-between text-xs">
                      <span className="capitalize text-slate-500">{exam.exam_type}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePublishToggle(exam)
                        }}
                        className={`text-2xs font-semibold px-2 py-0.5 rounded ${
                          exam.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {exam.is_published ? 'Published' : 'Draft'}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">No exams created for this academic year.</div>
              )}
            </div>
          </div>
        </div>

        {/* Schedules & Grading Grid */}
        <div className="md:col-span-2 space-y-6">
          {selectedExamId ? (
            activeScheduleId ? (
              /* Marks Entry View */
              <form onSubmit={handleSaveMarks} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-white">Marks Entry Grid</h4>
                    <p className="mt-0.5 text-xs text-slate-500">Max Allowed Marks: <strong>{maxMarksAllowed}</strong></p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveScheduleId('')}
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    Back to Subject Schedules
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase text-slate-400 dark:border-slate-800">
                        <th className="py-2.5">Admission ID</th>
                        <th className="py-2.5">Student Name</th>
                        <th className="py-2.5 w-32">Marks Obtained</th>
                        <th className="py-2.5">Teacher Remarks</th>
                        <th className="py-2.5 text-right">Report Card</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isMarksLoading ? (
                        <tr><td colSpan={5} className="py-6 text-center text-xs animate-pulse">Loading enrolled section students...</td></tr>
                      ) : marksRecords && marksRecords.length > 0 ? (
                        marksRecords.map((m: any) => {
                          const state = marksState[m.student_id] || { marks: m.marks_obtained || 0, remarks: m.remarks || '' }
                          const isOverflow = state.marks > maxMarksAllowed
                          return (
                            <tr key={m.student_id} className="border-b border-slate-50 dark:border-slate-800/50">
                              <td className="py-3 font-mono text-xs">{m.admission_number}</td>
                              <td className="py-3 font-medium text-slate-800 dark:text-slate-200">{m.first_name} {m.last_name}</td>
                              <td className="py-3">
                                <input
                                  type="number"
                                  min={0}
                                  max={maxMarksAllowed}
                                  value={state.marks}
                                  onChange={(e) => handleMarkChange(m.student_id, 'marks', e.target.value)}
                                  className={`w-24 rounded border px-2 py-1 text-xs font-bold ${
                                    isOverflow
                                      ? 'border-rose-500 bg-rose-50 text-rose-700'
                                      : 'border-slate-300 dark:border-slate-700 dark:bg-slate-800'
                                  }`}
                                />
                                {isOverflow && <span className="block text-2xs text-rose-500 font-medium">Exceeds {maxMarksAllowed}!</span>}
                              </td>
                              <td className="py-3">
                                <input
                                  type="text"
                                  value={state.remarks}
                                  onChange={(e) => handleMarkChange(m.student_id, 'remarks', e.target.value)}
                                  placeholder="e.g. Excellent work"
                                  className="w-full max-w-xs rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                                />
                              </td>
                              <td className="py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadReportCard(selectedExamId, m.student_id)}
                                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-2xs font-semibold text-accent hover:bg-blue-50"
                                >
                                  <Download className="h-3 w-3" />
                                  PDF
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-xs text-slate-500">
                            No students found for this section.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveScheduleId('')}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save Grades
                  </button>
                </div>
              </form>
            ) : (
              /* Exam Schedule View */
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <h4 className="font-semibold text-slate-800 dark:text-white">Subject Evaluation Schedules</h4>
                  <button
                    onClick={() => {
                      if (!selectedSection) {
                        toast.error('Please select a class and section first.')
                        return
                      }
                      setIsScheduleOpen(true)
                    }}
                    className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Schedule Subject
                  </button>
                </div>

                <div className="space-y-3">
                  {isSchedulesLoading ? (
                    <div className="h-24 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                  ) : schedules && schedules.length > 0 ? (
                    schedules.map((s: any) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-xl border border-slate-150 p-4 dark:border-slate-800"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4.5 w-4.5 text-slate-400" />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {s.subject_name} ({s.subject_code})
                            </span>
                          </div>
                          <div className="mt-1 text-2xs text-slate-500">
                            Exam Date: {s.exam_date} · Max Marks: <strong>{s.max_marks}</strong> · Pass Marks: {s.pass_marks}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setActiveScheduleId(s.id)
                          }}
                          className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Marks Entry Grid
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-sm text-slate-400">
                      No subjects scheduled for this evaluation yet. Select a class & section filter and click "Schedule Subject".
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
              <AlertTriangle className="h-8 w-8 text-slate-300" />
              <h4 className="mt-4 text-sm font-semibold">Select an Evaluation Template</h4>
              <p className="mt-2 text-xs text-slate-500 max-w-sm">
                Select an active exam template from the sidebar to configure subject schedules, record student marks, and issue report cards.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Exam Modal */}
      {isAddExamOpen && (
        <Modal isOpen={true} onClose={() => setIsAddExamOpen(false)} title="Create Exam Evaluation">
          <form onSubmit={handleCreateExam} className="space-y-4">
            <FormField label="Evaluation Title" required>
              <input
                type="text"
                value={examForm.name}
                onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                placeholder="e.g. Mid-Term Examination 2026"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </FormField>
            <FormField label="Evaluation Type" required>
              <select
                value={examForm.exam_type}
                onChange={(e) => setExamForm({ ...examForm, exam_type: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              >
                <option value="Mid-Term">Mid-Term Examination</option>
                <option value="Unit-Test">Unit Test / Formative</option>
                <option value="Final-Term">Final Term Examination</option>
                <option value="Practical">Practical / Lab Viva</option>
              </select>
            </FormField>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setIsAddExamOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" disabled={createExamMutation.isPending} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Create Exam
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Schedule Subject Modal */}
      {isScheduleOpen && (
        <Modal isOpen={true} onClose={() => setIsScheduleOpen(false)} title="Schedule Subject Exam">
          <form onSubmit={handleCreateSchedule} className="space-y-4">
            <FormField label="Exam Date" required>
              <input
                type="date"
                value={scheduleForm.exam_date}
                onChange={(e) => setScheduleForm({ ...scheduleForm, exam_date: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Maximum Marks" required>
                <input
                  type="number"
                  value={scheduleForm.max_marks}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, max_marks: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
              <FormField label="Passing Marks" required>
                <input
                  type="number"
                  value={scheduleForm.pass_marks}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, pass_marks: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setIsScheduleOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" disabled={createScheduleMutation.isPending} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Schedule Subject
              </button>
            </div>
          </form>
        </Modal>
      )}
    </PageWrapper>
  )
}
