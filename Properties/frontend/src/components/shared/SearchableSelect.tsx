import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/utils'

interface Option {
  value: string
  label: string
}

interface SearchableSelectProps {
  placeholder?: string
  value?: string
  onChange: (value: string) => void
  options?: Option[]
  loadOptions?: (search: string) => Promise<Option[]>
  disabled?: boolean
  className?: string
}

export function SearchableSelect({
  placeholder = 'Select option...',
  value,
  onChange,
  options = [],
  loadOptions,
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [loadedOptions, setLoadedOptions] = useState<Option[]>(options)
  const [isLoading, setIsLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loadOptions) {
      setLoadedOptions(options)
    }
  }, [options, loadOptions])

  useEffect(() => {
    if (!isOpen || !loadOptions) return

    const delayDebounce = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await loadOptions(search)
        setLoadedOptions(res)
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounce)
  }, [search, loadOptions, isOpen])

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    window.addEventListener('mousedown', handleOutsideClick)
    return () => window.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const selectedOption = loadedOptions.find((opt) => opt.value === value)

  const filteredOptions = loadOptions
    ? loadedOptions
    : loadedOptions.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase())
      )

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
      >
        <span className={cn('block truncate', !selectedOption && 'text-slate-400')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="relative mb-1.5">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-7 text-xs focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <ul className="space-y-0.5 max-h-48 overflow-y-auto">
            {isLoading ? (
              <li className="px-3 py-2 text-center text-xs text-slate-400">Loading...</li>
            ) : filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-center text-xs text-slate-400">No results found</li>
            ) : (
              filteredOptions.map((opt) => (
                <li
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value)
                    setIsOpen(false)
                    setSearch('')
                  }}
                  className={cn(
                    'cursor-pointer rounded px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800',
                    opt.value === value && 'bg-blue-50 text-accent dark:bg-blue-950/30'
                  )}
                >
                  {opt.label}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
