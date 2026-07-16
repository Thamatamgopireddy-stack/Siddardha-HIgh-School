import { useState, useRef, useEffect } from 'react'
import { Download, FileSpreadsheet, FileText, Clipboard, ChevronDown } from 'lucide-react'
import { cn } from '@/utils'

interface ExportButtonProps {
  onExportExcel?: () => void
  onExportPdf?: () => void
  onCopy?: () => void
  className?: string
}

export function ExportButton({
  onExportExcel,
  onExportPdf,
  onCopy,
  className,
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    window.addEventListener('mousedown', handleOutsideClick)
    return () => window.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  return (
    <div ref={dropdownRef} className={cn('relative inline-block text-left', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-1.5 w-44 origin-top-right rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <ul className="space-y-0.5">
            {onExportExcel && (
              <li>
                <button
                  onClick={() => {
                    onExportExcel()
                    setIsOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                  Export Excel (CSV)
                </button>
              </li>
            )}
            {onExportPdf && (
              <li>
                <button
                  onClick={() => {
                    onExportPdf()
                    setIsOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <FileText className="h-4 w-4 text-red-500" />
                  Export PDF
                </button>
              </li>
            )}
            {onCopy && (
              <li>
                <button
                  onClick={() => {
                    onCopy()
                    setIsOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Clipboard className="h-4 w-4 text-blue-500" />
                  Copy to Clipboard
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
