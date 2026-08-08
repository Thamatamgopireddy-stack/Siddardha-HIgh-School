import { useState } from 'react'
import { toast } from 'sonner'
import { FileText, Calendar, Plus, Save, BookOpen, UserCheck, AlertTriangle, Upload } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { FormField } from '@/components/shared/FormField'
import { Modal } from '@/components/shared/Modal'
import { ExcelImportModal } from '@/components/shared/ExcelImportModal'
import { Badge } from '@/components/ui/Badge'
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
  useBulkImportExamMarksExcel,
} from '@/api/hooks'

export function ExaminationsPage() {
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')

  // Selected state for scheduling/grading details
  const [selectedExamId, setSelectedExamId] = useState<string>('')
  const [activeScheduleId, setActiveScheduleId] = useState<string>('')

  // Modals state
  const [isAddExamOpen, setIsAddExamOpen] = useState(false)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false)

  const bulkImportMarksMutation = useBulkImportExamMarksExcel()


  // Marks Entry Form state
  const [marksState, setMarksState] = useState<Record<string, { marks: number; remarks: string }>>({})

  // API hooks
  const { data: academicYears } = useAcademicYears()
  const { data: classes } = useClasses(selectedAcademicYear)
  const { data: sections } = useSections(selectedClass)

  const { data: exams, isLoading: isExamsLoading } = useExams(selectedAcademicYear)
  const { data: schedules, isLoading: isSchedulesLoading } = useExamSchedules(selectedExamId || undefined)
  const { data: marksRecords, isLoading: isMarksLoading } = useScheduleMarks(activeScheduleId || undefined)

  const createExamMutation = useCreateExam()
  const createScheduleMutation = useCreateExamSchedule(selectedExamId)
  const saveMarksMutation = useSaveScheduleMarks(activeScheduleId)

  // Initialize selected Academic Year
  if (!selectedAcademicYear && academicYears && academicYears.length > 0) {
    const current = academicYears.find((y) => y.is_current)
    setSelectedAcademicYear(current ? current.id : academicYears[0].id)
  }

  // Sync marks state when records load
  useState(() => {
    if (!marksRecords) return
    const initial: Record<string, { marks: number; remarks: string }> = {}
    marksRecords.forEach((m) => {
      initial[m.student_id] = {
        marks: m.marks_obtained !== null ? m.marks_obtained : 0,
        remarks: m.remarks || '',
      }
    })
    setMarksState(initial)
  })

  // Hook to handle initialization of marksState
  useState(() => {
    if (!marksRecords) return
    const states: Record<string, { marks: number; remarks: string }> = {}
    marksRecords.forEach((r) => {
      states[r.student_id] = {
        marks: r.marks_obtained !== null ? r.marks_obtained : 0,
        remarks: r.remarks || '',
      }
    })
    setMarksState(states)
  })

  // Sync state whenever marksRecords changes
  useState(() => {
    if (!marksRecords) return
    const initial: Record<string, { marks: number; remarks: string }> = {}
    marksRecords.forEach((r) => {
      initial[r.student_id] = {
        marks: r.marks_obtained !== null ? r.marks_obtained : 0,
        remarks: r.remarks || '',
      }
    })
    setMarksState(initial)
  })

  // Form inputs
  const [examForm, setExamForm] = useState({ name: '', exam_type: 'term_exam' })
  const [scheduleForm, setScheduleForm] = useState({
    subject_id: '',
    section_id: '',
    exam_date: '',
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
      toast.success('Exam entry created successfully!')
      setIsAddExamOpen(false)
      setExamForm({ name: '', exam_type: 'term_exam' })
    } catch {
      toast.error('Failed to create exam')
    }
  }

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSection) {
      toast.error('Please select class section first.')
      return
    }
    try {
      // Mock subject_id using a dummy/stub ID if subjects aren't loaded yet
      const dummySubjectId = '00000000-0000-0000-0000-000000000000'
      await createScheduleMutation.mutateAsync({
        subject_id: scheduleForm.subject_id || dummySubjectId,
        section_id: selectedSection,
        exam_date: scheduleForm.exam_date,
        max_marks: Number(scheduleForm.max_marks),
        pass_marks: Number(scheduleForm.pass_marks),
      })
      toast.success('Subject scheduled successfully!')
      setIsScheduleOpen(false)
    } catch {
      toast.error('Failed to schedule subject')
    }
  }

  const handleSaveMarks = async (e: React.FormEvent) => {
    e.preventDefault()
    const records = Object.entries(marksState).map(([studentId, data]) => ({
      student_id: studentId,
      marks_obtained: Number(data.marks),
      remarks: data.remarks || undefined,
    }))

    try {
      await saveMarksMutation.mutateAsync({ records })
      toast.success('Student grades successfully recorded!')
      setActiveScheduleId('')
    } catch {
      toast.error('Failed to save exam marks')
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

  return (
    <PageWrapper
      title="Examinations"
      description="Configure subject evaluation templates and grade logs."
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Upload className="h-4 w-4" /> Import Marks Excel
          </button>
          <button
            onClick={() => setIsAddExamOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create Exam Template
          </button>
        </div>
      }
    >
      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        title="Exam Marks Excel Import"
        description="Upload an Excel sheet (.xlsx, .xls) or CSV file with student marks for the selected schedule."
        templateUrl="/exams/marks/bulk-template"
        templateFileName="exam_marks_import_template.xlsx"
        onImport={async (file) => {
          if (!activeScheduleId) {
            throw new Error('Please select a subject evaluation schedule to grade before uploading marks.')
          }
          return await bulkImportMarksMutation.mutateAsync({
            file,
            scheduleId: activeScheduleId,
          })
        }}
      />

      {/* Filters Header */}
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <FormField label="Academic Year">
            <select
              value={selectedAcademicYear}
              onChange={(e) => setSelectedAcademicYear(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {academicYears?.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <div>
          <FormField label="Class Filter">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
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
        </div>
        <div>
          <FormField label="Section Filter">
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
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
        <div className="flex items-end">
          <div className="text-2xs text-slate-500 pb-2">
            * Filters automatically narrow evaluation registers.
          </div>
        </div>
      </div>

      {/* Main Panel Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Exams List Sidebar Column */}
        <div className="md:col-span-1 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Active Evaluations</h3>
            <div className="space-y-2">
              {isExamsLoading ? (
                <div className="h-20 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              ) : exams && exams.length > 0 ? (
                exams.map((exam) => (
                  <button
                    key={exam.id}
                    onClick={() => {
                      setSelectedExamId(exam.id)
                      setActiveScheduleId('')
                    }}
                    className={`w-full rounded-lg border p-3 text-left transition-all ${
                      selectedExamId === exam.id
                        ? 'border-accent bg-blue-50/20 dark:bg-blue-950/10'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'
                    }`}
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{exam.name}</div>
                    <div className="mt-1 flex items-center justify-between text-2xs text-slate-500">
                      <span className="capitalize">{exam.exam_type.replace('_', ' ')}</span>
                      {exam.is_published ? (
                        <Badge variant="success">Published</Badge>
                      ) : (
                        <Badge variant="neutral">Draft</Badge>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">No exams created for this year.</div>
              )}
            </div>
          </div>
        </div>

        {/* Evaluation Schedules and Grading Panels Column */}
        <div className="md:col-span-2 space-y-6">
          {selectedExamId ? (
            activeScheduleId ? (
              /* Marks Entry View */
              <form onSubmit={handleSaveMarks} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-white">Enter Evaluation Marks</h4>
                    <p className="mt-0.5 text-xs text-slate-500">Log scores obtained by the students.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveScheduleId('')}
                    className="text-xs font-semibold text-slate-500 hover:underline"
                  >
                    Back to Schedules
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase text-slate-400 dark:border-slate-800">
                        <th className="py-2.5">Roll No</th>
                        <th className="py-2.5">Name</th>
                        <th className="py-2.5 w-32">Marks Obtained</th>
                        <th className="py-2.5">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isMarksLoading ? (
                        <tr><td colSpan={4} className="py-6 text-center text-xs animate-pulse">Loading class list...</td></tr>
                      ) : marksRecords && marksRecords.length > 0 ? (
                        marksRecords.map((m) => {
                          const state = marksState[m.student_id] || { marks: 0, remarks: '' }
                          return (
                            <tr key={m.student_id} className="border-b border-slate-50 dark:border-slate-800/50">
                              <td className="py-3 font-mono text-xs">{m.roll_number || '—'}</td>
                              <td className="py-3 font-medium text-slate-800 dark:text-slate-200">{m.first_name} {m.last_name}</td>
                              <td className="py-3">
                                <input
                                  type="number"
                                  min={0}
                                  value={state.marks}
                                  onChange={(e) => handleMarkChange(m.student_id, 'marks', e.target.value)}
                                  className="w-20 rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                                />
                              </td>
                              <td className="py-3">
                                <input
                                  type="text"
                                  value={state.remarks}
                                  onChange={(e) => handleMarkChange(m.student_id, 'remarks', e.target.value)}
                                  placeholder="remarks..."
                                  className="w-full max-w-xs rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                                />
                              </td>
                            </tr>
                          )
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-xs text-slate-500">
                            No students loaded. Ensure section filter matches.
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
                  <h4 className="font-semibold text-slate-800 dark:text-white">Exam Subject Schedule</h4>
                  <button
                    onClick={() => setIsScheduleOpen(true)}
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
                    schedules.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-xl border border-slate-150 p-4 dark:border-slate-800"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4.5 w-4.5 text-slate-400" />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              Subject ID: {s.subject_id}
                            </span>
                          </div>
                          <div className="mt-1 text-2xs text-slate-500">
                            Date: {s.exam_date} · Max Marks: {s.max_marks} · Pass Marks: {s.pass_marks}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setActiveScheduleId(s.id)
                          }}
                          className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-2xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Grade Entry
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-sm text-slate-400">
                      No subjects scheduled for this evaluation yet.
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
              <AlertTriangle className="h-8 w-8 text-slate-300" />
              <h4 className="mt-4 text-sm font-semibold">Select Evaluation template</h4>
              <p className="mt-2 text-xs text-slate-500">
                Please select an active evaluation template from the sidebar to configure subject schedules and enter scores.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Exam Modal */}
      {isAddExamOpen && (
        <Modal isOpen={true} onClose={() => setIsAddExamOpen(false)} title="Create Exam Template">
          <form onSubmit={handleCreateExam} className="space-y-4">
            <FormField label="Evaluation Name" required>
              <input
                type="text"
                value={examForm.name}
                onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                placeholder="e.g. First Terminal Examination"
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
                <option value="term_exam">Term Exam</option>
                <option value="unit_test">Unit Test</option>
                <option value="practical">Practical / Viva</option>
                <option value="final_exam">Final Semester Exam</option>
              </select>
            </FormField>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddExamOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createExamMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create Template
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Schedule Subject Modal */}
      {isScheduleOpen && (
        <Modal isOpen={true} onClose={() => setIsScheduleOpen(false)} title="Schedule Subject Exam">
          <form onSubmit={handleCreateSchedule} className="space-y-4">
            <FormField label="Select Date" required>
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
              <button
                type="button"
                onClick={() => setIsScheduleOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createScheduleMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Schedule Subject
              </button>
            </div>
          </form>
        </Modal>
      )}
    </PageWrapper>
  )
}
