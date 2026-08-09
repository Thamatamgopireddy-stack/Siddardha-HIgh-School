import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { APIResponse, LoginResponse, Student, User } from '@/types'
import { useAuthStore } from '@/store'

// Auth hooks
export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth)
  return useMutation({
    mutationFn: async (credentials: { email_or_phone: string; password: string }) => {
      const { data } = await api.post<APIResponse<LoginResponse>>('/auth/login', credentials)
      return data.data
    },
    onSuccess: async (data) => {
      setAuth(data.user, data.access_token, data.refresh_token)
      try {
        const me = await api.get<APIResponse<User & { permissions: string[] }>>('/auth/me')
        useAuthStore.getState().setPermissions(me.data?.data?.permissions || [])
      } catch {
        useAuthStore.getState().setPermissions([])
      }
    },
  })
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<User & { permissions: string[] }>>('/auth/me')
      useAuthStore.getState().setPermissions(data.data.permissions || [])
      return data.data
    },
    retry: false,
  })
}

// Academic Configuration hooks
export function useAcademicYears() {
  return useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/students/academic/years')
      return data.data || []
    },
  })
}

export function useClasses(academicYearId?: string) {
  return useQuery({
    queryKey: ['classes', academicYearId],
    queryFn: async () => {
      if (!academicYearId) return []
      const { data } = await api.get<APIResponse<any[]>>('/students/academic/classes', {
        params: { academic_year_id: academicYearId },
      })
      return data.data || []
    },
    enabled: !!academicYearId,
  })
}

export function useSections(classId?: string) {
  return useQuery({
    queryKey: ['sections', classId || 'all'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/students/academic/sections', {
        params: classId ? { class_id: classId } : {},
      })
      return data.data || []
    },
  })
}

// Student CRUD hooks
export function useStudents(page = 1, search = '', sectionId = '', academicYearId = '', limit = 20, classId = '') {
  return useQuery({
    queryKey: ['students', page, search, sectionId, academicYearId, limit, classId],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<Student[]>>('/students', {
        params: {
          page,
          limit,
          search: search || undefined,
          section_id: sectionId || undefined,
          class_id: classId || undefined,
          academic_year_id: academicYearId || undefined,
        },
      })
      return data
    },
  })
}

export function useStudent(id?: string) {
  return useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      if (!id) return null
      const { data } = await api.get<APIResponse<Student>>(`/students/${id}`)
      return data.data
    },
    enabled: !!id,
  })
}

export function useCreateStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Student>) => {
      const { data } = await api.post<APIResponse<Student>>('/students', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })
}

export function useUpdateStudent(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Student>) => {
      const { data } = await api.put<APIResponse<Student>>(`/students/${id}`, payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['student', id] })
    },
  })
}

export function useDeleteStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete<APIResponse<any>>(`/students/${id}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })
}

export function useUploadPhoto(studentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post<APIResponse<{ url: string }>>(`/students/${studentId}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] })
    },
  })
}

// Student Document hooks
export function useStudentDocuments(studentId?: string) {
  return useQuery({
    queryKey: ['student-documents', studentId],
    queryFn: async () => {
      if (!studentId) return []
      const { data } = await api.get<APIResponse<any[]>>(`/students/${studentId}/documents`)
      return data.data || []
    },
    enabled: !!studentId,
  })
}

export function useUploadDocument(studentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { type: string; file: File }) => {
      const formData = new FormData()
      formData.append('document_type', payload.type)
      formData.append('file', payload.file)
      const { data } = await api.post<APIResponse<any>>(`/students/${studentId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-documents', studentId] })
    },
  })
}

export function useDeleteDocument(studentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (docId: string) => {
      const { data } = await api.delete<APIResponse<any>>(`/students/${studentId}/documents/${docId}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-documents', studentId] })
    },
  })
}

// Promotion hooks
export function usePromoteStudent(studentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { target_academic_year_id: string; target_section_id: string; roll_number?: string }) => {
      const { data } = await api.post<APIResponse<any>>(`/students/${studentId}/promote`, payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })
}

