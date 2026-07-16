import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, BookOpen, Clock, FileDown, Eye, Award, CheckCircle } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { FormField } from '@/components/shared/FormField'
import { Modal } from '@/components/shared/Modal'
import { FileUpload } from '@/components/shared/FileUpload'
import { Badge } from '@/components/ui/Badge'
import {
  useAcademicYears,
  useClasses,
  useSections,
  useAssignments,
  useCreateAssignment,
  useSubmissions,
  useGradeSubmission,
} from '@/api/hooks'

export function LmsPage() {
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')

  // Modals state
  const [isAddAssignmentOpen, setIsAddAssignmentOpen] = useState(false)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null)
  
  // Grading state
  const [gradingSubmissionId, setGradingSubmissionId] = useState<string | null>(null)
  const [gradeMarks, setGradeMarks] = useState(100)
  const [gradeFeedback, setGradeFeedback] = useState('')

  // API Hooks
  const { data: academicYears } = useAcademicYears()
  const { data: classes } = useClasses(selectedAcademicYear)
  const { data: sections } = useSections(selectedClass)

  const { data: assignments, isLoading: isAssignmentsLoading } = useAssignments(selectedSection || undefined)
  const { data: submissions, isLoading: isSubmissionsLoading } = useSubmissions(selectedAssignmentId || undefined)

  const createAssignmentMutation = useCreateAssignment()
  const gradeSubmissionMutation = useGradeSubmission(gradingSubmissionId || '', selectedAssignmentId || '')

  // Initialize selected Academic Year
  if (!selectedAcademicYear && academicYears && academicYears.length > 0) {
    const current = academicYears.find((y) => y.is_current)
    setSelectedAcademicYear(current ? current.id : academicYears[0].id)
  }

  // Form inputs
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    description: '',
    due_date: '',
    subject_id: '00000000-0000-0000-0000-000000000000',
    file: null as File | null,
  })

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSection) {
      toast.error('Please select class section first.')
      return
    }

    try {
      await createAssignmentMutation.mutateAsync({
        section_id: selectedSection,
        subject_id: assignmentForm.subject_id,
        title: assignmentForm.title,
        description: assignmentForm.description || undefined,
        due_date: assignmentForm.due_date,
        file: assignmentForm.file || undefined,
      })
      toast.success('Assignment published successfully!')
      setIsAddAssignmentOpen(false)
      setAssignmentForm({
        title: '',
        description: '',
        due_date: '',
        subject_id: '00000000-0000-0000-0000-000000000000',
        file: null,
      })
    } catch {
      toast.error('Failed to publish assignment')
    }
  }

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!gradingSubmissionId) return
    try {
      await gradeSubmissionMutation.mutateAsync({
        marks_obtained: Number(gradeMarks),
        feedback: gradeFeedback || undefined,
      })
      toast.success('Submission graded successfully!')
      setGradingSubmissionId(null)
      setGradeFeedback('')
    } catch {
      toast.error('Failed to save grade decision')
    }
  }

  return (
    <PageWrapper
      title="Learning Management System"
      description="Publish courses and track homework submissions."
      actions={
        <button
          onClick={() => setIsAddAssignmentOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Publish Assignment
        </button>
      }
    >
      {/* Filter panel */}
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
      </div>

      {/* Main List Grid */}
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {isAssignmentsLoading ? (
          <div className="col-span-full h-32 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        ) : assignments && assignments.length > 0 ? (
          assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex items-center justify-between">
                  <Badge variant="info">Assignment</Badge>
                  <span className="flex items-center gap-1 text-3xs text-slate-400">
                    <Clock className="h-3 w-3" />
                    Due: {assignment.due_date}
                  </span>
                </div>
                <h4 className="mt-3.5 font-bold text-slate-800 dark:text-slate-100">{assignment.title}</h4>
                <p className="mt-1 text-xs text-slate-500 line-clamp-3">{assignment.description || 'No description'}</p>
              </div>

              <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                {assignment.file_url && (
                  <a
                    href={assignment.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white py-1.5 text-2xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Material
                  </a>
                )}
                <button
                  onClick={() => setSelectedAssignmentId(assignment.id)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-accent py-1.5 text-2xs font-semibold text-white hover:bg-blue-700"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Submissions
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-16 text-center text-sm text-slate-400">
            No assignments published for this section. Create one using the action button.
          </div>
        )}
      </div>

      {/* Publish Assignment Modal */}
      {isAddAssignmentOpen && (
        <Modal isOpen={true} onClose={() => setIsAddAssignmentOpen(false)} title="Publish Homework Assignment">
          <form onSubmit={handleCreateAssignment} className="space-y-4">
            <FormField label="Assignment Title" required>
              <input
                type="text"
                value={assignmentForm.title}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                placeholder="e.g. Linear Equations Homework"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </FormField>
            <FormField label="Description">
              <textarea
                value={assignmentForm.description}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                placeholder="Details or guidelines..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                rows={3}
              />
            </FormField>
            <FormField label="Due Date" required>
              <input
                type="date"
                value={assignmentForm.due_date}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, due_date: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </FormField>
            <FormField label="Upload Sheet Attachment">
              <FileUpload
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                maxSize={10}
                onUpload={(files) => {
                  if (files.length > 0) setAssignmentForm((prev) => ({ ...prev, file: files[0] }))
                }}
              />
            </FormField>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddAssignmentOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createAssignmentMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Publish Assignment
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Submissions Modal */}
      {selectedAssignmentId && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedAssignmentId(null)}
          title="Student Submissions"
          size="lg"
        >
          <div className="space-y-4">
            {isSubmissionsLoading ? (
              <div className="py-8 text-center text-xs animate-pulse">Loading responses...</div>
            ) : submissions && submissions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase text-slate-400 dark:border-slate-800">
                      <th className="py-2">Student ID</th>
                      <th className="py-2">Submitted On</th>
                      <th className="py-2">Attachment</th>
                      <th className="py-2">Score</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub) => (
                      <tr key={sub.id} className="border-b border-slate-50 dark:border-slate-800/50">
                        <td className="py-2.5 font-mono text-xs">{sub.student_id.substring(0, 8)}...</td>
                        <td className="py-2.5 text-xs">{sub.submission_date}</td>
                        <td className="py-2.5">
                          <a
                            href={sub.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-accent hover:underline"
                          >
                            View File
                          </a>
                        </td>
                        <td className="py-2.5">
                          {sub.marks_obtained !== null ? (
                            <span className="font-semibold text-success">{sub.marks_obtained}</span>
                          ) : (
                            <span className="text-slate-400">Not Graded</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => {
                              setGradingSubmissionId(sub.id)
                              setGradeMarks(sub.marks_obtained || 100)
                              setGradeFeedback(sub.feedback || '')
                            }}
                            className="flex items-center gap-1 rounded border border-slate-350 bg-white px-2 py-1 text-2xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 ml-auto"
                          >
                            <Award className="h-3 w-3" />
                            Grade
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-slate-500">
                No submissions uploaded by students for this assignment yet.
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Grading Form Modal */}
      {gradingSubmissionId && (
        <Modal
          isOpen={true}
          onClose={() => setGradingSubmissionId(null)}
          title="Grade Assignment Response"
        >
          <form onSubmit={handleGradeSubmit} className="space-y-4">
            <FormField label="Marks Awarded" required>
              <input
                type="number"
                value={gradeMarks}
                onChange={(e) => setGradeMarks(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </FormField>
            <FormField label="Feedback Notes">
              <textarea
                value={gradeFeedback}
                onChange={(e) => setGradeFeedback(e.target.value)}
                placeholder="Notes for student..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                rows={3}
              />
            </FormField>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setGradingSubmissionId(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={gradeSubmissionMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Submit Grade
              </button>
            </div>
          </form>
        </Modal>
      )}
    </PageWrapper>
  )
}
