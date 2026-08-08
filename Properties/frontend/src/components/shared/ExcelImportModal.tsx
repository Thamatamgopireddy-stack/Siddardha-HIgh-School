import { useState } from 'react'
import { FileDown, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/shared/Modal'
import { FileUpload } from '@/components/shared/FileUpload'
import { api } from '@/api/client'


interface ExcelImportModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description: string
  templateUrl: string
  templateFileName: string
  onImport: (file: File) => Promise<{ imported: number; errors: string[] }>
  extraFields?: React.ReactNode
}

export function ExcelImportModal({
  isOpen,
  onClose,
  title,
  description,
  templateUrl,
  templateFileName,
  onImport,
  extraFields,
}: ExcelImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null)

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get(templateUrl, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', templateFileName)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Sample template downloaded')
    } catch {
      toast.error('Failed to download sample template')
    }
  }

  const handleFileSelect = (files: File[]) => {
    if (files.length > 0) {
      setSelectedFile(files[0])
      setResult(null)
    }
  }

  const handleUploadSubmit = async () => {
    if (!selectedFile) {
      toast.error('Please select an Excel or CSV file to upload')
      return
    }

    setIsUploading(true)
    setResult(null)
    try {
      const res = await onImport(selectedFile)
      setResult(res)
      if (res.imported > 0) {
        toast.success(`Successfully imported ${res.imported} record(s)!`)
      }
      if (res.errors && res.errors.length > 0) {
        toast.warning(`Import completed with ${res.errors.length} issue(s).`)
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to process Excel import')
    } finally {
      setIsUploading(false)
    }
  }

  const handleModalClose = () => {
    setSelectedFile(null)
    setResult(null)
    setIsUploading(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose} title={title}>
      <div className="space-y-5">
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>

        {/* Template Banner */}
        <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h5 className="text-xs font-semibold text-slate-900 dark:text-white">Excel Sample Template</h5>
              <p className="text-2xs text-slate-500 dark:text-slate-400">Download formatted .xlsx template sheet with sample headers</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 shadow-2xs hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
          >
            <FileDown className="h-3.5 w-3.5" /> Template
          </button>
        </div>

        {/* Format Guidance Box */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
          <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Supported Excel Sheet Formats (Up to 500+ Students)</span>
          </div>
          <ul className="list-disc space-y-1 pl-4 text-2xs">
            <li><strong>Siddardha High School Excel Format:</strong> Supports columns: <code>SECTION</code>, <code>NAME OF THE STUDENT</code>, <code>SURNAME</code>, <code>PEN NO</code>, <code>AADHAAR NO</code>, <code>FATHER NAME</code>, <code>MOTHER NAME</code>, <code>R.NO</code>, <code>ADMIN NO</code>, <code>CASTE</code>, <code>SUB CASTE</code>, <code>DOB</code>, <code>VILLAGE</code>, <code>MOBILE</code>, <code>EXTRA CELL NO</code>, <code>HOSTEL</code>, <code>H.NO</code>.</li>
            <li><strong>Auto-Detection (Multi-Sheet):</strong> Name Excel tabs by class & section (e.g., <code>6A</code>, <code>6B</code>, <code>6G</code>, <code>7A</code>, <code>7B</code>, <code>7G</code>, <code>8A</code>, <code>8B</code>, <code>8G</code>, <code>9A</code>, <code>9B</code>, <code>9G</code>, <code>10A</code>, <code>10B</code>, <code>10G</code>).</li>
            <li><strong>Bulk Capacity:</strong> Processes high-volume rosters exceeding <strong>500+ student members</strong> in a single import session.</li>
            <li><strong>Section G (Girls):</strong> <code>Section G</code> is reserved exclusively for female students.</li>
          </ul>
        </div>

        {extraFields && <div className="space-y-3">{extraFields}</div>}

        {/* Upload Dropzone */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
            Upload Excel Sheet (.xlsx, .xls, .csv)
          </label>
          <FileUpload
            accept=".xlsx,.xls,.csv"
            maxSize={15}
            onUpload={handleFileSelect}
          />
        </div>

        {/* Results Banner & Errors */}
        {result && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>{result.imported} Record(s) Imported Successfully</span>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-2xs font-semibold text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Validation Warning ({result.errors.length} rows skipped):</span>
                </div>
                <div className="max-h-32 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 text-2xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                  <ul className="list-disc space-y-1 pl-4">
                    {result.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleModalClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              disabled={!selectedFile || isUploading}
              onClick={handleUploadSubmit}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                </>
              ) : (
                'Process Excel Import'
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
