import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios'

// Helper to generate UUIDs in the browser
function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

// -------------------------------------------------------------
// SEED DATA
// -------------------------------------------------------------
const DEFAULT_ACADEMIC_YEARS = [
  { id: 'ay-1', name: '2025-26', start_date: '2025-04-01', end_date: '2026-03-31', is_current: true }
]

const DEFAULT_CLASSES = [
  { id: 'c-6', name: 'Class 6', academic_year_id: 'ay-1' },
  { id: 'c-7', name: 'Class 7', academic_year_id: 'ay-1' },
  { id: 'c-3', name: 'Class 8', academic_year_id: 'ay-1' },
  { id: 'c-2', name: 'Class 9', academic_year_id: 'ay-1' },
  { id: 'c-1', name: 'Class 10', academic_year_id: 'ay-1' }
]

const DEFAULT_SECTIONS = [
  // Class 6
  { id: 's-6a', class_id: 'c-6', name: 'A' },
  { id: 's-6b', class_id: 'c-6', name: 'B' },
  { id: 's-6g', class_id: 'c-6', name: 'G' },

  // Class 7
  { id: 's-7a', class_id: 'c-7', name: 'A' },
  { id: 's-7b', class_id: 'c-7', name: 'B' },
  { id: 's-7g', class_id: 'c-7', name: 'G' },

  // Class 8
  { id: 's-8a', class_id: 'c-3', name: 'A' },
  { id: 's-8b', class_id: 'c-3', name: 'B' },
  { id: 's-8g', class_id: 'c-3', name: 'G' },

  // Class 9
  { id: 's-3', class_id: 'c-2', name: 'A' },
  { id: 's-9b', class_id: 'c-2', name: 'B' },
  { id: 's-9g', class_id: 'c-2', name: 'G' },

  // Class 10
  { id: 's-1', class_id: 'c-1', name: 'A' },
  { id: 's-2', class_id: 'c-1', name: 'B' },
  { id: 's-10g', class_id: 'c-1', name: 'G' }
]

const DEFAULT_SUBJECTS = [
  { id: 'sub-1', name: 'Mathematics', code: 'MATH101' },
  { id: 'sub-2', name: 'Science', code: 'SCI101' },
  { id: 'sub-3', name: 'English', code: 'ENG101' },
  { id: 'sub-4', name: 'Social Studies', code: 'SOC101' }
]

const DEFAULT_USERS = [
  {
    id: 'u-admin',
    email: 'admin@school.edu',
    phone: '9999999999',
    first_name: 'System',
    last_name: 'Admin',
    role: 'school_admin',
    is_active: true,
    permissions: [
      'students:view', 'students:create', 'students:edit', 'students:delete', 'students:export', 'students:promote', 'students:admin',
      'admissions:view', 'admissions:create', 'admissions:edit',
      'attendance:view', 'attendance:mark',
      'fees:view', 'fees:collect',
      'exams:view', 'exams:manage',
      'ancillary:view', 'ancillary:manage',
      'teachers:view', 'teachers:manage',
      'timetable:view', 'timetable:manage',
      'payroll:view', 'payroll:manage',
      'hr:view', 'hr:manage',
      'reports:view', 'settings:view', 'developer:access'
    ]
  },
  {
    id: 'u-teacher',
    email: 'teacher@school.edu',
    phone: '9999999996',
    first_name: 'Priya',
    last_name: 'Nair',
    role: 'teacher',
    is_active: true,
    permissions: ['students:view', 'attendance:view', 'attendance:mark', 'exams:view']
  },
  {
    id: 'u-cashier',
    email: 'cashier@school.edu',
    phone: '9999999998',
    first_name: 'Ramesh',
    last_name: 'Kumar',
    role: 'accountant',
    is_active: true,
    permissions: ['students:view', 'fees:view', 'fees:collect', 'reports:view']
  },
  {
    id: 'u-admission',
    email: 'admission@school.edu',
    phone: '9999999997',
    first_name: 'Seema',
    last_name: 'Reddy',
    role: 'school_admin',
    is_active: true,
    permissions: [
      'students:view', 'students:create', 'students:edit', 'students:delete', 'students:export', 'students:promote', 'students:admin',
      'admissions:view', 'admissions:create', 'admissions:edit',
      'attendance:view', 'attendance:mark',
      'fees:view', 'fees:collect',
      'exams:view', 'exams:manage',
      'ancillary:view', 'ancillary:manage',
      'teachers:view', 'teachers:manage',
      'timetable:view', 'timetable:manage',
      'payroll:view', 'payroll:manage',
      'hr:view', 'hr:manage',
      'reports:view', 'settings:view'
    ]
  }
]

const DEFAULT_TEACHERS = [
  { id: 't-1', first_name: 'Priya', last_name: 'Nair', email: 'teacher@school.edu', phone: '9999999996', subject: 'Mathematics', department: 'Science', is_active: true },
  { id: 't-2', first_name: 'Amit', last_name: 'Sharma', email: 'amit@school.edu', phone: '9888888888', subject: 'Science', department: 'Science', is_active: true },
  { id: 't-3', first_name: 'Sunita', last_name: 'Rao', email: 'sunita@school.edu', phone: '9777777777', subject: 'English', department: 'Humanities', is_active: true }
]

const DEFAULT_STUDENTS: any[] = []

const DEFAULT_ADMISSIONS: any[] = []

const DEFAULT_TIMETABLE = [
  { id: 'tt-1', class_id: 'c-1', section_id: 's-1', subject_id: 'sub-1', teacher_id: 't-1', day_of_week: 'Monday', start_time: '09:00', end_time: '09:45', room_number: '101' },
  { id: 'tt-2', class_id: 'c-1', section_id: 's-1', subject_id: 'sub-2', teacher_id: 't-2', day_of_week: 'Monday', start_time: '09:45', end_time: '10:30', room_number: '101' },
  { id: 'tt-3', class_id: 'c-1', section_id: 's-1', subject_id: 'sub-3', teacher_id: 't-3', day_of_week: 'Tuesday', start_time: '09:00', end_time: '09:45', room_number: '101' }
]

const DEFAULT_EXAMS = [
  { id: 'ex-1', name: 'Quarterly Examination', exam_type: 'theory', academic_year_id: 'ay-1' },
  { id: 'ex-2', name: 'Half Yearly Examination', exam_type: 'theory', academic_year_id: 'ay-1' }
]

const DEFAULT_EXAM_SCHEDULES = [
  { id: 'exs-1', exam_id: 'ex-1', subject_id: 'sub-1', section_id: 's-1', exam_date: '2025-09-15', max_marks: 100, pass_marks: 35 },
  { id: 'exs-2', exam_id: 'ex-1', subject_id: 'sub-2', section_id: 's-1', exam_date: '2025-09-17', max_marks: 100, pass_marks: 35 }
]

const DEFAULT_EXAM_MARKS: any[] = []

const DEFAULT_FEE_STRUCTURES = [
  { id: 'fs-1', academic_year_id: 'ay-1', name: 'Term 1 Tuition Fee', amount: 15000, frequency: 'termly', is_mandatory: true },
  { id: 'fs-2', academic_year_id: 'ay-1', name: 'Term 2 Tuition Fee', amount: 15000, frequency: 'termly', is_mandatory: true },
  { id: 'fs-3', academic_year_id: 'ay-1', name: 'Library Fee', amount: 1200, frequency: 'annually', is_mandatory: true }
]

const DEFAULT_FEE_PAYMENTS: any[] = []

const DEFAULT_BOOKS = [
  { id: 'b-1', title: 'Concepts of Physics (Vol 1)', author: 'H.C. Verma', isbn: '9788177091878', quantity: 10, available: 10 },
  { id: 'b-2', title: 'Higher Algebra', author: 'Hall & Knight', isbn: '9789351760146', quantity: 5, available: 5 },
  { id: 'b-3', title: 'English Grammar & Composition', author: 'Wren & Martin', isbn: '9789352530144', quantity: 15, available: 15 }
]

const DEFAULT_BOOK_ISSUES: any[] = []

const DEFAULT_HOSTELS = [
  { id: 'h-1', name: 'Saraswati Boys Hostel', hostel_type: 'boys', capacity: 100 },
  { id: 'h-2', name: 'Gargi Girls Hostel', hostel_type: 'girls', capacity: 100 }
]

const DEFAULT_HOSTEL_ROOMS = [
  { id: 'hr-1', hostel_id: 'h-1', room_number: '101', bed_count: 4, cost_per_month: 2500 },
  { id: 'hr-2', hostel_id: 'h-1', room_number: '102', bed_count: 4, cost_per_month: 2500 },
  { id: 'hr-3', hostel_id: 'h-2', room_number: 'G1', bed_count: 2, cost_per_month: 3500 }
]

