import { useCallback, useState } from 'react'
import { UploadCloud, FileText, X } from 'lucide-react'

interface FileUploadProps {
  accept?: string
  maxSize?: number // in MB
  multiple?: boolean
  onUpload: (files: File[]) => void
}

export function FileUpload({
  accept = '*/*',
  maxSize = 10,
  multiple = false,
  onUpload,
}: FileUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const validateAndAddFiles = useCallback((filesList: FileList) => {
    const validFiles: File[] = []
    const limitBytes = maxSize * 1024 * 1024

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i]
      if (file.size > limitBytes) {
        alert(`File ${file.name} exceeds the maximum size limit of ${maxSize}MB.`)
        continue
      }
      validFiles.push(file)
    }

    if (validFiles.length > 0) {
      const updated = multiple ? [...selectedFiles, ...validFiles] : [validFiles[0]]
      setSelectedFiles(updated)
      onUpload(updated)
    }
  }, [maxSize, multiple, selectedFiles, onUpload])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true)
    } else if (e.type === 'dragleave') {
      setIsDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files)
    }
  }

  const removeFile = (idx: number) => {
    const updated = selectedFiles.filter((_, i) => i !== idx)
    setSelectedFiles(updated)
    onUpload(updated)
  }

  return (
    <div className="space-y-4">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={
          isDragActive
            ? 'flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-accent bg-blue-50/50 p-6 transition dark:border-accent dark:bg-blue-950/20'
            : 'flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600'
        }
      >
        <UploadCloud className="h-10 w-10 text-slate-400" />
        <label className="mt-4 cursor-pointer text-sm font-medium text-accent hover:underline">
          Upload a file
          <input
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleInputChange}
            className="hidden"
          />
        </label>
        <p className="mt-1 text-xs text-slate-500">or drag and drop here</p>
        <p className="mt-1 text-2xs text-slate-400">Max size: {maxSize}MB</p>
      </div>

      {selectedFiles.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {selectedFiles.map((file, idx) => (
            <li key={idx} className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText className="h-5 w-5 shrink-0 text-slate-400" />
                <span className="truncate text-sm text-slate-700 dark:text-slate-300">{file.name}</span>
                <span className="text-2xs text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
