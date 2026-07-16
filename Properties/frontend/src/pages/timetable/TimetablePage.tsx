import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Calendar, Trash2, Plus } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { Modal } from '@/components/shared/Modal'
import { FormField } from '@/components/shared/FormField'
import {
  useAcademicYears,
  useClasses,
  useSections,
  useTeachers,
  useSubjects,
  useTimetable,
  useCreateTimetableEntry,
  useDeleteTimetableEntry,
} from '@/api/hooks'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function TimetablePage() {
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')

  const { data: academicYears } = useAcademicYears()
  const { data: classes } = useClasses(selectedAcademicYear)
  const { data: sections } = useSections(selectedClass)
  const { data: teachers } = useTeachers()
  const { data: subjects } = useSubjects()
  
  const { data: timetable, isLoading } = useTimetable(selectedClass, selectedSection)
  const createEntryMutation = useCreateTimetableEntry()
  const deleteEntryMutation = useDeleteTimetableEntry(selectedClass, selectedSection)

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [formValues, setFormValues] = useState({
    day_of_week: 'Monday',
    start_time: '09:00 AM',
    end_time: '09:45 AM',
    subject_id: '',
    teacher_id: '',
    room_number: '',
  })

  useEffect(() => {
    if (!selectedAcademicYear && academicYears && academicYears.length > 0) {
      const current = academicYears.find((y) => y.is_current)
      setSelectedAcademicYear(current ? current.id : academicYears[0].id)
    }
  }, [academicYears, selectedAcademicYear])

  useEffect(() => {
    if (classes && classes.length > 0 && !selectedClass) {
      setSelectedClass(classes[0].id)
    }
  }, [classes, selectedClass])

  useEffect(() => {
    if (sections && sections.length > 0 && !selectedSection) {
      setSelectedSection(sections[0].id)
    }
  }, [sections, selectedSection])

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClass || !selectedSection) {
      toast.error('Please select class and section first')
      return
    }
    if (!formValues.subject_id || !formValues.teacher_id) {
      toast.error('Subject and Teacher are required')
      return
    }

    try {
      await createEntryMutation.mutateAsync({
        ...formValues,
        class_id: selectedClass,
        section_id: selectedSection,
      })
      toast.success('Timetable entry created successfully')
      setIsAddModalOpen(false)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save entry')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this timetable entry?')) return
    try {
      await deleteEntryMutation.mutateAsync(id)
      toast.success('Timetable entry deleted')
    } catch {
      toast.error('Failed to delete entry')
    }
  }

  // Group entries by day
  const groupedTimetable: Record<string, any[]> = DAYS.reduce((acc, day) => {
    acc[day] = timetable ? timetable.filter((t: any) => t.day_of_week === day) : []
    // Sort by start_time
    acc[day].sort((a: any, b: any) => a.start_time.localeCompare(b.start_time))
    return acc;
  }, {} as Record<string, any[]>)

  return (
    <PageWrapper
      title="Timetable"
      description="Design and manage school schedules, subject slots, and teacher allocations."
      actions={
        <button
          onClick={() => {
            if (subjects && subjects.length > 0) setFormValues(prev => ({ ...prev, subject_id: subjects[0].id }))
            if (teachers && teachers.length > 0) setFormValues(prev => ({ ...prev, teacher_id: teachers[0].user_id }))
            setIsAddModalOpen(true)
          }}
          disabled={!selectedClass || !selectedSection}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add Class Slot
        </button>
      }
    >
      <div className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3">
          <FormField label="Academic Year">
            <select
              value={selectedAcademicYear}
              onChange={(e) => {
                setSelectedAcademicYear(e.target.value)
                setSelectedClass('')
                setSelectedSection('')
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {academicYears?.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.is_current ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Class">
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value)
                setSelectedSection('')
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">Select Class</option>
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Section">
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">Select Section</option>
              {sections?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {/* Schedule Grid */}
        {isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">Loading Timetable...</div>
        ) : !selectedClass || !selectedSection ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <Calendar className="h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm text-slate-500">Please select Class and Section to view the timetable.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {DAYS.map((day) => (
              <div key={day} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="border-b border-slate-100 pb-2 font-semibold text-slate-900 dark:border-slate-800 dark:text-white">
                  {day}
                </h3>
                <div className="mt-4 space-y-3">
                  {groupedTimetable[day].length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-400">No classes scheduled</p>
                  ) : (
                    groupedTimetable[day].map((slot: any) => (
                      <div key={slot.id} className="group relative flex flex-col rounded-lg bg-slate-50 p-3 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800">
                        <div className="flex items-start justify-between">
                          <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                            {slot.subject_name}
                          </span>
                          <button
                            onClick={() => handleDelete(slot.id)}
                            className="opacity-0 group-hover:opacity-100 rounded p-1 text-slate-400 hover:text-red-600"
                            title="Delete Slot"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                          Teacher: {slot.teacher_name}
                        </span>
                        <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-slate-500">
                          <span>🕒 {slot.start_time} - {slot.end_time}</span>
                          {slot.room_number && <span>Room: {slot.room_number}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Schedule Class Slot"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <FormField label="Day of Week" required>
            <select
              value={formValues.day_of_week}
              onChange={(e) => setFormValues({ ...formValues, day_of_week: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Time" required>
              <input
                type="text"
                required
                placeholder="e.g., 09:00 AM"
                value={formValues.start_time}
                onChange={(e) => setFormValues({ ...formValues, start_time: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </FormField>
            <FormField label="End Time" required>
              <input
                type="text"
                required
                placeholder="e.g., 09:45 AM"
                value={formValues.end_time}
                onChange={(e) => setFormValues({ ...formValues, end_time: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </FormField>
          </div>

          <FormField label="Subject" required>
            <select
              value={formValues.subject_id}
              onChange={(e) => setFormValues({ ...formValues, subject_id: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">Select Subject</option>
              {subjects?.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Teacher" required>
            <select
              value={formValues.teacher_id}
              onChange={(e) => setFormValues({ ...formValues, teacher_id: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">Select Teacher</option>
              {teachers?.map((t: any) => (
                <option key={t.user_id} value={t.user_id}>
                  {t.first_name} {t.last_name} ({t.department})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Room Number">
            <input
              type="text"
              placeholder="e.g., 101"
              value={formValues.room_number}
              onChange={(e) => setFormValues({ ...formValues, room_number: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Save Schedule
            </button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  )
}
