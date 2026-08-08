import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/router/ProtectedRoute'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { ChangePasswordPage } from '@/pages/auth/ChangePasswordPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { StudentsPage } from '@/pages/students/StudentsPage'
import { StudentProfilePage } from '@/pages/students/StudentProfilePage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
// Import all scaffolded module pages
import { TeachersPage } from '@/pages/teachers/TeachersPage'
import { AttendancePage } from '@/pages/attendance/AttendancePage'
import { TimetablePage } from '@/pages/timetable/TimetablePage'
import { ExaminationsPage } from '@/pages/examinations/ExaminationsPage'
import { LmsPage } from '@/pages/lms/LmsPage'
import { FeesPage } from '@/pages/fees/FeesPage'
import { PayrollPage } from '@/pages/payroll/PayrollPage'
import { HrPage } from '@/pages/hr/HrPage'
import { AdmissionsPage } from '@/pages/admissions/AdmissionsPage'
import { LibraryPage } from '@/pages/library/LibraryPage'
import { TransportPage } from '@/pages/transport/TransportPage'
import { HostelPage } from '@/pages/hostel/HostelPage'
import { NoticeboardPage } from '@/pages/noticeboard/NoticeboardPage'
import { MessagingPage } from '@/pages/messaging/MessagingPage'
import { CircularsPage } from '@/pages/circulars/CircularsPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { DeveloperPage } from '@/pages/developer/DeveloperPage'
import { PortalAccessPage } from '@/pages/portal-access/PortalAccessPage'
import { AiAssistantPage } from '@/pages/ai-assistant/AiAssistantPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/portal-login" element={<PortalAccessPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/403" element={<PlaceholderPage title="Access Denied" />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/ai-assistant" element={<AiAssistantPage />} />
        <Route path="/portal-access" element={<PortalAccessPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route
          path="/students"
          element={
            <ProtectedRoute permission="students:view">
              <StudentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/students/:id"
          element={
            <ProtectedRoute permission="students:view">
              <StudentProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="/teachers" element={<TeachersPage />} />
        <Route
          path="/attendance"
          element={
            <ProtectedRoute permission="attendance:view">
              <AttendancePage />
            </ProtectedRoute>
          }
        />
        <Route path="/timetable" element={<TimetablePage />} />
        <Route
          path="/examinations"
          element={
            <ProtectedRoute permission="exams:view">
              <ExaminationsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/lms" element={<LmsPage />} />
        <Route
          path="/fees"
          element={
            <ProtectedRoute permission="fees:view">
              <FeesPage />
            </ProtectedRoute>
          }
        />
        <Route path="/payroll" element={<PayrollPage />} />
        <Route path="/hr" element={<HrPage />} />
        <Route path="/admissions" element={<AdmissionsPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/transport" element={<TransportPage />} />
        <Route path="/hostel" element={<HostelPage />} />
        <Route path="/noticeboard" element={<NoticeboardPage />} />
        <Route path="/messaging" element={<MessagingPage />} />
        <Route path="/circulars" element={<CircularsPage />} />
        <Route
          path="/reports"
          element={
            <ProtectedRoute permission="reports:view">
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute permission="settings:view">
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/developer"
          element={
            <ProtectedRoute permission="developer:access">
              <DeveloperPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="/change-password-first" element={<ChangePasswordPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