const DEFAULT_TRANSPORT_ROUTES = [
  { id: 'tr-1', name: 'Route 1 - Kukatpally to School', start_point: 'Kukatpally Y Junction', end_point: 'School Campus', cost: 1500 },
  { id: 'tr-2', name: 'Route 2 - Secunderabad to School', start_point: 'Secunderabad Station', end_point: 'School Campus', cost: 1800 }
]

const DEFAULT_VEHICLES = [
  { id: 'v-1', vehicle_number: 'TS-09-EA-1234', driver_name: 'Mallesh Rao', driver_phone: '9848022338', capacity: 40 },
  { id: 'v-2', vehicle_number: 'TS-09-EA-5678', driver_name: 'K. Satish', driver_phone: '9848022339', capacity: 40 }
]

const DEFAULT_HR_STAFF = [
  { id: 'hs-1', first_name: 'Priya', last_name: 'Nair', email: 'teacher@school.edu', phone: '9999999996', role: 'teacher', department: 'Academics', salary_structure_id: 'ss-1' },
  { id: 'hs-2', first_name: 'Ramesh', last_name: 'Kumar', email: 'cashier@school.edu', phone: '9999999998', role: 'accountant', department: 'Finance', salary_structure_id: 'ss-2' }
]

const DEFAULT_PAYROLL_STRUCTURES = [
  { id: 'ss-1', name: 'Senior Teacher Structure', basic_pay: 40000, allowances: 8000, deductions: 2500 },
  { id: 'ss-2', name: 'Accountant Structure', basic_pay: 30000, allowances: 5000, deductions: 2000 }
]

const DEFAULT_PAYROLLS = [
  { id: 'pr-1', staff_id: 'hs-1', month: 6, year: 2025, basic_pay: 40000, allowances: 8000, deductions: 2500, net_pay: 45500, status: 'paid', paid_at: '2025-06-30' },
  { id: 'pr-2', staff_id: 'hs-2', month: 6, year: 2025, basic_pay: 30000, allowances: 5000, deductions: 2000, net_pay: 33000, status: 'pending', paid_at: '' }
]

const DEFAULT_HR_LEAVES = [
  { id: 'l-1', staff_id: 'hs-1', leave_type: 'sick', start_date: '2025-07-02', end_date: '2025-07-03', reason: 'Fever', status: 'approved' },
  { id: 'l-2', staff_id: 'hs-2', leave_type: 'casual', start_date: '2025-07-10', end_date: '2025-07-11', reason: 'Personal work', status: 'pending' }
]

const DEFAULT_NOTICES = [
  { id: 'n-1', title: 'Independence Day Celebrations', content: 'Flag hoisting ceremony will begin at 8:00 AM on August 15th. Attendance is compulsory.', is_published: true, published_at: '2025-08-10T09:00:00.000Z', created_at: '2025-08-10T09:00:00.000Z' },
  { id: 'n-2', title: 'Parent-Teacher Meeting', content: 'Term 1 PTM is scheduled for Saturday, 27th September, from 9:00 AM to 1:00 PM.', is_published: false, published_at: '', created_at: '2025-09-01T10:30:00.000Z' }
]

const DEFAULT_MESSAGES = [
  { id: 'msg-1', sender: 'Principal', recipient: 'Teachers', content: 'Please submit exam question papers by tomorrow evening.', is_read: false, timestamp: '2025-07-20T04:30:00.000Z' },
  { id: 'msg-2', sender: 'System Admin', recipient: 'All Staff', content: 'Database maintenance scheduled for Sunday 10 PM.', is_read: true, timestamp: '2025-07-18T12:00:00.000Z' }
]

const DEFAULT_CIRCULARS = [
  { id: 'cir-1', title: 'School Uniform Guidelines 2025-26', content: 'Attached is the official uniform specification for CBSE middle and high school.', file_url: '#', created_at: '2025-04-05T08:00:00.000Z' }
]

// -------------------------------------------------------------
// DATABASE INITIALIZATION / RE-SEED
// -------------------------------------------------------------
export function initMockDb(force = false) {
  const store = (key: string, defaultData: any) => {
    if (force || !localStorage.getItem(`db_${key}`)) {
      localStorage.setItem(`db_${key}`, JSON.stringify(defaultData))
    }
  }

  store('academic_years', DEFAULT_ACADEMIC_YEARS)
  store('classes', DEFAULT_CLASSES)
  store('sections', DEFAULT_SECTIONS)
  store('subjects', DEFAULT_SUBJECTS)
  store('users', DEFAULT_USERS)
  store('teachers', DEFAULT_TEACHERS)
  store('students', DEFAULT_STUDENTS)
  store('admissions', DEFAULT_ADMISSIONS)
  store('timetable', DEFAULT_TIMETABLE)
  store('exams', DEFAULT_EXAMS)
  store('exam_schedules', DEFAULT_EXAM_SCHEDULES)
  store('exam_marks', DEFAULT_EXAM_MARKS)
  store('fee_structures', DEFAULT_FEE_STRUCTURES)
  store('fee_payments', DEFAULT_FEE_PAYMENTS)
  store('books', DEFAULT_BOOKS)
  store('book_issues', DEFAULT_BOOK_ISSUES)
  store('hostels', DEFAULT_HOSTELS)
  store('hostel_rooms', DEFAULT_HOSTEL_ROOMS)
  store('transport_routes', DEFAULT_TRANSPORT_ROUTES)
  store('vehicles', DEFAULT_VEHICLES)
  store('hr_staff', DEFAULT_HR_STAFF)
  store('payroll_structures', DEFAULT_PAYROLL_STRUCTURES)
  store('payrolls', DEFAULT_PAYROLLS)
  store('hr_leaves', DEFAULT_HR_LEAVES)
  store('notices', DEFAULT_NOTICES)
  store('messages', DEFAULT_MESSAGES)
  store('circulars', DEFAULT_CIRCULARS)
  
  if (force || !localStorage.getItem('db_attendance')) {
    localStorage.setItem('db_attendance', JSON.stringify([]))
  }
  if (force || !localStorage.getItem('db_documents')) {
    localStorage.setItem('db_documents', JSON.stringify([]))
  }
  if (force || !localStorage.getItem('db_student_timeline')) {
    localStorage.setItem('db_student_timeline', JSON.stringify([]))
  }
  if (force || !localStorage.getItem('db_assignments')) {
    localStorage.setItem('db_assignments', JSON.stringify([]))
  }
  if (force || !localStorage.getItem('db_submissions')) {
    localStorage.setItem('db_submissions', JSON.stringify([]))
  }
  if (force || !localStorage.getItem('db_dev_logs')) {
    localStorage.setItem('db_dev_logs', JSON.stringify([
      { timestamp: new Date().toISOString(), level: 'INFO', message: 'Mock API Database initialized successfully.' }
    ]))
  }
}

export function resetMockDb() {
  initMockDb(true)
}

function getTable<T = any>(key: string): T[] {
  const data = localStorage.getItem(`db_${key}`)
  return data ? JSON.parse(data) : []
}

function saveTable(key: string, data: any[]) {
  localStorage.setItem(`db_${key}`, JSON.stringify(data))
}

function addLog(level: string, message: string) {
  const logs = getTable('dev_logs')
  logs.unshift({ timestamp: new Date().toISOString(), level, message })
  saveTable('dev_logs', logs.slice(0, 100)) // Cap logs at 100
}

// Helper function to match paths like '/students/123/promote' to '/students/:id/promote'
function partsMatches(path: string, routeTemplate: string): boolean {
  const pathParts = path.split('/')
  const templateParts = routeTemplate.split('/')
  if (pathParts.length !== templateParts.length) return false
  for (let i = 0; i < pathParts.length; i++) {
    if (templateParts[i].startsWith(':')) continue
    if (pathParts[i] !== templateParts[i]) return false
  }
  return true
}

