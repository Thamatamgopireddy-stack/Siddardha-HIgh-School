import { useState } from 'react'
import { toast } from 'sonner'
import { UserPlus, Trash2, Mail, Phone, Shield } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { DataTable } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { FormField } from '@/components/shared/FormField'
import { Badge } from '@/components/ui/Badge'
import { useTeachers, useCreateTeacher, useDeleteTeacher } from '@/api/hooks'

export function TeachersPage() {
  const { data: teachers, isLoading } = useTeachers()
  const createTeacherMutation = useCreateTeacher()
  const deleteTeacherMutation = useDeleteTeacher()

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [formValues, setFormValues] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    employee_id: '',
    department: 'Academic',
    password: 'Teacher@12345',
  })

  const columns = [
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
      accessorKey: 'department',
      header: 'Department',
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }: any) => (
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <Mail className="h-3 w-3" /> {row.original.email}
        </span>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }: any) => (
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <Phone className="h-3 w-3" /> {row.original.phone || '—'}
        </span>
      ),
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
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <button
          onClick={() => handleDelete(row.original.id)}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
          title="Delete Teacher"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ]

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this teacher?')) return
    try {
      await deleteTeacherMutation.mutateAsync(id)
      toast.success('Teacher deleted successfully')
    } catch {
      toast.error('Failed to delete teacher')
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createTeacherMutation.mutateAsync(formValues)
      toast.success('Teacher created successfully')
      setIsAddModalOpen(false)
      setFormValues({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        employee_id: '',
        department: 'Academic',
        password: 'Teacher@12345',
      })
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create teacher')
    }
  }

  return (
    <PageWrapper
      title="Teachers"
      description="Manage school teachers, roles, and academic staff departments."
      actions={
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          <UserPlus className="h-4 w-4" /> Onboard Teacher
        </button>
      }
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <DataTable
            columns={columns}
            data={teachers || []}
            isLoading={isLoading}
          />
        </div>
      </div>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Onboard New Teacher"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="First Name" required>
              <input
                type="text"
                required
                value={formValues.first_name}
                onChange={(e) => setFormValues({ ...formValues, first_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </FormField>
            <FormField label="Last Name" required>
              <input
                type="text"
                required
                value={formValues.last_name}
                onChange={(e) => setFormValues({ ...formValues, last_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </FormField>
          </div>

          <FormField label="Email Address" required>
            <input
              type="email"
              required
              value={formValues.email}
              onChange={(e) => setFormValues({ ...formValues, email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </FormField>

          <FormField label="Phone Number">
            <input
              type="text"
              value={formValues.phone}
              onChange={(e) => setFormValues({ ...formValues, phone: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Employee ID" required>
              <input
                type="text"
                required
                value={formValues.employee_id}
                onChange={(e) => setFormValues({ ...formValues, employee_id: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </FormField>
            <FormField label="Department" required>
              <select
                value={formValues.department}
                onChange={(e) => setFormValues({ ...formValues, department: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="Academic">Academic</option>
                <option value="Science">Science</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Languages">Languages</option>
              </select>
            </FormField>
          </div>

          <FormField label="Default Portal Password" required>
            <input
              type="password"
              required
              value={formValues.password}
              onChange={(e) => setFormValues({ ...formValues, password: e.target.value })}
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
              Save Profile
            </button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  )
}