// Bulk Import
export function useBulkImportStudents() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { file: File; academicYearId: string; classId?: string; sectionId?: string }) => {
      const formData = new FormData()
      formData.append('file', payload.file)
      formData.append('academic_year_id', payload.academicYearId)
      if (payload.classId) {
        formData.append('class_id', payload.classId)
      }
      if (payload.sectionId) {
        formData.append('section_id', payload.sectionId)
      }
      const { data } = await api.post<APIResponse<{ imported: number; errors: string[] }>>('/students/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })
}

export function useBulkImportTeachers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post<APIResponse<{ imported: number; errors: string[] }>>('/teachers/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
    },
  })
}

export function useBulkImportStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post<APIResponse<{ imported: number; errors: string[] }>>('/hr/staff/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}

export function useBulkImportAdmissions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { file: File; academicYearId: string; applyingForClassId: string }) => {
      const formData = new FormData()
      formData.append('file', payload.file)
      const { data } = await api.post<APIResponse<{ imported: number; errors: string[] }>>(
        `/admissions/bulk-import?academic_year_id=${payload.academicYearId}&applying_for_class_id=${payload.applyingForClassId}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] })
    },
  })
}

export function useBulkImportAttendanceExcel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { file: File; sectionId: string; academicYearId: string }) => {
      const formData = new FormData()
      formData.append('file', payload.file)
      const { data } = await api.post<APIResponse<{ imported: number; errors: string[] }>>(
        `/attendance/bulk-import-excel?section_id=${payload.sectionId}&academic_year_id=${payload.academicYearId}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
  })
}

export function useBulkImportExamMarksExcel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { file: File; scheduleId: string }) => {
      const formData = new FormData()
      formData.append('file', payload.file)
      const { data } = await api.post<APIResponse<{ imported: number; errors: string[] }>>(
        `/exams/schedules/${payload.scheduleId}/marks/bulk-import-excel`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-marks'] })
    },
  })
}

export function useBulkImportFeeCollectionsExcel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post<APIResponse<{ imported: number; errors: string[] }>>(
        '/fees/collections/bulk-import-excel',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees'] })
      queryClient.invalidateQueries({ queryKey: ['student-fee-summaries'] })
    },
  })
}

export function useBulkImportLibraryBooksExcel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post<APIResponse<{ imported: number; errors: string[] }>>(
        '/ancillary/library/books/bulk-import-excel',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] })
    },
  })
}

export function useBulkImportTransportRoutesExcel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post<APIResponse<{ imported: number; errors: string[] }>>(
        '/ancillary/transport/routes/bulk-import-excel',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport-routes'] })
    },
  })
}

export function useBulkImportHostelRoomsExcel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post<APIResponse<{ imported: number; errors: string[] }>>(
        '/ancillary/hostel/rooms/bulk-import-excel',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostel-rooms'] })
    },
  })
}


export function useImportStudentsFromGoogleSheets() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { spreadsheetId: string; rangeName: string; academicYearId: string; sectionId?: string }) => {
      const { data } = await api.post<APIResponse<{ imported: number; errors: string[] }>>('/students/google-sheets-import', {
        spreadsheet_id: payload.spreadsheetId,
        range_name: payload.rangeName,
        academic_year_id: payload.academicYearId,
        section_id: payload.sectionId || undefined,
      })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })
}

// Timeline audit trail hooks
export function useStudentTimeline(studentId?: string) {
  return useQuery({
    queryKey: ['student-timeline', studentId],
    queryFn: async () => {
      if (!studentId) return []
      const { data } = await api.get<APIResponse<any[]>>(`/students/${studentId}/timeline`)
      return data.data || []
    },
    enabled: !!studentId,
  })
}

// Provision Portal Access
export function useProvisionPortalAccess() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (studentId: string) => {
      const { data } = await api.post<APIResponse<any>>(`/students/${studentId}/portal-access`)
      return data.data
    },
    onSuccess: (_, studentId) => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })
}

