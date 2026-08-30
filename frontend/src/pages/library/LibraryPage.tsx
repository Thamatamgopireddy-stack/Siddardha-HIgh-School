import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, BookOpen, UserCheck, ArrowUpRight, CheckCircle2 } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { FormField } from '@/components/shared/FormField'
import { Modal } from '@/components/shared/Modal'
import { DataTable } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/Badge'
import {
  useBooks,
  useCreateBook,
  useBookIssues,
  useIssueBook,
  useReturnBook,
  useAcademicYears,
  useStudents,
} from '@/api/hooks'

type LibraryTab = 'inventory' | 'issues'

export function LibraryPage() {
  const [activeTab, setActiveTab] = useState<LibraryTab>('inventory')
  
  // Modals state
  const [isAddBookOpen, setIsAddBookOpen] = useState(false)
  const [isIssueBookOpen, setIsIssueBookOpen] = useState(false)
  const [selectedBookId, setSelectedBookId] = useState<string>('')

  // API Hooks
  const { data: books, isLoading: isBooksLoading } = useBooks()
  const { data: issues, isLoading: isIssuesLoading } = useBookIssues()

  const { data: academicYears } = useAcademicYears()
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
  if (!selectedAcademicYear && academicYears && academicYears.length > 0) {
    const current = academicYears.find((y) => y.is_current)
    setSelectedAcademicYear(current ? current.id : academicYears[0].id)
  }

  const { data: studentsData } = useStudents(1, '', '', selectedAcademicYear || undefined)
  const students = studentsData?.data || []

  const createBookMutation = useCreateBook()
  const issueBookMutation = useIssueBook()
  const returnBookMutation = useReturnBook()

  // Form states
  const [bookForm, setBookForm] = useState({
    title: '',
    author: '',
    isbn: '',
    quantity: 1,
  })

  const [issueForm, setIssueForm] = useState({
    student_id: '',
    issue_date: new Date().toISOString().split('T')[0],
  })

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createBookMutation.mutateAsync(bookForm)
      toast.success('Book catalogued successfully!')
      setIsAddBookOpen(false)
      setBookForm({ title: '', author: '', isbn: '', quantity: 1 })
    } catch {
      toast.error('Failed to add book')
    }
  }

  const handleIssueBook = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBookId) return
    try {
      await issueBookMutation.mutateAsync({
        book_id: selectedBookId,
        student_id: issueForm.student_id,
        issue_date: issueForm.issue_date,
      })
      toast.success('Book issued successfully to student!')
      setIsIssueBookOpen(false)
      setIssueForm({ student_id: '', issue_date: new Date().toISOString().split('T')[0] })
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to issue book')
    }
  }

  const handleReturnBook = async (issueId: string) => {
    try {
      await returnBookMutation.mutateAsync(issueId)
      toast.success('Book returned and inventory restocked!')
    } catch {
      toast.error('Failed to process book return')
    }
  }

  return (
    <PageWrapper
      title="Library Management"
      description="Catalogue reading books inventory and register borrowing cards."
      actions={
        <button
          onClick={() => setIsAddBookOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Catalogue Book
        </button>
      }
    >
      {/* Tabs Selector */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-[2px] ${
            activeTab === 'inventory'
              ? 'border-accent text-accent'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Books Catalogue
        </button>
        <button
          onClick={() => setActiveTab('issues')}
          className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-[2px] ${
            activeTab === 'issues'
              ? 'border-accent text-accent'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Borrowing Registry
        </button>
      </div>

      {activeTab === 'inventory' && (
        <DataTable
          columns={[
            { accessorKey: 'title', header: 'Book Title', cell: ({ row }) => <span className="font-semibold text-slate-900 dark:text-white">{row.original.title}</span> },
            { accessorKey: 'author', header: 'Author' },
            { accessorKey: 'isbn', header: 'ISBN Number', cell: ({ row }) => <span className="font-mono text-xs">{row.original.isbn || '—'}</span> },
            { accessorKey: 'quantity', header: 'Total Quantity' },
            {
              accessorKey: 'available_quantity',
              header: 'Available Copies',
              cell: ({ row }) => (
                <Badge variant={row.original.available_quantity > 0 ? 'success' : 'neutral'}>
                  {row.original.available_quantity} Copies
                </Badge>
              ),
            },
          ]}
          data={books || []}
          isLoading={isBooksLoading}
          rowActions={(row) => (
            <button
              onClick={() => {
                setSelectedBookId(row.id)
                setIsIssueBookOpen(true)
              }}
              disabled={row.available_quantity <= 0}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800"
            >
              <ArrowUpRight className="h-4 w-4 text-slate-500" />
              Issue Book
            </button>
          )}
        />
      )}

      {activeTab === 'issues' && (
        <DataTable
          columns={[
            { accessorKey: 'book_title', header: 'Book Title' },
            { accessorKey: 'student_name', header: 'Borrower Student' },
            { accessorKey: 'admission_number', header: 'Admission ID', cell: ({ row }) => <span className="font-mono text-xs text-slate-500">{row.original.admission_number}</span> },
            { accessorKey: 'issue_date', header: 'Issue Date' },
            { accessorKey: 'return_date', header: 'Return Date', cell: ({ row }) => <span>{row.original.return_date || 'Not returned'}</span> },
            {
              accessorKey: 'status',
              header: 'Borrowing Status',
              cell: ({ row }) => (
                <Badge variant={row.original.status === 'returned' ? 'success' : 'danger'}>
                  {row.original.status}
                </Badge>
              ),
            },
          ]}
          data={issues || []}
          isLoading={isIssuesLoading}
          rowActions={(row) => (
            row.status === 'issued' && (
              <button
                onClick={() => handleReturnBook(row.id)}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <CheckCircle2 className="h-4 w-4 text-success" />
                Return Book
              </button>
            )
          )}
        />
      )}

      {/* Add Book Modal */}
      {isAddBookOpen && (
        <Modal isOpen={true} onClose={() => setIsAddBookOpen(false)} title="Catalogue Reading Book">
          <form onSubmit={handleCreateBook} className="space-y-4">
            <FormField label="Book Title" required>
              <input
                type="text"
                value={bookForm.title}
                onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                placeholder="e.g. Introduction to Algorithms"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </FormField>
            <FormField label="Author Name" required>
              <input
                type="text"
                value={bookForm.author}
                onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                placeholder="e.g. Thomas H. Cormen"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="ISBN Number">
                <input
                  type="text"
                  value={bookForm.isbn}
                  onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                  placeholder="e.g. 978-0262033848"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </FormField>
              <FormField label="Stock Quantity" required>
                <input
                  type="number"
                  min={1}
                  value={bookForm.quantity}
                  onChange={(e) => setBookForm({ ...bookForm, quantity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddBookOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createBookMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Catalogue Book
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Issue Book Modal */}
      {isIssueBookOpen && (
        <Modal isOpen={true} onClose={() => setIsIssueBookOpen(false)} title="Issue Book to Student">
          <form onSubmit={handleIssueBook} className="space-y-4">
            <FormField label="Select Borrowing Student" required>
              <select
                value={issueForm.student_id}
                onChange={(e) => setIssueForm({ ...issueForm, student_id: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              >
                <option value="">Select Student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} ({s.admission_number})
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Issue Date" required>
              <input
                type="date"
                value={issueForm.issue_date}
                onChange={(e) => setIssueForm({ ...issueForm, issue_date: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </FormField>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsIssueBookOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={issueBookMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Confirm Issue
              </button>
            </div>
          </form>
        </Modal>
      )}
    </PageWrapper>
  )
}
