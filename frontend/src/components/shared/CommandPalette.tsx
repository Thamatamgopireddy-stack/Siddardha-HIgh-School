import { useEffect, useState, useRef, useTransition } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FileText, User, GraduationCap, X } from 'lucide-react'
import { api } from '@/api/client'
import { cn } from '@/utils'

interface SearchResult {
  id: string
  title: string
  subtitle?: string
  type: 'page' | 'student' | 'teacher'
  url: string
}

const STATIC_PAGES: SearchResult[] = [
  { id: 'dash', title: 'Dashboard', type: 'page', url: '/dashboard' },
  { id: 'stud', title: 'Students Registry', type: 'page', url: '/students' },
  { id: 'teach', title: 'Teachers & Staff Registry', type: 'page', url: '/teachers' },
  { id: 'att', title: 'Daily Attendance', type: 'page', url: '/attendance' },
  { id: 'tt', title: 'Weekly Timetable', type: 'page', url: '/timetable' },
  { id: 'ex', title: 'Examinations Records', type: 'page', url: '/examinations' },
  { id: 'lms', title: 'LMS & Assignments', type: 'page', url: '/lms' },
  { id: 'fees', title: 'Fees & Accounts Ledger', type: 'page', url: '/fees' },
  { id: 'pay', title: 'HR & Staff Payroll', type: 'page', url: '/payroll' },
  { id: 'hr', title: 'HR Management', type: 'page', url: '/hr' },
  { id: 'adm', title: 'Student Admissions enquiries', type: 'page', url: '/admissions' },
  { id: 'lib', title: 'Library Cataloguing', type: 'page', url: '/library' },
  { id: 'trans', title: 'Transport Manager routes', type: 'page', url: '/transport' },
  { id: 'host', title: 'Hostel allocations', type: 'page', url: '/hostel' },
  { id: 'notice', title: 'Noticeboard bulletin', type: 'page', url: '/noticeboard' },
  { id: 'msg', title: 'Messaging Chat', type: 'page', url: '/messaging' },
  { id: 'circ', title: 'Circulars bulletin', type: 'page', url: '/circulars' },
  { id: 'rep', title: 'System Reports', type: 'page', url: '/reports' },
  { id: 'set', title: 'ERP Settings', type: 'page', url: '/settings' },
  { id: 'dev', title: 'Developer Control Panel', type: 'page', url: '/developer' },
]

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [, startTransition] = useTransition()
  const navigate = useNavigate()
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      return
    }

    const timer = setTimeout(() => {
      const fetchResults = async () => {
        if (!query.trim()) {
          startTransition(() => {
            setResults(STATIC_PAGES.slice(0, 5))
          })
          return
        }

        const matchQuery = query.toLowerCase()
        const matchedPages = STATIC_PAGES.filter(
          (p) => p.title.toLowerCase().includes(matchQuery) || p.url.toLowerCase().includes(matchQuery)
        )

        // API checks for students/teachers matching
        let apiResults: SearchResult[] = []
        try {
          const { data } = await api.get('/students', { params: { search: query, limit: 5 } })
          if (data.success && data.data) {
            apiResults = data.data.map((s: any) => ({
              id: s.id,
              title: `${s.first_name} ${s.last_name}`,
              subtitle: `Student · Adm: ${s.admission_number}`,
              type: 'student',
              url: `/students/${s.id}`,
            }))
          }
        } catch {
          // Ignore failures
        }

        startTransition(() => {
          setResults([...matchedPages, ...apiResults])
          setSelectedIndex(0)
        })
      }
      fetchResults()
    }, 150)

    return () => clearTimeout(timer)
  }, [query, isOpen])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((idx) => (idx + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((idx) => (idx - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        navigate(results[selectedIndex].url)
        setIsOpen(false)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center border-b border-slate-200 px-3.5 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search pages, students..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-12 w-full border-0 bg-transparent px-3 text-sm focus:outline-none dark:text-white"
            autoFocus
          />
          <button
            onClick={() => setIsOpen(false)}
            className="rounded border border-slate-200 px-1.5 py-0.5 text-3xs text-slate-400 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
          >
            ESC
          </button>
        </div>

        {results.length > 0 ? (
          <ul ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
            {results.map((item, idx) => (
              <li
                key={item.id}
                onClick={() => {
                  navigate(item.url)
                  setIsOpen(false)
                }}
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-lg px-3.5 py-2.5 text-slate-700 dark:text-slate-300',
                  idx === selectedIndex && 'bg-blue-50 text-accent dark:bg-blue-950/30'
                )}
              >
                <div className="flex items-center gap-3">
                  {item.type === 'page' && <FileText className="h-4.5 w-4.5 text-slate-400" />}
                  {item.type === 'student' && <User className="h-4.5 w-4.5 text-slate-400" />}
                  {item.type === 'teacher' && <GraduationCap className="h-4.5 w-4.5 text-slate-400" />}
                  <div>
                    <span className="text-sm font-medium">{item.title}</span>
                    {item.subtitle && (
                      <span className="ml-2 text-2xs text-slate-400">{item.subtitle}</span>
                    )}
                  </div>
                </div>
                {idx === selectedIndex && (
                  <span className="text-3xs font-medium text-slate-400">↵ Enter</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          query && (
            <div className="py-12 text-center text-sm text-slate-400">No results found for &ldquo;{query}&rdquo;</div>
          )
        )}
      </div>
    </div>
  )
}