// Admissions Hooks
export function useAdmissions(page = 1, search = '', status = '') {
  return useQuery({
    queryKey: ['admissions', page, search, status],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/admissions', {
        params: {
          page,
          limit: 20,
          search: search || undefined,
          status: status || undefined,
        },
      })
      return data
    },
  })
}

export function useAdmission(id?: string) {
  return useQuery({
    queryKey: ['admission', id],
    queryFn: async () => {
      if (!id) return null
      const { data } = await api.get<APIResponse<any>>(`/admissions/${id}`)
      return data.data
    },
    enabled: !!id,
  })
}

export function useCreateAdmission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post<APIResponse<any>>('/admissions', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] })
    },
  })
}

export function useUpdateAdmission(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.put<APIResponse<any>>(`/admissions/${id}`, payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] })
      queryClient.invalidateQueries({ queryKey: ['admission', id] })
    },
  })
}

export function useOCROnDocument() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post<APIResponse<any>>('/admissions/ocr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data.data
    },
  })
}

export function useConvertAdmissionToStudent(admissionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { section_id: string; roll_number?: string }) => {
      const { data } = await api.post<APIResponse<any>>(
        `/admissions/${admissionId}/convert`,
        null,
        {
          params: {
            section_id: params.section_id,
            roll_number: params.roll_number || undefined,
          },
        }
      )
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })
}

export function useSyncToSheets() {
  return useMutation({
    mutationFn: async (payload: { spreadsheet_id: string; module: string }) => {
      const { data } = await api.post<APIResponse<any>>('/integrations/gsheets/sync', payload)
      return data
    },
  })
}

export function useAttendance(dateVal: string, sectionId?: string) {
  return useQuery({
    queryKey: ['attendance', dateVal, sectionId],
    queryFn: async () => {
      if (!sectionId) return []
      const { data } = await api.get<APIResponse<any[]>>('/attendance', {
        params: { date: dateVal, section_id: sectionId },
      })
      return data.data || []
    },
    enabled: !!sectionId,
  })
}

export function useMarkAttendance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      section_id: string
      academic_year_id: string
      date: string
      records: { student_id: string; status: string }[]
    }) => {
      const { data } = await api.post<APIResponse<any>>('/attendance/bulk', payload)
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['attendance', variables.date, variables.section_id],
      })
      queryClient.invalidateQueries({
        queryKey: ['dashboard-stats'],
      })
    },
  })
}

// Exams Hooks
export function useExams(academicYearId?: string) {
  return useQuery({
    queryKey: ['exams', academicYearId],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/exams', {
        params: { academic_year_id: academicYearId || undefined },
      })
      return data.data || []
    },
  })
}

export function useCreateExam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { academic_year_id: string; name: string; exam_type: string }) => {
      const { data } = await api.post<APIResponse<any>>('/exams', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] })
    },
  })
}

export function useExamSchedules(examId?: string) {
  return useQuery({
    queryKey: ['exam-schedules', examId],
    queryFn: async () => {
      if (!examId) return []
      const { data } = await api.get<APIResponse<any[]>>(`/exams/${examId}/schedules`)
      return data.data || []
    },
    enabled: !!examId,
  })
}

export function useCreateExamSchedule(examId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { subject_id: string; section_id: string; exam_date: string; max_marks: number; pass_marks: number }) => {
      const { data } = await api.post<APIResponse<any>>(`/exams/${examId}/schedules`, payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-schedules', examId] })
    },
  })
}

export function useScheduleMarks(scheduleId?: string) {
  return useQuery({
    queryKey: ['schedule-marks', scheduleId],
    queryFn: async () => {
      if (!scheduleId) return []
      const { data } = await api.get<APIResponse<any[]>>(`/exams/schedules/${scheduleId}/marks`)
      return data.data || []
    },
    enabled: !!scheduleId,
  })
}

export function useSaveScheduleMarks(scheduleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { records: { student_id: string; marks_obtained: number; remarks?: string }[] }) => {
      const { data } = await api.post<APIResponse<any>>(`/exams/schedules/${scheduleId}/marks`, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-marks', scheduleId] })
    },
  })
}

