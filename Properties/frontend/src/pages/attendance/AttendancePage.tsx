import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Check, AlertCircle, Save, Info } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { FormField } from '@/components/shared/FormField'
import {
  useAcademicYears,
  useClasses,
  useSections,
  useStudents,
  useAttendance,
  useMarkAttendance,
} from '@/api/hooks'

export function AttendancePage() {
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  // Form records
  const [attendanceStates, setAttendanceStates] = useState<Record<string, string>>({})

  // API Hooks
  const { data: academicYears } = useAcademicYears()
  const { data: classes } = useClasses(selectedAcademicYear)
  const { data: sections } = useSections(selectedClass)

  // Fetch all students in this section
  const { data: studentsData, isLoading: isStudentsLoading } = useStudents(
    1,
    '',
    selectedSection,
    selectedAcademicYear
  )
  const students = studentsData?.data || []

  // Fetch existing attendance records
  const { data: existingRecords, isLoading: isAttendanceLoading } = useAttendance(
    selectedDate,
    selectedSection || undefined
  )

  const markAttendanceMutation = useMarkAttendance()

  // Initialize selected Academic Year
  if (!selectedAcademicYear && academicYears && academicYears.length > 0) {
    const current = academicYears.find((y) => y.is_current)
    setSelectedAcademicYear(current ? current.id : academicYears[0].id)
  }

  // Sync attendanceStates with existing records or default to "present"
  useEffect(() => {
    if (students.length === 0) return

    const initialStates: Record<string, string> = {}
    students.forEach((s) => {
      // Find existing record
      const exist = existingRecords?.find((r) => r.student_id === s.id)
      initialStates[s.id] = exist ? exist.status : 'present'
    })
    setAttendanceStates(initialStates)
  }, [students, existingRecords])

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendanceStates((prev) => ({
      ...prev,
      [studentId]: status,
    }))
  }

  const handleMarkAll = (status: string) => {
    const nextStates: Record<string, string> = {}
    students.forEach((s) => {
      nextStates[s.id] = status
    })
    setAttendanceStates(nextStates)
    toast.success(`All student states marked as '${status}'`)
  }

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSection) {
      toast.error('Please select a Class and Section first.')
      return
    }

    const records = Object.entries(attendanceStates).map(([studentId, status]) => ({
      student_id: studentId,
      status,
    }))

    try {
      await markAttendanceMutation.mutateAsync({
        section_id: selectedSection,
        academic_year_id: selectedAcademicYear,
        date: selectedDate,
        records,
      })
      toast.success('Attendance records saved successfully!')
    } catch {
      toast.error('Failed to save attendance logs')
    }
  }

  const isSaving = markAttendanceMutation.isPending
  const isDataLoading = isStudentsLoading || isAttendanceLoading

  return (
    <PageWrapper
      title="Attendance"
      description="Track student and class attendance registers."
    >
      {/* Filters Header */}
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
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
              <option value="">Select Year...</option>
              {academicYears?.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <div>
          <FormField label="Class">
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
        </div>
        <div>
          <FormField label="Section">
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
        <div>
          <FormField label="Select Date">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </FormField>
        </div>
      </div>

      {/* Info notice alert */}
      <div className="flex gap-2.5 rounded-lg border border-blue-200 bg-blue-50/50 p-3.5 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-accent" />
        <div>
          <p className="font-semibold">Parent Communication Alerts Linked</p>
          <p className="mt-0.5 text-slate-500 leading-normal">
            Saving attendance with ABSENT markers automatically sends real-time SMS alerts to the parents' registered primary contact numbers.
          </p>
        </div>
      </div>

      {/* Class register table list */}
      {selectedSection ? (
        <form onSubmit={handleSaveAttendance} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Bulk Status Operations:
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleMarkAll('present')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-success hover:bg-success/5 dark:border-slate-700 dark:bg-slate-800"
              >
                Mark All Present
              </button>
              <button
                type="button"
                onClick={() => handleMarkAll('absent')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/5 dark:border-slate-700 dark:bg-slate-800"
              >
                Mark All Absent
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3">Roll No</th>
                  <th className="px-6 py-3">Student Name</th>
                  <th className="px-6 py-3">Admission ID</th>
                  <th className="px-6 py-3 text-right">Attendance Status</th>
                </tr>
              </thead>
              <tbody>
                {isDataLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-6 py-4 animate-pulse"><div className="h-4 w-8 rounded bg-slate-200 dark:bg-slate-800" /></td>
                      <td className="px-6 py-4 animate-pulse"><div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-800" /></td>
                      <td className="px-6 py-4 animate-pulse"><div className="h-4.5 w-24 rounded bg-slate-200 dark:bg-slate-800" /></td>
                      <td className="px-6 py-4 text-right animate-pulse"><div className="h-6 w-32 rounded bg-slate-200 dark:bg-slate-800 ml-auto" /></td>
                    </tr>
                  ))
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      No students found in the selected section. Register students first.
                    </td>
                  </tr>
                ) : (
                  students.map((student) => {
                    const currentStatus = attendanceStates[student.id] || 'present'
                    return (
                      <tr
                        key={student.id}
                        className="border-t border-slate-100 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/30"
                      >
                        <td className="px-6 py-4 font-mono text-xs font-semibold">
                          {student.roll_number || '—'}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                          {student.first_name} {student.last_name}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">
                          {student.admission_number}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-800 dark:bg-slate-800/50">
                            {['present', 'absent', 'late', 'half_day'].map((status) => (
                              <button
                                key={status}
                                type="button"
                                onClick={() => handleStatusChange(student.id, status)}
                                className={`rounded px-2.5 py-1 text-2xs font-semibold capitalize transition-all ${
                                  currentStatus === status
                                    ? status === 'present'
                                      ? 'bg-success text-white shadow-sm'
                                      : status === 'absent'
                                      ? 'bg-danger text-white shadow-sm'
                                      : 'bg-accent text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                              >
                                {status.replace('_', ' ')}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving || students.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save Register
            </button>
          </div>
        </form>
      ) : (
        <div className="flex min-h-[250px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <AlertCircle className="h-8 w-8 text-slate-300 dark:text-slate-700" />
          <h3 className="mt-4 text-sm font-semibold">Select class filter</h3>
          <p className="mt-2 text-xs text-slate-500">
            Please choose an academic year, class, and section to load the daily attendance registry.
          </p>
        </div>
      )}
    </PageWrapper>
  )
}