// -------------------------------------------------------------
// ROUTER INTERCEPTOR ADAPTER
// -------------------------------------------------------------
export const mockAdapter = (config: any): Promise<any> => {
  initMockDb()

  const urlObj = new URL(config.url || '', 'http://localhost')
  const path = urlObj.pathname.replace(/^\/api\/v1/, '')
  const method = (config.method || 'get').toLowerCase()
  const params = config.params || {}
  const data = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {})

  let responseData: any = null
  let metaData: any = undefined
  let status = 200
  let message = 'Success'

  addLog('INFO', `Request: ${method.toUpperCase()} ${urlObj.pathname}${urlObj.search}`)

  try {
    // -------------------------------------------------------------
    // AUTHENTICATION
    // -------------------------------------------------------------
    if (path === '/auth/login' && method === 'post') {
      const email_or_phone = data.email_or_phone
      const users = getTable('users')
      const user = users.find(u => u.email === email_or_phone || u.phone === email_or_phone)

      if (user && user.is_active) {
        responseData = {
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            is_active: user.is_active
          },
          access_token: `mock-access-token-${user.id}`,
          refresh_token: `mock-refresh-token-${user.id}`
        }
        localStorage.setItem('mock_current_user_id', user.id)
      } else {
        status = 401
        message = 'Invalid email/phone or password'
      }
    }

    else if (path === '/auth/refresh' && method === 'post') {
      const userId = localStorage.getItem('mock_current_user_id') || 'u-admin'
      responseData = {
        access_token: `mock-access-token-${userId}`,
        refresh_token: `mock-refresh-token-${userId}`
      }
    }

    else if (path === '/auth/me' && method === 'get') {
      const userId = localStorage.getItem('mock_current_user_id') || 'u-admin'
      const users = getTable('users')
      const user = users.find(u => u.id === userId)
      if (user) {
        responseData = user
      } else {
        status = 401
        message = 'User session not found'
      }
    }

    else if (path === '/auth/logout' && method === 'post') {
      localStorage.removeItem('mock_current_user_id')
      responseData = { success: true }
    }

    else if (path === '/auth/change-password' && method === 'post') {
      responseData = { success: true }
    }

    // -------------------------------------------------------------
    // ACADEMIC YEAR / CLASSES / SECTIONS
    // -------------------------------------------------------------
    else if (path === '/students/academic/years' && method === 'get') {
      responseData = getTable('academic_years')
    }

    else if (path === '/students/academic/classes' && method === 'get') {
      const classes = getTable('classes')
      if (params.academic_year_id) {
        responseData = classes.filter(c => c.academic_year_id === params.academic_year_id)
      } else {
        responseData = classes
      }
    }

    else if (path === '/students/academic/sections' && method === 'get') {
      const sections = getTable('sections')
      if (params.class_id) {
        responseData = sections.filter(s => s.class_id === params.class_id)
      } else {
        responseData = sections
      }
    }

    // -------------------------------------------------------------
    // STUDENTS CRUD
    // -------------------------------------------------------------
    else if (path === '/students' && method === 'get') {
      const students = getTable('students')
      const filtered = students.filter(s => {
        let match = true
        if (params.section_id) match = match && s.section_id === params.section_id
        if (params.academic_year_id) match = match && s.academic_year_id === params.academic_year_id
        if (params.search) {
          const sText = params.search.toLowerCase()
          match = match && (
            s.first_name.toLowerCase().includes(sText) ||
            s.last_name.toLowerCase().includes(sText) ||
            s.admission_number.toLowerCase().includes(sText) ||
            s.roll_number.toLowerCase().includes(sText)
          )
        }
        return match
      })
      const page = parseInt(params.page || '1', 10)
      const limit = parseInt(params.limit || '20', 10)
      const skip = (page - 1) * limit
      responseData = filtered.slice(skip, skip + limit)
      metaData = { page, limit, total: filtered.length }
    }

    else if (path === '/students' && method === 'post') {
      const students = getTable('students')
      const newStudent = {
        ...data,
        id: `st-${generateId()}`,
        admission_number: `ADM${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`,
        is_active: true
      }
      students.push(newStudent)
      saveTable('students', students)
      responseData = newStudent

      // Create timeline
      const timeline = getTable('student_timeline')
      timeline.push({
        id: generateId(),
        student_id: newStudent.id,
        action: 'Student Admitted',
        module: 'Students',
        timestamp: new Date().toISOString()
      })
      saveTable('student_timeline', timeline)
    }

    else if (path.startsWith('/students/') && method === 'get') {
      const parts = path.split('/')
      const id = parts[2]
      if (parts[3] === 'documents') {
        const docs = getTable('documents')
        responseData = docs.filter(d => d.student_id === id)
      } else if (parts[3] === 'timeline') {
        const timeline = getTable('student_timeline')
        responseData = timeline.filter(t => t.student_id === id)
      } else {
        const students = getTable('students')
        const student = students.find(s => s.id === id)
        if (student) responseData = student
        else { status = 404; message = 'Student not found' }
      }
    }

    else if (path.startsWith('/students/') && method === 'put') {
      const id = path.split('/')[2]
      const students = getTable('students')
      const idx = students.findIndex(s => s.id === id)
      if (idx !== -1) {
        students[idx] = { ...students[idx], ...data }
        saveTable('students', students)
        responseData = students[idx]

        // Create timeline
        const timeline = getTable('student_timeline')
        timeline.push({
          id: generateId(),
          student_id: id,
          action: 'Profile Updated',
          module: 'Students',
          timestamp: new Date().toISOString()
        })
        saveTable('student_timeline', timeline)
      } else {
        status = 404
        message = 'Student not found'
      }
    }

    else if (path.startsWith('/students/') && method === 'delete') {
      const id = path.split('/')[2]
      const students = getTable('students')
      const filtered = students.filter(s => s.id !== id)
      saveTable('students', filtered)
      responseData = { success: true }
    }

    else if (path.startsWith('/students/') && partsMatches(path, '/students/:id/photo') && method === 'post') {
      const id = path.split('/')[2]
      const students = getTable('students')
      const idx = students.findIndex(s => s.id === id)
      if (idx !== -1) {
        students[idx].profile_photo_url = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&h=256&fit=crop'
        saveTable('students', students)
        responseData = { url: students[idx].profile_photo_url }
      } else {
        status = 404
        message = 'Student not found'
      }
    }

    else if (path.startsWith('/students/') && partsMatches(path, '/students/:id/documents') && method === 'post') {
      const studentId = path.split('/')[2]
      const docs = getTable('documents')
      const newDoc = {
        id: `doc-${generateId()}`,
        student_id: studentId,
        type: 'Aadhaar Card',
        name: 'Aadhaar_Verification.pdf',
        url: '#'
      }
      docs.push(newDoc)
      saveTable('documents', docs)
      responseData = newDoc
    }

    else if (path.startsWith('/students/') && partsMatches(path, '/students/:id/documents/:docId') && method === 'delete') {
      const docId = path.split('/')[4]
      const docs = getTable('documents')
      const filtered = docs.filter(d => d.id !== docId)
      saveTable('documents', filtered)
      responseData = { success: true }
    }

    else if (path.startsWith('/students/') && partsMatches(path, '/students/:id/promote') && method === 'post') {
      const id = path.split('/')[2]
      const students = getTable('students')
      const idx = students.findIndex(s => s.id === id)
      if (idx !== -1) {
        students[idx].section_id = data.target_section_id
        students[idx].academic_year_id = data.target_academic_year_id
        if (data.roll_number) students[idx].roll_number = data.roll_number
        saveTable('students', students)
        responseData = students[idx]

        // Create timeline
        const timeline = getTable('student_timeline')
        timeline.push({
          id: generateId(),
          student_id: id,
          action: 'Promoted to Next Class',
          module: 'Students',
          timestamp: new Date().toISOString()
        })
        saveTable('student_timeline', timeline)
      } else {
        status = 404
        message = 'Student not found'
      }
    }

    else if (path === '/students/bulk-import' && method === 'post') {
      const academicYearId = data.get ? data.get('academic_year_id') : (data.academicYearId || 'ay-1')
      const sectionId = data.get ? data.get('section_id') : data.sectionId
      const classId = data.get ? data.get('class_id') : data.classId
      
      const students = getTable('students')
      const parents = getTable('parents') || []
      const timeline = getTable('student_timeline')
      
      let importedCount = 0

      const BOY_NAMES = [
        { first: 'Rahul', last: 'Sharma', father: 'Kishore', mother: 'Salomi' },
        { first: 'Sai', last: 'Teja', father: 'Balu Naik', mother: 'Lalitha Bai' },
        { first: 'Karthik', last: 'Reddy', father: 'Venkata Rama Rao', mother: 'Padmavathi' },
        { first: 'Venkata', last: 'Rao', father: 'Venkatesh', mother: 'Mariyamma' },
        { first: 'Manish', last: 'Varma', father: 'Hanumanthu Naik', mother: 'Anitha Bai' },
        { first: 'Aditya', last: 'Gupta', father: 'Hassan Vali', mother: 'Kasulu' },
        { first: 'Siddharth', last: 'Chowdary', father: 'Hussenain', mother: 'Razia' },
        { first: 'Pranav', last: 'Kumar', father: 'Srinu', mother: 'Nagendra' },
        { first: 'Ganesh', last: 'Naidu', father: 'Kondaiah', mother: 'Venkamma' },
        { first: 'Harsha', last: 'Vardhan', father: 'Koteswararao', mother: 'Siva Leela' },
        { first: 'Nikhil', last: 'Verma', father: 'Bhaskar Rao', mother: 'Ludhaya' },
        { first: 'Rohan', last: 'Joshi', father: 'Venkata Reddy', mother: 'Subbalakshmi' }
      ]

      const GIRL_NAMES = [
        { first: 'Ananya', last: 'Reddy', father: 'Venkata Reddy', mother: 'Bhu Lakshmi' },
        { first: 'Lakshmi', last: 'Prasanna', father: 'Ramaiah', mother: 'Guravamma' },
        { first: 'Harini', last: 'Rao', father: 'Anjaneyulu', mother: 'Lingamma' },
        { first: 'Bhavana', last: 'Sharma', father: 'Potulluraiah', mother: 'Venkata Pitchamma' },
        { first: 'Deepika', last: 'Pillai', father: 'Yallaiaha', mother: 'Kumari' },
        { first: 'Kavya', last: 'Sen', father: 'Venkata Rami Reddy', mother: 'Subbulu' },
        { first: 'Sravani', last: 'Devi', father: 'Venkateswarlu', mother: 'Narayanamma' },
        { first: 'Divya', last: 'Teja', father: 'Brahmaiah', mother: 'Ramadevi' },
        { first: 'Pooja', last: 'Kumari', father: 'Suresh', mother: 'Maheswari' },
        { first: 'Sri', last: 'Hasini', father: 'Chennakesavulu', mother: 'Venkatalaxmi' },
        { first: 'Megana', last: 'Chowdary', father: 'Hussain', mother: 'Saida Bee' },
        { first: 'Swathi', last: 'Nair', father: 'Chinna Abbi Reddy', mother: 'Venkata Kumari' }
      ]

      const VILLAGES = ['Akkapalem', 'Suthakunta Thanda', 'Suddakurava Thanda', 'Venkata Reddy Palli', 'Marrivemula', 'Pullalacheruvu', 'Ravulapuram', 'Gajulapallem', 'Rentapalli']
      const CASTES = ['SC', 'ST', 'BC-A', 'BC', 'General', 'OBC']
      const SUB_CASTES = ['Madiga', 'Sugali', 'Vaddera', 'Yadava', 'Kamma', 'Reddy', 'Naidu']
      
      if (sectionId && sectionId !== 'undefined' && sectionId !== 'null' && sectionId !== '') {
        const section = getTable('sections').find(s => s.id === sectionId)
        const isGirlsSec = section ? section.name.toUpperCase() === 'G' : false
        const namePool = isGirlsSec ? GIRL_NAMES : BOY_NAMES
        
        for (let i = 0; i < 35; i++) {
          const sampleName = namePool[i % namePool.length]
          const newStudent = {
            id: `st-bulk-${generateId()}`,
            admission_number: `ADM2026S${Math.floor(1000 + Math.random() * 9000)}`,
            first_name: sampleName.first,
            middle_name: '',
            last_name: sampleName.last,
            date_of_birth: `201${Math.floor(2 + Math.random() * 4)}-0${Math.floor(1 + Math.random() * 8)}-15`,
            gender: isGirlsSec ? 'female' : (i % 2 === 0 ? 'male' : 'female'),
            roll_number: String(i + 1),
            phone: `98765${Math.floor(10000 + Math.random() * 90000)}`,
            email: `${sampleName.first.toLowerCase()}.${sampleName.last.toLowerCase()}${i+1}@gmail.com`,
            category: CASTES[i % CASTES.length].toLowerCase(),
            blood_group: ['O+', 'A+', 'B+', 'AB+'][i % 4],
            nationality: 'Indian',
            is_active: true,
            section_id: sectionId,
            academic_year_id: academicYearId,
            profile_photo_url: '',
            address_line1: VILLAGES[i % VILLAGES.length],
            address_line2: `H.No ${i + 1}-${i * 2 + 3}`,
            alternate_phone: `91234${Math.floor(10000 + Math.random() * 90000)}`
          }
          students.push(newStudent)

          // Add father & mother records
          parents.push({
            id: `par-f-${generateId()}`,
            student_id: newStudent.id,
            relation: 'father',
            first_name: sampleName.father,
            last_name: sampleName.last,
            phone: newStudent.phone,
            is_primary_contact: true
          })
          parents.push({
            id: `par-m-${generateId()}`,
            student_id: newStudent.id,
            relation: 'mother',
            first_name: sampleName.mother,
            last_name: sampleName.last,
            phone: newStudent.alternate_phone,
            is_primary_contact: false
          })

          timeline.push({
            id: generateId(),
            student_id: newStudent.id,
            action: 'Bulk Data Imported',
            module: 'Students',
            timestamp: new Date().toISOString()
          })
          importedCount++
        }
      } else if (classId && classId !== 'undefined' && classId !== 'null' && classId !== '') {
        const classSecs = getTable('sections').filter(s => s.class_id === classId)
        classSecs.forEach(s => {
          const isGirlsSec = s.name.toUpperCase() === 'G'
          const namePool = isGirlsSec ? GIRL_NAMES : BOY_NAMES
          for (let i = 0; i < 35; i++) {
            const sampleName = namePool[(i + importedCount) % namePool.length]
            const newStudent = {
              id: `st-bulk-${generateId()}`,
              admission_number: `ADM2026C${Math.floor(1000 + Math.random() * 9000)}`,
              first_name: sampleName.first,
              middle_name: '',
              last_name: sampleName.last,
              date_of_birth: `201${Math.floor(2 + Math.random() * 4)}-0${Math.floor(1 + Math.random() * 8)}-12`,
              gender: isGirlsSec ? 'female' : (i % 2 === 0 ? 'male' : 'female'),
              roll_number: String(i + 1),
              phone: `98765${Math.floor(10000 + Math.random() * 90000)}`,
              email: `${sampleName.first.toLowerCase()}.${sampleName.last.toLowerCase()}${i+1}@gmail.com`,
              category: CASTES[i % CASTES.length].toLowerCase(),
              blood_group: 'O+',
              nationality: 'Indian',
              is_active: true,
              section_id: s.id,
              academic_year_id: academicYearId,
              profile_photo_url: '',
              address_line1: VILLAGES[i % VILLAGES.length],
              address_line2: `H.No ${i + 1}-${i * 3}`,
              alternate_phone: ''
            }
            students.push(newStudent)

            parents.push({
              id: `par-f-${generateId()}`,
              student_id: newStudent.id,
              relation: 'father',
              first_name: sampleName.father,
              last_name: sampleName.last,
              phone: newStudent.phone,
              is_primary_contact: true
            })
            parents.push({
              id: `par-m-${generateId()}`,
              student_id: newStudent.id,
              relation: 'mother',
              first_name: sampleName.mother,
              last_name: sampleName.last,
              phone: newStudent.alternate_phone || newStudent.phone,
              is_primary_contact: false
            })

            importedCount++
          }
        })
      } else {
        const classes = getTable('classes')
        const sections = getTable('sections')
        
        classes.forEach(c => {
          const classSecs = sections.filter(s => s.class_id === c.id)
          classSecs.forEach(s => {
            const isGirlsSec = s.name.toUpperCase() === 'G'
            const namePool = isGirlsSec ? GIRL_NAMES : BOY_NAMES
            for (let i = 0; i < 35; i++) {
              const sampleName = namePool[(i + importedCount) % namePool.length]
              const newStudent = {
                id: `st-bulk-${generateId()}`,
                admission_number: `ADM2026A${Math.floor(1000 + Math.random() * 9000)}`,
                first_name: sampleName.first,
                middle_name: '',
                last_name: sampleName.last,
                date_of_birth: `201${Math.floor(2 + Math.random() * 4)}-0${Math.floor(1 + Math.random() * 8)}-10`,
                gender: isGirlsSec ? 'female' : (i % 2 === 0 ? 'male' : 'female'),
                roll_number: String(i + 1),
                phone: `98765${Math.floor(10000 + Math.random() * 90000)}`,
                email: `${sampleName.first.toLowerCase()}.${sampleName.last.toLowerCase()}${importedCount}@gmail.com`,
                category: CASTES[i % CASTES.length].toLowerCase(),
                blood_group: ['O+', 'A+', 'B+', 'AB+'][i % 4],
                nationality: 'Indian',
                is_active: true,
                section_id: s.id,
                academic_year_id: academicYearId,
                profile_photo_url: '',
                address_line1: VILLAGES[i % VILLAGES.length],
                address_line2: `H.No ${i + 10}`,
                alternate_phone: ''
              }
              students.push(newStudent)

              parents.push({
                id: `par-f-${generateId()}`,
                student_id: newStudent.id,
                relation: 'father',
                first_name: sampleName.father,
                last_name: sampleName.last,
                phone: newStudent.phone,
                is_primary_contact: true
              })
              parents.push({
                id: `par-m-${generateId()}`,
                student_id: newStudent.id,
                relation: 'mother',
                first_name: sampleName.mother,
                last_name: sampleName.last,
                phone: newStudent.alternate_phone || newStudent.phone,
                is_primary_contact: false
              })

              timeline.push({
                id: generateId(),
                student_id: newStudent.id,
                action: 'Bulk Data Imported',
                module: 'Students',
                timestamp: new Date().toISOString()
              })
              importedCount++
            }
          })
        })
      }
      
      saveTable('students', students)
      saveTable('parents', parents)
      saveTable('student_timeline', timeline)
      
      responseData = { imported: importedCount, errors: [] }
    }

    else if (path === '/students/google-sheets-import' && method === 'post') {
      const academicYearId = data.academic_year_id || 'ay-1'
      const sectionId = data.section_id
      
      const students = getTable('students')
      const timeline = getTable('student_timeline')
      
      let importedCount = 0
      
      if (sectionId && sectionId !== 'undefined' && sectionId !== 'null' && sectionId !== '') {
        const section = getTable('sections').find(s => s.id === sectionId)
        const schoolClass = section ? getTable('classes').find(c => c.id === section.class_id) : null
        const className = schoolClass ? schoolClass.name : 'Unknown Class'
        const secName = section ? section.name : 'A'
        
        for (let i = 1; i <= 3; i++) {
          const newStudent = {
            id: `st-sheet-${generateId()}`,
            admission_number: `ADM2025S${Math.floor(100 + Math.random() * 900)}`,
            first_name: `SheetStudent ${i}`,
            middle_name: '',
            last_name: `(${className} - ${secName})`,
            date_of_birth: '2012-05-10',
            gender: i % 2 === 0 ? 'female' : 'male',
            roll_number: String(25 + i),
            phone: '9999988888',
            email: `sheet${i}@gmail.com`,
            category: 'general',
            blood_group: 'A+',
            nationality: 'Indian',
            is_active: true,
            section_id: sectionId,
            academic_year_id: academicYearId,
            profile_photo_url: ''
          }
          students.push(newStudent)
          timeline.push({
            id: generateId(),
            student_id: newStudent.id,
            action: 'Google Sheets Imported',
            module: 'Students',
            timestamp: new Date().toISOString()
          })
          importedCount++
        }
      } else {
        const classes = getTable('classes')
        const sections = getTable('sections')
        
        classes.forEach(c => {
          const classSecs = sections.filter(s => s.class_id === c.id)
          classSecs.forEach(s => {
            const newStudent = {
              id: `st-sheet-${generateId()}`,
              admission_number: `ADM2025S${Math.floor(1000 + Math.random() * 9000)}`,
              first_name: `Sheet ${c.name.split(' ')[1]}${s.name}`,
              middle_name: '',
              last_name: 'Student',
              date_of_birth: '2012-05-10',
              gender: Math.random() > 0.5 ? 'female' : 'male',
              roll_number: String(Math.floor(1 + Math.random() * 30)),
              phone: '9999988888',
              email: `sheet.${c.name.split(' ')[1]}${s.name.toLowerCase()}@gmail.com`,
              category: 'general',
              blood_group: 'A+',
              nationality: 'Indian',
              is_active: true,
              section_id: s.id,
              academic_year_id: academicYearId,
              profile_photo_url: ''
            }
            students.push(newStudent)
            timeline.push({
              id: generateId(),
              student_id: newStudent.id,
              action: 'Google Sheets Imported (Auto-detected Class & Section)',
              module: 'Students',
              timestamp: new Date().toISOString()
            })
            importedCount++
          })
        })
      }
      
      saveTable('students', students)
      saveTable('student_timeline', timeline)
      
      responseData = { imported: importedCount, errors: [] }
    }

    else if (path.startsWith('/students/') && partsMatches(path, '/students/:id/portal-access') && method === 'post') {
      responseData = { success: true, message: 'Portal access created successfully' }
    }

    // -------------------------------------------------------------
    // ADMISSIONS
    // -------------------------------------------------------------
    else if (path === '/admissions' && method === 'get') {
      const admissions = getTable('admissions')
      let filtered = admissions
      if (params.search) {
        const sText = params.search.toLowerCase()
        filtered = filtered.filter(a =>
          a.first_name.toLowerCase().includes(sText) ||
          a.last_name.toLowerCase().includes(sText) ||
          a.application_number.toLowerCase().includes(sText)
        )
      }
      if (params.status) {
        filtered = filtered.filter(a => a.status === params.status)
      }
      responseData = filtered
    }

    else if (path === '/admissions' && method === 'post') {
      const admissions = getTable('admissions')
      const newAdm = {
        ...data,
        id: `adm-${generateId()}`,
        application_number: `APPL2026${Math.floor(100 + Math.random() * 900)}`,
        status: 'pending'
      }
      admissions.push(newAdm)
      saveTable('admissions', admissions)
      responseData = newAdm
    }

    else if (path.startsWith('/admissions/') && method === 'get') {
      const id = path.split('/')[2]
      const admissions = getTable('admissions')
      const adm = admissions.find(a => a.id === id)
      if (adm) responseData = adm
      else { status = 404; message = 'Admission not found' }
    }

    else if (path.startsWith('/admissions/') && method === 'put') {
      const id = path.split('/')[2]
      const admissions = getTable('admissions')
      const idx = admissions.findIndex(a => a.id === id)
      if (idx !== -1) {
        admissions[idx] = { ...admissions[idx], ...data }
        saveTable('admissions', admissions)
        responseData = admissions[idx]
      } else {
        status = 404
        message = 'Admission not found'
      }
    }

    else if (path === '/admissions/ocr' && method === 'post') {
      responseData = {
        first_name: 'Kartik',
        last_name: 'Goyal',
        date_of_birth: '2012-04-12',
        gender: 'male',
        phone: '9000123456',
        email: 'kartik.goyal@gmail.com'
      }
    }

    else if (path.startsWith('/admissions/') && partsMatches(path, '/admissions/:id/convert') && method === 'post') {
      const id = path.split('/')[2]
      const admissions = getTable('admissions')
      const admIdx = admissions.findIndex(a => a.id === id)
      if (admIdx !== -1) {
        const adm = admissions[admIdx]
        adm.status = 'converted'
        saveTable('admissions', admissions)

        const students = getTable('students')
        const newStudent = {
          id: `st-${generateId()}`,
          admission_number: `ADM${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`,
          first_name: adm.first_name,
          middle_name: '',
          last_name: adm.last_name,
          date_of_birth: adm.date_of_birth,
          gender: adm.gender,
          roll_number: params.roll_number || '1',
          phone: adm.phone || '9999999999',
          email: adm.email || 'student@gmail.com',
          category: 'general',
          blood_group: 'O+',
          nationality: 'Indian',
          religion: 'Hindu',
          aadhaar_number: '0000-0000-0000',
          previous_school: 'Previous School',
          tc_number: 'TC-OCR',
          address_line1: 'City Address',
          city: 'Hyderabad',
          state: 'Telangana',
          pincode: '500001',
          is_active: true,
          section_id: params.section_id || 's-1',
          academic_year_id: adm.academic_year_id || 'ay-1',
          profile_photo_url: ''
        }
        students.push(newStudent)
        saveTable('students', students)
        responseData = newStudent
      } else {
        status = 404
        message = 'Admission not found'
      }
    }

    // -------------------------------------------------------------
    // ATTENDANCE
    // -------------------------------------------------------------
    else if (path === '/attendance' && method === 'get') {
      const dateVal = params.date
      const sectionId = params.section_id
      const atts = getTable('attendance')
      const match = atts.find(a => a.date === dateVal && a.section_id === sectionId)
      if (match) {
        responseData = match.records
      } else {
        // Return dummy empty list or auto-generate active students as Present
        const students = getTable('students')
        const classStudents = students.filter(s => s.section_id === sectionId)
        responseData = classStudents.map(s => ({
          student_id: s.id,
          student: s,
          status: 'present'
        }))
      }
    }

    else if (path === '/attendance/bulk' && method === 'post') {
      const atts = getTable('attendance')
      const keyIdx = atts.findIndex(a => a.date === data.date && a.section_id === data.section_id)
      const formattedRecords = data.records.map((r: any) => {
        const student = getTable('students').find(s => s.id === r.student_id)
        return {
          student_id: r.student_id,
          status: r.status,
          student
        }
      })
      if (keyIdx !== -1) {
        atts[keyIdx].records = formattedRecords
      } else {
        atts.push({
          id: `att-${generateId()}`,
          date: data.date,
          section_id: data.section_id,
          academic_year_id: data.academic_year_id,
          records: formattedRecords
        })
      }
      saveTable('attendance', atts)
      responseData = { success: true }
    }

    else if (path === '/attendance/bulk-import-excel' && method === 'post') {
      responseData = { imported: 30, errors: [] }
    }

    // -------------------------------------------------------------
    // EXAMS
    // -------------------------------------------------------------
    else if (path === '/exams' && method === 'get') {
      responseData = getTable('exams')
    }

    else if (path === '/exams' && method === 'post') {
      const exams = getTable('exams')
      const newExam = {
        ...data,
        id: `ex-${generateId()}`
      }
      exams.push(newExam)
      saveTable('exams', exams)
      responseData = newExam
    }

    else if (path.startsWith('/exams/') && partsMatches(path, '/exams/:id/schedules') && method === 'get') {
      const examId = path.split('/')[2]
      const schedules = getTable('exam_schedules')
      const filtered = schedules.filter(s => s.exam_id === examId).map(s => {
        const subject = getTable('subjects').find(sub => sub.id === s.subject_id)
        const section = getTable('sections').find(sec => sec.id === s.section_id)
        return { ...s, subject, section }
      })
      responseData = filtered
    }

    else if (path.startsWith('/exams/') && partsMatches(path, '/exams/:id/schedules') && method === 'post') {
      const examId = path.split('/')[2]
      const schedules = getTable('exam_schedules')
      const newSched = {
        ...data,
        exam_id: examId,
        id: `exs-${generateId()}`
      }
      schedules.push(newSched)
      saveTable('exam_schedules', schedules)
      responseData = newSched
    }

    else if (path.startsWith('/exams/schedules/') && method === 'get') {
      const parts = path.split('/')
      const schedId = parts[3]
      const marks = getTable('exam_marks')
      const filtered = marks.filter(m => m.schedule_id === schedId).map(m => {
        const student = getTable('students').find(s => s.id === m.student_id)
        return { ...m, student }
      })
      responseData = filtered
    }

    else if (path.startsWith('/exams/schedules/') && partsMatches(path, '/exams/schedules/:id/marks') && method === 'post') {
      const schedId = path.split('/')[3]
      const marks = getTable('exam_marks')
      // Remove old marks
      const filtered = marks.filter(m => m.schedule_id !== schedId)
      // Add new marks
      const newMarks = data.records.map((r: any) => ({
        id: `m-${generateId()}`,
        schedule_id: schedId,
        student_id: r.student_id,
        marks_obtained: Number(r.marks_obtained),
        remarks: r.remarks || ''
      }))
      saveTable('exam_marks', [...filtered, ...newMarks])
      responseData = { success: true }
    }

    // -------------------------------------------------------------
    // LMS
    // -------------------------------------------------------------
    else if (path === '/exams/lms/assignments' && method === 'get') {
      const assignments = getTable('assignments')
      const filtered = assignments.filter(a => a.section_id === params.section_id)
      responseData = filtered
    }

    else if (path === '/exams/lms/assignments' && method === 'post') {
      const assignments = getTable('assignments')
      const newAsg = {
        ...data,
        id: `asg-${generateId()}`,
        file_url: '#'
      }
      assignments.push(newAsg)
      saveTable('assignments', assignments)
      responseData = newAsg
    }

    else if (path.startsWith('/exams/lms/assignments/') && method === 'get') {
      const id = path.split('/')[4]
      const subs = getTable('submissions')
      const filtered = subs.filter(s => s.assignment_id === id).map(s => {
        const student = getTable('students').find(st => st.id === s.student_id)
        return { ...s, student }
      })
      responseData = filtered
    }

    else if (path.startsWith('/exams/lms/assignments/') && method === 'post') {
      const id = path.split('/')[4]
      const subs = getTable('submissions')
      const newSub = {
        id: `subm-${generateId()}`,
        assignment_id: id,
        student_id: data.student_id || 'st-1',
        file_url: '#',
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        marks_obtained: 0,
        feedback: ''
      }
      subs.push(newSub)
      saveTable('submissions', subs)
      responseData = newSub
    }

    else if (path.startsWith('/exams/lms/submissions/') && method === 'post') {
      const id = path.split('/')[4]
      const subs = getTable('submissions')
      const idx = subs.findIndex(s => s.id === id)
      if (idx !== -1) {
        subs[idx].marks_obtained = Number(data.marks_obtained)
        subs[idx].feedback = data.feedback || ''
        subs[idx].status = 'graded'
        saveTable('submissions', subs)
        responseData = subs[idx]
      } else {
        status = 404
        message = 'Submission not found'
      }
    }

    // -------------------------------------------------------------
    // FEES
    // -------------------------------------------------------------
    else if (path === '/fees/structures' && method === 'get') {
      responseData = getTable('fee_structures')
    }

    else if (path === '/fees/structures' && method === 'post') {
      const fee_structures = getTable('fee_structures')
      const newFS = {
        ...data,
        id: `fs-${generateId()}`,
        is_mandatory: true
      }
      fee_structures.push(newFS)
      saveTable('fee_structures', fee_structures)
      responseData = newFS
    }

    else if (path === '/fees/payments' && method === 'get') {
      const payments = getTable('fee_payments')
      let filtered = payments
      if (params.student_id) {
        filtered = filtered.filter(p => p.student_id === params.student_id)
      }
      responseData = filtered.map(p => {
        const student = getTable('students').find(s => s.id === p.student_id)
        const feeStructure = getTable('fee_structures').find(fs => fs.id === p.fee_structure_id)
        return { ...p, student, fee_structure: feeStructure }
      })
    }

    else if (path === '/fees/payments' && method === 'post') {
      const payments = getTable('fee_payments')
      const newPay = {
        ...data,
        id: `fp-${generateId()}`,
        receipt_number: `REC-${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`
      }
      payments.push(newPay)
      saveTable('fee_payments', payments)
      responseData = newPay
    }

    else if (path === '/fees/student-balances' && method === 'get') {
      const students = getTable('students')
      const payments = getTable('fee_payments')
      const structures = getTable('fee_structures')
      
      const classStudents = students.filter(s => {
        if (params.section_id) return s.section_id === params.section_id
        return true
      })

      const totalFee = structures.reduce((sum, fs) => sum + fs.amount, 0)

      responseData = classStudents.map(s => {
        const studentPayments = payments.filter(p => p.student_id === s.id)
        const paid = studentPayments.reduce((sum, p) => sum + p.amount_paid, 0)
        return {
          student_id: s.id,
          student: s,
          total_fee: totalFee,
          amount_paid: paid,
          balance: totalFee - paid
        }
      })
    }

    // -------------------------------------------------------------
    // LIBRARY
    // -------------------------------------------------------------
    else if (path === '/ancillary/library/books' && method === 'get') {
      responseData = getTable('books')
    }

    else if (path === '/ancillary/library/books' && method === 'post') {
      const books = getTable('books')
      const newBook = {
        ...data,
        id: `b-${generateId()}`,
        available: data.quantity
      }
      books.push(newBook)
      saveTable('books', books)
      responseData = newBook
    }

    else if (path === '/ancillary/library/issues' && method === 'get') {
      const issues = getTable('book_issues')
      responseData = issues.map(i => {
        const student = getTable('students').find(s => s.id === i.student_id)
        const book = getTable('books').find(b => b.id === i.book_id)
        return { ...i, student, book }
      })
    }

    else if (path === '/ancillary/library/issues' && method === 'post') {
      const issues = getTable('book_issues')
      const books = getTable('books')
      const bookIdx = books.findIndex(b => b.id === data.book_id)
      
      if (bookIdx !== -1 && books[bookIdx].available > 0) {
        books[bookIdx].available -= 1
        saveTable('books', books)

        const newIssue = {
          ...data,
          id: `bi-${generateId()}`,
          return_date: '',
          status: 'issued'
        }
        issues.push(newIssue)
        saveTable('book_issues', issues)
        responseData = newIssue
      } else {
        status = 400
        message = 'Book is out of stock'
      }
    }

    else if (path.startsWith('/ancillary/library/issues/') && path.endsWith('/return') && method === 'post') {
      const id = path.split('/')[4]
      const issues = getTable('book_issues')
      const issueIdx = issues.findIndex(i => i.id === id)
      
      if (issueIdx !== -1) {
        issues[issueIdx].status = 'returned'
        issues[issueIdx].return_date = new Date().toISOString().split('T')[0]
        
        const books = getTable('books')
        const bookIdx = books.findIndex(b => b.id === issues[issueIdx].book_id)
        if (bookIdx !== -1) {
          books[bookIdx].available = Math.min(books[bookIdx].quantity, books[bookIdx].available + 1)
          saveTable('books', books)
        }
        
        saveTable('book_issues', issues)
        responseData = issues[issueIdx]
      } else {
        status = 404
        message = 'Issue record not found'
      }
    }

    // -------------------------------------------------------------
    // HOSTELS
    // -------------------------------------------------------------
    else if (path === '/ancillary/hostel/hostels' && method === 'get') {
      responseData = getTable('hostels')
    }

    else if (path === '/ancillary/hostel/hostels' && method === 'post') {
      const hostels = getTable('hostels')
      const newHostel = {
        ...data,
        id: `h-${generateId()}`
      }
      hostels.push(newHostel)
      saveTable('hostels', hostels)
      responseData = newHostel
    }

    else if (path === '/ancillary/hostel/rooms' && method === 'get') {
      const rooms = getTable('hostel_rooms')
      if (params.hostel_id) {
        responseData = rooms.filter(r => r.hostel_id === params.hostel_id)
      } else {
        responseData = rooms
      }
    }

    else if (path === '/ancillary/hostel/rooms' && method === 'post') {
      const rooms = getTable('hostel_rooms')
      const newRoom = {
        ...data,
        id: `hr-${generateId()}`
      }
      rooms.push(newRoom)
      saveTable('hostel_rooms', rooms)
      responseData = newRoom
    }

    // -------------------------------------------------------------
    // TRANSPORT
    // -------------------------------------------------------------
    else if (path === '/ancillary/transport/routes' && method === 'get') {
      responseData = getTable('transport_routes')
    }

    else if (path === '/ancillary/transport/routes' && method === 'post') {
      const routes = getTable('transport_routes')
      const newRoute = {
        ...data,
        id: `tr-${generateId()}`
      }
      routes.push(newRoute)
      saveTable('transport_routes', routes)
      responseData = newRoute
    }

    else if (path === '/ancillary/transport/vehicles' && method === 'get') {
      responseData = getTable('vehicles')
    }

    else if (path === '/ancillary/transport/vehicles' && method === 'post') {
      const vehicles = getTable('vehicles')
      const newVehicle = {
        ...data,
        id: `v-${generateId()}`
      }
      vehicles.push(newVehicle)
      saveTable('vehicles', vehicles)
      responseData = newVehicle
    }

    // -------------------------------------------------------------
    // AI CHAT & PERFORMANCE PREDICTION
    // -------------------------------------------------------------
    else if (path === '/ai/chat' && method === 'post') {
      const query = (data.message || '').toLowerCase()
      const students = getTable('students')
      const feePayments = getTable('fee_payments')
      const attendance = getTable('attendance')
      const staff = getTable('staff')

      let response = ""

      if (query.includes('count') || query.includes('how many') || query.includes('number of') || query.includes('total')) {
        if (query.includes('student') || query.includes('enrolled')) {
          response = `### 🎓 Total Student Count\nThere are currently **${students.length}** active registered students in Siddardha High School.`
        } else if (query.includes('fee') || query.includes('payment')) {
          const totalCollected = feePayments.reduce((acc: number, f: any) => acc + (parseFloat(f.amount_paid) || 0), 0)
          response = `### 💳 Fee Summary\nTotal fee transactions: **${feePayments.length}** payments. Total revenue collected: **₹${totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}**.`
        } else if (query.includes('staff') || query.includes('teacher')) {
          response = `### 👥 Staff Directory\nThere are currently **${staff.length || 15}** faculty and staff members registered.`
        } else {
          response = `### 🏫 School Overview Counts\n- 🎓 **Total Students:** ${students.length}\n- 👥 **Total Staff & Faculty:** ${staff.length || 15}\n- 💳 **Fee Payment Records:** ${feePayments.length}\n- 📅 **Attendance Records:** ${attendance.length}`
        }
      } else if (query.includes('student') || query.includes('performance') || query.includes('find') || query.includes('search')) {
        const words = query.split(/\s+/).filter((w: string) => w.length > 2 && !['student', 'students', 'show', 'find', 'list', 'search', 'what', 'is', 'the', 'count', 'for', 'current'].includes(w))
        let matched = students
        if (words.length > 0) {
          matched = students.filter((s: any) => words.some((w: string) => `${s.first_name} ${s.last_name} ${s.admission_number} ${s.roll_number}`.toLowerCase().includes(w)))
        }
        if (matched.length > 0) {
          const listStr = matched.slice(0, 8).map((s: any) => `- **${s.first_name} ${s.last_name}** | Adm No: \`${s.admission_number}\` | Roll: \`${s.roll_number || 'N/A'}\``).join('\n')
          response = `### 🎓 Student Search Results (${matched.length} found out of ${students.length} total):\n${listStr}`
        } else {
          response = `No specific student records matched your query. Total active students: **${students.length}**.`
        }
      } else if (query.includes('fee') || query.includes('outstanding') || query.includes('balance') || query.includes('collection')) {
        const totalCollected = feePayments.reduce((acc: number, f: any) => acc + (parseFloat(f.amount_paid) || 0), 0)
        response = `### 💳 Fee Collection Summary\n- **Total Revenue Collected:** ₹${totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n- **Total Payment Receipts Issued:** ${feePayments.length}`
      } else if (query.includes('attendance')) {
        const presentCount = attendance.filter((a: any) => a.status === 'present').length
        const totalAtt = attendance.length || 1
        const pct = totalAtt > 0 ? (presentCount / totalAtt * 100).toFixed(1) : '94.2'
        response = `### 📅 Attendance Summary\n- **Total Attendance Logs:** ${totalAtt}\n- **Present:** ${presentCount}\n- **Overall Rate:** **${pct}%**`
      } else {
        response = `Hello! I am your **Siddardha High School AI Assistant**.\n\n### 🏫 Current Database Overview:\n- 🎓 **Total Students:** ${students.length}\n- 👥 **Total Staff:** ${staff.length || 15}\n- 💳 **Fee Payments:** ${feePayments.length}\n\nAsk me any question like *"current count of student"*, *"show fee collection"*, or *"search student Rahul"*!`
      }
      responseData = { response }
    }

    else if (path === '/ai/predict-performance' && method === 'post') {
      responseData = {
        student_id: data.student_id,
        predicted_gpa: '8.8 / 10',
        confidence_score: '91%',
        risk_level: 'Low',
        strengths: ['Mathematics', 'Science'],
        weaknesses: ['English'],
        recommendations: [
          'Enroll in conversational English exercises.',
          'Maintains strong logic skills; recommended for Olympiad tests.'
        ]
      }
    }

    // -------------------------------------------------------------
    // REPORTS
    // -------------------------------------------------------------
    else if (path === '/reports/attendance-summary' && method === 'get') {
      responseData = [
        { label: 'Class 10 A', present: 28, absent: 2, percentage: 93.3 },
        { label: 'Class 10 B', present: 27, absent: 3, percentage: 90.0 },
        { label: 'Class 9 A', present: 30, absent: 0, percentage: 100.0 }
      ]
    }

    else if (path === '/reports/fee-outstanding' && method === 'get') {
      responseData = {
        total_expected: 93600,
        total_collected: 30000,
        outstanding: 63600,
        collection_percentage: 32.0,
        by_class: [
          { class_name: 'Class 10', collected: 30000, outstanding: 31200 },
          { class_name: 'Class 9', collected: 0, outstanding: 16200 },
          { class_name: 'Class 8', collected: 0, outstanding: 16200 }
        ]
      }
    }

    // -------------------------------------------------------------
    // DEVELOPER PANEL
    // -------------------------------------------------------------
    else if (path === '/developer/health' && method === 'get') {
      responseData = {
        status: 'ok',
        db: 'ok (In-Browser)',
        redis: 'ok (Mock)',
        celery: 'ok (Mock)',
        version: '1.0.0-mock'
      }
    }

    else if (path === '/developer/seed' && method === 'post') {
      resetMockDb()
      responseData = { success: true, message: 'Mock Database Reset and Seeded!' }
    }

    else if (path === '/developer/logs' && method === 'get') {
      responseData = getTable('dev_logs')
    }

    // -------------------------------------------------------------
    // TEACHERS MODULE
    // -------------------------------------------------------------
    else if (path === '/teachers/' && method === 'get') {
      responseData = getTable('teachers')
    }

    else if (path === '/teachers/' && method === 'post') {
      const teachers = getTable('teachers')
      const newTeacher = {
        ...data,
        id: `t-${generateId()}`,
        is_active: true
      }
      teachers.push(newTeacher)
      saveTable('teachers', teachers)
      responseData = newTeacher
    }

    else if (path.startsWith('/teachers/') && method === 'delete') {
      const id = path.split('/')[2]
      const teachers = getTable('teachers')
      const filtered = teachers.filter(t => t.id !== id)
      saveTable('teachers', filtered)
      responseData = { success: true }
    }

    // -------------------------------------------------------------
    // TIMETABLE
    // -------------------------------------------------------------
    else if (path.startsWith('/timetable/class/') && method === 'get') {
      const parts = path.split('/')
      const classId = parts[3]
      const sectionId = parts[5]
      const tts = getTable('timetable')
      responseData = tts.filter(t => t.class_id === classId && t.section_id === sectionId).map(t => {
        const subject = getTable('subjects').find(s => s.id === t.subject_id)
        const teacher = getTable('teachers').find(tr => tr.id === t.teacher_id)
        return { ...t, subject, teacher }
      })
    }

    else if (path === '/timetable/' && method === 'post') {
      const tts = getTable('timetable')
      const newEntry = {
        ...data,
        id: `tt-${generateId()}`
      }
      tts.push(newEntry)
      saveTable('timetable', tts)
      responseData = newEntry
    }

    else if (path.startsWith('/timetable/') && method === 'delete') {
      const id = path.split('/')[2]
      const tts = getTable('timetable')
      const filtered = tts.filter(t => t.id !== id)
      saveTable('timetable', filtered)
      responseData = { success: true }
    }

    else if (path === '/timetable/subjects' && method === 'get') {
      responseData = getTable('subjects')
    }

    // -------------------------------------------------------------
    // PAYROLL
    // -------------------------------------------------------------
    else if (path === '/payroll/structures' && method === 'get') {
      responseData = getTable('payroll_structures')
    }

    else if (path === '/payroll/structures' && method === 'post') {
      const structs = getTable('payroll_structures')
      const newS = { ...data, id: `ss-${generateId()}` }
      structs.push(newS)
      saveTable('payroll_structures', structs)
      responseData = newS
    }

    else if (path === '/payroll/generate' && method === 'post') {
      const payrolls = getTable('payrolls')
      const staff = getTable('hr_staff')
      const structures = getTable('payroll_structures')

      // Filter out existing payrolls for the given month/year
      const filtered = payrolls.filter(p => !(p.month === data.month && p.year === data.year))
      
      const newPays = staff.map(s => {
        const struct = structures.find(st => st.id === s.salary_structure_id) || { basic_pay: 20000, allowances: 2000, deductions: 1000 }
        return {
          id: `pr-${generateId()}`,
          staff_id: s.id,
          month: data.month,
          year: data.year,
          basic_pay: struct.basic_pay,
          allowances: struct.allowances,
          deductions: struct.deductions,
          net_pay: struct.basic_pay + struct.allowances - struct.deductions,
          status: 'pending',
          paid_at: ''
        }
      })

      saveTable('payrolls', [...filtered, ...newPays])
      responseData = newPays
    }

    else if (path === '/payroll/' && method === 'get') {
      const payrolls = getTable('payrolls')
      const staff = getTable('hr_staff')
      
      const month = Number(params.month)
      const year = Number(params.year)

      let filtered = payrolls
      if (month && year) {
        filtered = filtered.filter(p => p.month === month && p.year === year)
      }

      responseData = filtered.map(p => {
        const st = staff.find(s => s.id === p.staff_id)
        return { ...p, staff: st }
      })
    }

    else if (path.startsWith('/payroll/') && path.endsWith('/pay') && method === 'post') {
      const id = path.split('/')[2]
      const payrolls = getTable('payrolls')
      const idx = payrolls.findIndex(p => p.id === id)
      if (idx !== -1) {
        payrolls[idx].status = 'paid'
        payrolls[idx].paid_at = new Date().toISOString().split('T')[0]
        saveTable('payrolls', payrolls)
        responseData = payrolls[idx]
      } else {
        status = 404
        message = 'Payroll record not found'
      }
    }

    // -------------------------------------------------------------
    // HR / STAFF / LEAVES
    // -------------------------------------------------------------
    else if (path === '/hr/staff' && method === 'get') {
      responseData = getTable('hr_staff')
    }

    else if (path === '/hr/staff' && method === 'post') {
      const staff = getTable('hr_staff')
      const newStaff = { ...data, id: `hs-${generateId()}` }
      staff.push(newStaff)
      saveTable('hr_staff', staff)
      responseData = newStaff
    }

    else if (path === '/hr/leaves' && method === 'get') {
      const leaves = getTable('hr_leaves')
      const staff = getTable('hr_staff')
      responseData = leaves.map(l => {
        const st = staff.find(s => s.id === l.staff_id)
        return { ...l, staff: st }
      })
    }

    else if (path === '/hr/leaves' && method === 'post') {
      const leaves = getTable('hr_leaves')
      const newL = {
        ...data,
        id: `l-${generateId()}`,
        status: 'pending'
      }
      leaves.push(newL)
      saveTable('hr_leaves', leaves)
      responseData = newL
    }

    else if (path.startsWith('/hr/leaves/') && path.endsWith('/approve') && method === 'post') {
      const id = path.split('/')[3]
      const leaves = getTable('hr_leaves')
      const idx = leaves.findIndex(l => l.id === id)
      if (idx !== -1) {
        leaves[idx].status = 'approved'
        saveTable('hr_leaves', leaves)
        responseData = leaves[idx]
      } else {
        status = 404; message = 'Leave not found'
      }
    }

    else if (path.startsWith('/hr/leaves/') && path.endsWith('/reject') && method === 'post') {
      const id = path.split('/')[3]
      const leaves = getTable('hr_leaves')
      const idx = leaves.findIndex(l => l.id === id)
      if (idx !== -1) {
        leaves[idx].status = 'rejected'
        saveTable('hr_leaves', leaves)
        responseData = leaves[idx]
      } else {
        status = 404; message = 'Leave not found'
      }
    }

    // -------------------------------------------------------------
    // NOTICE BOARD
    // -------------------------------------------------------------
    else if (path === '/notice-board/' && method === 'get') {
      responseData = getTable('notices')
    }

    else if (path === '/notice-board/' && method === 'post') {
      const notices = getTable('notices')
      const newN = {
        ...data,
        id: `n-${generateId()}`,
        is_published: false,
        created_at: new Date().toISOString()
      }
      notices.push(newN)
      saveTable('notices', notices)
      responseData = newN
    }

    else if (path.startsWith('/notice-board/') && path.endsWith('/publish') && method === 'post') {
      const id = path.split('/')[2]
      const notices = getTable('notices')
      const idx = notices.findIndex(n => n.id === id)
      if (idx !== -1) {
        notices[idx].is_published = true
        notices[idx].published_at = new Date().toISOString()
        saveTable('notices', notices)
        responseData = notices[idx]
      } else {
        status = 404; message = 'Notice not found'
      }
    }

    // -------------------------------------------------------------
    // MESSAGES
    // -------------------------------------------------------------
    else if (path === '/messages/' && method === 'get') {
      responseData = getTable('messages')
    }

    else if (path === '/messages/send' && method === 'post') {
      const messagesTable = getTable('messages')
      const newM = {
        ...data,
        id: `msg-${generateId()}`,
        is_read: false,
        timestamp: new Date().toISOString()
      }
      messagesTable.push(newM)
      saveTable('messages', messagesTable)
      responseData = newM
    }

    else if (path.startsWith('/messages/') && path.endsWith('/read') && method === 'post') {
      const id = path.split('/')[2]
      const messagesTable = getTable('messages')
      const idx = messagesTable.findIndex(m => m.id === id)
      if (idx !== -1) {
        messagesTable[idx].is_read = true
        saveTable('messages', messagesTable)
        responseData = messagesTable[idx]
      } else {
        status = 404; message = 'Message not found'
      }
    }

    // -------------------------------------------------------------
    // CIRCULARS
    // -------------------------------------------------------------
    else if (path === '/circulars/' && method === 'get') {
      responseData = getTable('circulars')
    }

    else if (path === '/circulars/' && method === 'post') {
      const circulars = getTable('circulars')
      const newC = {
        ...data,
        id: `cir-${generateId()}`,
        file_url: '#',
        created_at: new Date().toISOString()
      }
      circulars.push(newC)
      saveTable('circulars', circulars)
      responseData = newC
    }

    // -------------------------------------------------------------
    // DASHBOARD STATS
    // -------------------------------------------------------------
    else if (path === '/dashboard/stats' && method === 'get') {
      const students = getTable('students')
      const teachers = getTable('teachers')
      const notices = getTable('notices')
      const books = getTable('books')

      const totalSt = students.length
      const activeSt = students.filter(s => s.is_active).length
      
      const payments = getTable('fee_payments')
      const collection = payments.reduce((sum, p) => sum + p.amount_paid, 0)

      responseData = {
        total_students: totalSt,
        active_students: activeSt,
        total_teachers: teachers.length,
        fee_collection: collection,
        attendance_today: 94.5,
        recent_notices: notices.filter(n => n.is_published).slice(0, 3),
        library_books: books.length
      }
    }

    // -------------------------------------------------------------
    // DEFAULT ROUTE
    // -------------------------------------------------------------
    else {
      // Catch-all mock response for unsupported routes
      console.warn(`Mock API: Route not specifically handled: ${method.toUpperCase()} ${path}`)
      responseData = []
    }

  } catch (err: any) {
    status = 500
    message = err.message || 'Mock database error'
    addLog('ERROR', `Mock Handler Error: ${message}`)
  }

  // Delay response slightly to simulate network latency
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (status >= 200 && status < 300) {
        resolve({
          data: {
            success: true,
            data: responseData,
            meta: metaData,
            message: message
          },
          status,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          config
        })
      } else {
        reject({
          response: {
            data: {
              success: false,
              detail: message,
              error: { message }
            },
            status,
            statusText: status === 401 ? 'Unauthorized' : status === 404 ? 'Not Found' : 'Internal Server Error',
            headers: { 'content-type': 'application/json' },
            config
          }
        })
      }
    }, 150)
  })
}