// LMS Hooks
export function useAssignments(sectionId?: string, subjectId?: string) {
  return useQuery({
    queryKey: ['assignments', sectionId, subjectId],
    queryFn: async () => {
      if (!sectionId) return []
      const { data } = await api.get<APIResponse<any[]>>('/exams/lms/assignments', {
        params: { section_id: sectionId, subject_id: subjectId || undefined },
      })
      return data.data || []
    },
    enabled: !!sectionId,
  })
}

export function useCreateAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { section_id: string; subject_id: string; title: string; description?: string; due_date: string; file?: File }) => {
      const formData = new FormData()
      formData.append('section_id', payload.section_id)
      formData.append('subject_id', payload.subject_id)
      formData.append('title', payload.title)
      if (payload.description) formData.append('description', payload.description)
      formData.append('due_date', payload.due_date)
      if (payload.file) formData.append('file', payload.file)

      const { data } = await api.post<APIResponse<any>>('/exams/lms/assignments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assignments', variables.section_id] })
    },
  })
}

export function useSubmissions(assignmentId?: string) {
  return useQuery({
    queryKey: ['assignment-submissions', assignmentId],
    queryFn: async () => {
      if (!assignmentId) return []
      const { data } = await api.get<APIResponse<any[]>>(`/exams/lms/assignments/${assignmentId}/submissions`)
      return data.data || []
    },
    enabled: !!assignmentId,
  })
}

export function useSubmitAssignment(assignmentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { student_id: string; file: File }) => {
      const formData = new FormData()
      formData.append('student_id', payload.student_id)
      formData.append('file', payload.file)

      const { data } = await api.post<APIResponse<any>>(`/exams/lms/assignments/${assignmentId}/submissions`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-submissions', assignmentId] })
    },
  })
}

export function useGradeSubmission(submissionId: string, assignmentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { marks_obtained: number; feedback?: string }) => {
      const { data } = await api.post<APIResponse<any>>(`/exams/lms/submissions/${submissionId}/grade`, payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-submissions', assignmentId] })
    },
  })
}

// Fees Hooks
export function useFeeStructures(academicYearId?: string) {
  return useQuery({
    queryKey: ['fee-structures', academicYearId],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/fees/structures', {
        params: { academic_year_id: academicYearId || undefined },
      })
      return data.data || []
    },
  })
}

export function useCreateFeeStructure() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { academic_year_id: string; name: string; amount: number; frequency: string; is_mandatory?: boolean }) => {
      const { data } = await api.post<APIResponse<any>>('/fees/structures', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] })
    },
  })
}

export function useFeePayments(studentId?: string) {
  return useQuery({
    queryKey: ['fee-payments', studentId],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/fees/payments', {
        params: { student_id: studentId || undefined },
      })
      return data.data || []
    },
  })
}

export function useCreateFeePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { student_id: string; fee_structure_id: string; amount_paid: number; payment_date: string; receipt_number: string }) => {
      const { data } = await api.post<APIResponse<any>>('/fees/payments', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-payments'] })
    },
  })
}

export function useUploadFeeReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { file: File; studentId?: string; feeStructureId?: string }) => {
      const formData = new FormData()
      if (payload.studentId) formData.append('student_id', payload.studentId)
      if (payload.feeStructureId) formData.append('fee_structure_id', payload.feeStructureId)
      formData.append('file', payload.file)
      const { data } = await api.post<APIResponse<any>>('/fees/payments/receipt-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-payments'] })
    },
  })
}

export function useStudentFeeBalances(classId?: string, sectionId?: string) {
  return useQuery({
    queryKey: ['student-fee-balances', classId, sectionId],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/fees/student-balances', {
        params: {
          class_id: classId || undefined,
          section_id: sectionId || undefined,
        },
      })
      return data.data || []
    },
  })
}

// Library Hooks
export function useBooks() {
  return useQuery({
    queryKey: ['books'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/ancillary/library/books')
      return data.data || []
    },
  })
}

export function useCreateBook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { title: string; author: string; isbn?: string; quantity: number }) => {
      const { data } = await api.post<APIResponse<any>>('/ancillary/library/books', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] })
    },
  })
}

