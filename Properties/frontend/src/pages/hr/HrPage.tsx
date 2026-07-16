import { useState } from 'react'
import { toast } from 'sonner'
import { Users, FileText, UserPlus, Calendar, Check, X } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { DataTable } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { FormField } from '@/components/shared/FormField'
import { Badge } from '@/components/ui/Badge'
import {
  useHRStaff,
  useOnboardStaff,
  useHRLeaves,
  useApplyLeave,
  useApproveLeave,
  useRejectLeave,
} from '@/api/hooks'

export function HrPage() {
  const [activeTab, setActiveTab] = useState<'employees' | 'leaves'>('employees')

  const { data: staffList, isLoading: isStaffLoading } = useHRStaff()
  const { data: leaves, isLoading: isLeavesLoading } = useHRLeaves()

  const onboardStaffMutation = useOnboardStaff()
  const applyLeaveMutation = useApplyLeave()
  const approveLeaveMutation = useApproveLeave()
  const rejectLeaveMutation = useRejectLeave()

  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false)
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false)

  const [onboardForm, setOnboardForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    employee_id: '',
    department: 'Administration',
    role: 'librarian',
    password: 'Staff@12345',
  })

  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'sick',
    from_date: '',
    to_date: '',
    reason: '',
  })

  const staffColumns = [
    {
      accessorKey: 'employee_id',
      header: 'Employee ID',
      cell: ({ row }: any) => <span className="font-mono text-xs font-semibold">{row.original.employee_id}</span>,
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }: any) => (
        <span className="font-medium text-slate-900 dark:text-white">
          {row.original.first_name} {row.original.last_name}
        </span>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }: any) => <span className="capitalize">{row.original.role.replace('_', ' ')}</span>,
    },
    {
      accessorKey: 'department',
      header: 'Department',
    },
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }: any) => (
        <Badge variant={row.original.is_active ? 'success' : 'neutral'}>
          {row.original.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ]

  const leaveColumns = [
    {
      accessorKey: 'applicant_name',
      header: 'Applicant',
    },
    {
      accessorKey: 'applicant_role',
      header: 'Role',
      cell: ({ row }: any) => <span className="capitalize">{row.original.applicant_role.replace('_', ' ')}</span>,
    },
    {
      accessorKey: 'leave_type',
      header: 'Type',
      cell: ({ row }: any) => <span className="capitalize font-medium">{row.original.leave_type}</span>,
    },
    {
      accessorKey: 'dates',
      header: 'Duration',
      cell: ({ row }: any) => (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {row.original.from_date} to {row.original.to_date} ({row.original.days} days)
        </span>
      ),
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => {
        const s = row.original.status
        const variant = s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : 'warning'
        return <Badge variant={variant}>{s}</Badge>
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) =>
        row.original.status === 'pending' ? (
          <div className="flex gap-2">
            <button
              onClick={() => handleApproveLeave(row.original.id)}
              className="rounded p-1 text-green-600 hover:bg-green-50"
              title="Approve Leave"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleRejectLeave(row.original.id)}
              className="rounded p-1 text-red-600 hover:bg-red-50"
              title="Reject Leave"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Processed</span>
        ),
    },
  ]

  const handleApproveLeave = async (id: string) => {
    try {
      await approveLeaveMutation.mutateAsync(id)
      toast.success('Leave application approved')
    } catch {
      toast.error('Failed to approve leave')
    }
  }

  const handleRejectLeave = async (id: string) => {
    try {
      await rejectLeaveMutation.mutateAsync(id)
      toast.success('Leave application rejected')
    } catch {
      toast.error('Failed to reject leave')
    }
  }

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await onboardStaffMutation.mutateAsync(onboardForm)
      toast.success('Employee onboarded successfully')
      setIsOnboardModalOpen(false)
      setOnboardForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        employee_id: '',
        department: 'Administration',
        role: 'librarian',
        password: 'Staff@12345',
      })
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to onboard staff')
    }
  }

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await applyLeaveMutation.mutateAsync(leaveForm)
      toast.success('Leave request submitted successfully')
      setIsApplyModalOpen(false)
      setLeaveForm({ leave_type: 'sick', from_date: '', to_date: '', reason: '' })
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to submit leave request')
    }
  }

  return (
    <PageWrapper
      title="HR Management"
      description="Manage staff onboarding, roles, employee directories, and leave approvals."
      actions={
        <div className="flex gap-3">
          <button
            onClick={() => setIsApplyModalOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700"
          >
            <Calendar className="h-4 w-4" /> Request Leave
          </button>
          <button
            onClick={() => setIsOnboardModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <UserPlus className="h-4 w-4" /> Onboard Employee
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('employees')}
            className={`border-b-2 px-6 py-3 text-sm font-semibold ${
              activeTab === 'employees'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Employee Directory
          </button>
          <button
            onClick={() => setActiveTab('leaves')}
            className={`border-b-2 px-6 py-3 text-sm font-semibold ${
              activeTab === 'leaves'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Leave Requests
          </button>
        </div>

        {activeTab === 'employees' ? (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <DataTable
              columns={staffColumns}
              data={staffList || []}
              isLoading={isStaffLoading}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <DataTable
              columns={leaveColumns}
              data={leaves || []}
              isLoading={isLeavesLoading}
            />
          </div>
        )}
      </div>

      {/* Staff onboard modal */}
      <Modal
        isOpen={isOnboardModalOpen}
        onClose={() => setIsOnboardModalOpen(false)}
        title="Onboard Staff Member"
      >
        <form onSubmit={handleOnboardSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="First Name" required>
              <input
                type="text"
                required
                value={onboardForm.first_name}
                onChange={(e) => setOnboardForm({ ...onboardForm, first_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </FormField>
            <FormField label="Last Name" required>
              <input
                type="text"
                required
                value={onboardForm.last_name}
                onChange={(e) => setOnboardForm({ ...onboardForm, last_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </FormField>
          </div>

          <FormField label="Email Address" required>
            <input
              type="email"
              required
              value={onboardForm.email}
              onChange={(e) => setOnboardForm({ ...onboardForm, email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </FormField>

          <FormField label="Phone Number">
            <input
              type="text"
              value={onboardForm.phone}
              onChange={(e) => setOnboardForm({ ...onboardForm, phone: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Employee ID" required>
              <input
                type="text"
                required
                value={onboardForm.employee_id}
                onChange={(e) => setOnboardForm({ ...onboardForm, employee_id: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </FormField>
            <FormField label="Department" required>
              <select
                value={onboardForm.department}
                onChange={(e) => setOnboardForm({ ...onboardForm, department: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="Administration">Administration</option>
                <option value="Finance">Finance</option>
                <option value="Academic Support">Academic Support</option>
                <option value="Facilities">Facilities</option>
              </select>
            </FormField>
          </div>

          <FormField label="Portal Role" required>
            <select
              value={onboardForm.role}
              onChange={(e) => setOnboardForm({ ...onboardForm, role: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 text-sm capitalize"
            >
              <option value="librarian">Librarian</option>
              <option value="accountant">Accountant</option>
              <option value="transport_manager">Transport Manager</option>
              <option value="hostel_warden">Hostel Warden</option>
              <option value="hr_manager">HR Manager</option>
            </select>
          </FormField>

          <FormField label="Default Portal Password" required>
            <input
              type="password"
              required
              value={onboardForm.password}
              onChange={(e) => setOnboardForm({ ...onboardForm, password: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsOnboardModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Save Profile
            </button>
          </div>
        </form>
      </Modal>

      {/* Apply leave modal */}
      <Modal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        title="Request Leave Application"
      >
        <form onSubmit={handleLeaveSubmit} className="space-y-4">
          <FormField label="Leave Type" required>
            <select
              value={leaveForm.leave_type}
              onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="sick">Sick Leave</option>
              <option value="casual">Casual Leave</option>
              <option value="annual">Annual Leave</option>
              <option value="maternity/paternity">Maternity/Paternity</option>
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="From Date" required>
              <input
                type="date"
                required
                value={leaveForm.from_date}
                onChange={(e) => setLeaveForm({ ...leaveForm, from_date: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </FormField>
            <FormField label="To Date" required>
              <input
                type="date"
                required
                value={leaveForm.to_date}
                onChange={(e) => setLeaveForm({ ...leaveForm, to_date: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </FormField>
          </div>

          <FormField label="Reason for Leave" required>
            <textarea
              required
              rows={3}
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              placeholder="e.g., Doctor appointment"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsApplyModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Submit Application
            </button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  )
}