export function useBookIssues() {
  return useQuery({
    queryKey: ['book-issues'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/ancillary/library/issues')
      return data.data || []
    },
  })
}

export function useIssueBook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { book_id: string; student_id: string; issue_date: string }) => {
      const { data } = await api.post<APIResponse<any>>('/ancillary/library/issues', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book-issues'] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
    },
  })
}

export function useReturnBook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (issueId: string) => {
      const { data } = await api.post<APIResponse<any>>(`/ancillary/library/issues/${issueId}/return`)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book-issues'] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
    },
  })
}

// Hostel Hooks
export function useHostels() {
  return useQuery({
    queryKey: ['hostels'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/ancillary/hostel/hostels')
      return data.data || []
    },
  })
}

export function useCreateHostel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; hostel_type: string; capacity: number }) => {
      const { data } = await api.post<APIResponse<any>>('/ancillary/hostel/hostels', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostels'] })
    },
  })
}

export function useHostelRooms(hostelId?: string) {
  return useQuery({
    queryKey: ['hostel-rooms', hostelId],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/ancillary/hostel/rooms', {
        params: { hostel_id: hostelId || undefined },
      })
      return data.data || []
    },
  })
}

export function useCreateHostelRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { hostel_id: string; room_number: string; bed_count: number; cost_per_month: number }) => {
      const { data } = await api.post<APIResponse<any>>('/ancillary/hostel/rooms', payload)
      return data.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hostel-rooms', variables.hostel_id] })
    },
  })
}

// Transport Hooks
export function useTransportRoutes() {
  return useQuery({
    queryKey: ['transport-routes'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/ancillary/transport/routes')
      return data.data || []
    },
  })
}

export function useCreateTransportRoute() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; start_point: string; end_point: string; cost: number }) => {
      const { data } = await api.post<APIResponse<any>>('/ancillary/transport/routes', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport-routes'] })
    },
  })
}

export function useVehicles() {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/ancillary/transport/vehicles')
      return data.data || []
    },
  })
}

export function useCreateVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { vehicle_number: string; driver_name: string; driver_phone: string; capacity: number }) => {
      const { data } = await api.post<APIResponse<any>>('/ancillary/transport/vehicles', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })
}

// AI Analytics Hooks
export function useAIChat() {
  return useMutation({
    mutationFn: async (message: string) => {
      const { data } = await api.post<APIResponse<{ response: string }>>('/ai/chat', { message })
      return data.data
    },
  })
}

export function usePredictPerformance() {
  return useMutation({
    mutationFn: async (studentId: string) => {
      const { data } = await api.post<APIResponse<any>>('/ai/predict-performance', { student_id: studentId })
      return data.data
    },
  })
}

// Reports Hooks
export function useAttendanceSummary() {
  return useQuery({
    queryKey: ['attendance-summary'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/reports/attendance-summary')
      return data.data || []
    },
  })
}

export function useFeeOutstanding() {
  return useQuery({
    queryKey: ['fee-outstanding'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any>>('/reports/fee-outstanding')
      return data.data
    },
  })
}

// Developer Control Panel Hooks
export function useDevHealth() {
  return useQuery({
    queryKey: ['dev-health'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any>>('/developer/health')
      return data.data
    },
  })
}

export function useDevSeed() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<APIResponse<any>>('/developer/seed')
      return data
    },
  })
}

export function useDevLogs() {
  return useQuery({
    queryKey: ['dev-logs'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/developer/logs')
      return data.data || []
    },
    refetchInterval: 5000,
  })
}

// -------------------------------------------------------------
// TEACHERS MODULE HOOKS
// -------------------------------------------------------------
export function useTeachers() {
  return useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/teachers/')
      return data.data || []
    },
  })
}

export function useCreateTeacher() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post<APIResponse<any>>('/teachers/', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
    },
  })
}

export function useDeleteTeacher() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete<APIResponse<any>>(`/teachers/${id}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
    },
  })
}

// -------------------------------------------------------------
// TIMETABLE MODULE HOOKS
// -------------------------------------------------------------
export function useTimetable(classId: string, sectionId: string) {
  return useQuery({
    queryKey: ['timetable', classId, sectionId],
    queryFn: async () => {
      if (!classId || !sectionId) return []
      const { data } = await api.get<APIResponse<any[]>>(`/timetable/class/${classId}/section/${sectionId}`)
      return data.data || []
    },
    enabled: !!classId && !!sectionId,
  })
}

export function useCreateTimetableEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post<APIResponse<any>>('/timetable/', payload)
      return data.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['timetable', variables.class_id, variables.section_id] })
    },
  })
}

export function useDeleteTimetableEntry(classId: string, sectionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (entryId: string) => {
      const { data } = await api.delete<APIResponse<any>>(`/timetable/${entryId}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable', classId, sectionId] })
    },
  })
}

// -------------------------------------------------------------
// PAYROLL MODULE HOOKS
// -------------------------------------------------------------
export function usePayrollStructures() {
  return useQuery({
    queryKey: ['payroll-structures'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/payroll/structures')
      return data.data || []
    },
  })
}

export function useSaveSalaryStructure() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post<APIResponse<any>>('/payroll/structures', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-structures'] })
    },
  })
}

export function useGeneratePayroll() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post<APIResponse<any>>('/payroll/generate', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls'] })
    },
  })
}

export function useMonthlyPayrolls(month?: number, year?: number) {
  return useQuery({
    queryKey: ['payrolls', month, year],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/payroll/', {
        params: { month, year },
      })
      return data.data || []
    },
  })
}

export function usePaySalary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<APIResponse<any>>(`/payroll/${id}/pay`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls'] })
    },
  })
}

// -------------------------------------------------------------
// HR MODULE HOOKS
// -------------------------------------------------------------
export function useHRStaff() {
  return useQuery({
    queryKey: ['hr-staff'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/hr/staff')
      return data.data || []
    },
  })
}

export function useOnboardStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post<APIResponse<any>>('/hr/staff', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-staff'] })
    },
  })
}

export function useHRLeaves() {
  return useQuery({
    queryKey: ['hr-leaves'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/hr/leaves')
      return data.data || []
    },
  })
}

export function useApplyLeave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post<APIResponse<any>>('/hr/leaves', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leaves'] })
    },
  })
}

export function useApproveLeave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<APIResponse<any>>(`/hr/leaves/${id}/approve`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leaves'] })
    },
  })
}

export function useRejectLeave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<APIResponse<any>>(`/hr/leaves/${id}/reject`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leaves'] })
    },
  })
}

// -------------------------------------------------------------
// NOTICE BOARD HOOKS
// -------------------------------------------------------------
export function useNotices() {
  return useQuery({
    queryKey: ['notices'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/notice-board/')
      return data.data || []
    },
  })
}

export function useCreateNotice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post<APIResponse<any>>('/notice-board/', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] })
    },
  })
}

export function usePublishNotice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<APIResponse<any>>(`/notice-board/${id}/publish`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] })
    },
  })
}

// -------------------------------------------------------------
// MESSAGES HOOKS
// -------------------------------------------------------------
export function useMessages() {
  return useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/messages/')
      return data.data || []
    },
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post<APIResponse<any>>('/messages/send', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
    },
  })
}

export function useMarkMessageRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<APIResponse<any>>(`/messages/${id}/read`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
    },
  })
}

// -------------------------------------------------------------
// CIRCULARS HOOKS
// -------------------------------------------------------------
export function useCircularsList() {
  return useQuery({
    queryKey: ['circulars-list'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/circulars/')
      return data.data || []
    },
  })
}

export function useCreateCircular() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post<APIResponse<any>>('/circulars/', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['circulars-list'] })
    },
  })
}

export function useSubjects() {
  return useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any[]>>('/timetable/subjects')
      return data.data || []
    },
  })
}

// -------------------------------------------------------------
// DASHBOARD MODULE HOOKS
// -------------------------------------------------------------
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get<APIResponse<any>>('/dashboard/stats')
      return data.data
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  })
}

