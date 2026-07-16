import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, User, Phone, Mail, FileText, Calendar, ShieldAlert, MapPin, Plus, Trash2, Key, Sparkles } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { Avatar } from '@/components/shared/Avatar'
import { Modal } from '@/components/shared/Modal'
import { FileUpload } from '@/components/shared/FileUpload'
import { FormField } from '@/components/shared/FormField'
import { Badge } from '@/components/ui/Badge'
import {
  useStudent,
  useStudentDocuments,
  useUploadDocument,
  useDeleteDocument,
  useStudentTimeline,
  useProvisionPortalAccess,
  useUploadPhoto,
  usePredictPerformance,
} from '@/api/hooks'

type TabType = 'profile' | 'parents' | 'documents' | 'timeline' | 'academic'

export function StudentProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<TabType>('profile')
  const [isDocModalOpen, setIsDocModalOpen] = useState(false)
  const [docType, setDocType] = useState('Aadhaar')

  // API Hooks
  const { data: student, isLoading } = useStudent(id)
  const { data: documents } = useStudentDocuments(id)
  const { data: timeline } = useStudentTimeline(id)
  const uploadDocMutation = useUploadDocument(id || '')
  const deleteDocMutation = useDeleteDocument(id || '')
  const uploadPhotoMutation = useUploadPhoto(id || '')
  const provisionAccessMutation = useProvisionPortalAccess()
  const predictMutation = usePredictPerformance()

  const [isPredictModalOpen, setIsPredictModalOpen] = useState(false)
  const [predictionResult, setPredictionResult] = useState<any>(null)

  const handlePredict = async () => {
    if (!id) return
    setIsPredictModalOpen(true)
    try {
      const res = await predictMutation.mutateAsync(id)
      setPredictionResult(res)
    } catch {
      toast.error('Failed to run AI prediction analysis')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-96 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>
    )
  }

  if (!student) {
    return (
      <PageWrapper title="Profile not found">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShieldAlert className="h-12 w-12 text-slate-300 dark:text-slate-700" />
          <h3 className="mt-4 text-base font-semibold">Student profile not found</h3>
          <p className="mt-2 text-sm text-slate-500">The profile might have been deleted or the link is invalid.</p>
          <Link to="/students" className="mt-4 text-sm font-semibold text-accent hover:underline">
            Back to Student List
          </Link>
        </div>
      </PageWrapper>
    )
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    try {
      await uploadPhotoMutation.mutateAsync(e.target.files[0])
      toast.success('Profile photo uploaded')
    } catch {
      toast.error('Failed to upload photo')
    }
  }

  const handleDocumentUpload = async (files: File[]) => {
    if (files.length === 0) return
    try {
      await uploadDocMutation.mutateAsync({ type: docType, file: files[0] })
      toast.success('Document uploaded successfully')
      setIsDocModalOpen(false)
    } catch {
      toast.error('Failed to upload document')
    }
  }

  const handleDocumentDelete = async (docId: string) => {
    try {
      await deleteDocMutation.mutateAsync(docId)
      toast.success('Document deleted')
    } catch {
      toast.error('Failed to delete document')
    }
  }

  const handleProvisionAccess = async () => {
    try {
      const res = await provisionAccessMutation.mutateAsync(id || '')
      toast.success(`Portal access provisioned! User: ${res.username}, Temp Password: ${res.default_password}`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to provision access')
    }
  }

  return (
    <PageWrapper
      title={`${student.first_name} ${student.last_name}`}
      description={`Admission No: ${student.admission_number}`}
      actions={
        <div className="flex gap-2">
          <Link
            to="/students"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Registry
          </Link>
          <button
            onClick={handlePredict}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <Sparkles className="h-4 w-4 text-accent" />
            AI Predictor
          </button>
          <button
            onClick={handleProvisionAccess}
            disabled={!!student.user_id}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Key className="h-4 w-4" />
            {student.user_id ? 'Credentials Link Active' : 'Provision Access'}
          </button>
        </div>
      }
    >
      {/* Profile Header Card */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="group relative cursor-pointer">
            <Avatar
              src={student.profile_photo_url}
              firstName={student.first_name}
              lastName={student.last_name}
              size="lg"
            />
            <label className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/60 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="text-4xs font-semibold uppercase text-white">Upload</span>
              <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
            </label>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              {student.first_name} {student.last_name}
            </h3>
            <p className="mt-1 text-xs font-mono text-slate-500">Admission No: {student.admission_number}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Badge variant="success">Roll No: {student.roll_number || '—'}</Badge>
              <Badge variant="info">Gender: {student.gender}</Badge>
              <Badge variant={student.is_active ? 'success' : 'neutral'}>
                {student.is_active ? 'Active Enrolment' : 'Inactive'}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-3">
              <span className="flex items-center gap-1.5 justify-center sm:justify-start">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                {student.phone || 'No phone record'}
              </span>
              <span className="flex items-center gap-1.5 justify-center sm:justify-start">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                {student.email || 'No email record'}
              </span>
              <span className="flex items-center gap-1.5 justify-center sm:justify-start">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                DOB: {student.date_of_birth}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        {(['profile', 'academic', 'parents', 'documents', 'timeline'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-[2px] ${
              activeTab === tab
                ? 'border-accent text-accent'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="min-h-[250px] mt-6">
        {activeTab === 'profile' && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h4 className="mb-4 font-semibold text-slate-900 dark:text-white">Demographics & Identity</h4>
              <div className="space-y-3.5 text-sm">
                <div className="flex justify-between border-b border-slate-50 pb-2 dark:border-slate-800">
                  <span className="text-slate-500">Blood Group</span>
                  <span className="font-semibold">{student.blood_group || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-2 dark:border-slate-800">
                  <span className="text-slate-500">Aadhaar Number</span>
                  <span className="font-semibold">{student.aadhaar_number || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-2 dark:border-slate-800">
                  <span className="text-slate-500">Category</span>
                  <span className="font-semibold capitalize">{student.category || 'General'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-2 dark:border-slate-800">
                  <span className="text-slate-500">Religion</span>
                  <span className="font-semibold">{student.religion || '—'}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-slate-500">Nationality</span>
                  <span className="font-semibold">{student.nationality || 'Indian'}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h4 className="mb-4 font-semibold text-slate-900 dark:text-white">Address Information</h4>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 text-slate-400 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-slate-800 dark:text-slate-200">Permanent Address</p>
                    <p className="mt-1 text-slate-500">
                      {student.address_line1 || 'No address details provided'}
                      {student.address_line2 ? `, ${student.address_line2}` : ''}
                    </p>
                    {student.city && (
                      <p className="mt-0.5 text-slate-500">
                        {student.city}, {student.state} - {student.pincode}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'academic' && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h4 className="mb-4 font-semibold text-slate-900 dark:text-white">Enrolment & School History</h4>
            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between border-b border-slate-50 pb-2 dark:border-slate-800">
                <span className="text-slate-500">Admission Date</span>
                <span className="font-semibold">{student.admission_date || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-2 dark:border-slate-800">
                <span className="text-slate-500">Transfer Certificate (TC) No</span>
                <span className="font-semibold">{student.tc_number || '—'}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-slate-500">Previous School Attended</span>
                <span className="font-semibold">{student.previous_school || '—'}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'parents' && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h4 className="mb-4 font-semibold text-slate-900 dark:text-white">Parent / Guardian Contacts</h4>
            <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
              <User className="h-10 w-10 text-slate-300" />
              <p className="mt-2 text-sm">No parent records are linked to this profile.</p>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-900 dark:text-white">Uploaded Documents</h4>
              <button
                onClick={() => setIsDocModalOpen(true)}
                className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Upload Document
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {documents && documents.length > 0 ? (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{doc.document_type}</p>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-2xs text-accent hover:underline"
                        >
                          View File
                        </a>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDocumentDelete(doc.id)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-danger dark:hover:bg-slate-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-12 text-center text-sm text-slate-500">
                  No verification documents (Birth Certificate, Aadhaar, TC) uploaded.
                </div>
              )}
            </div>

            {/* Document Upload Modal */}
            {isDocModalOpen && (
              <Modal
                isOpen={true}
                onClose={() => setIsDocModalOpen(false)}
                title="Upload Verification Document"
              >
                <div className="space-y-4">
                  <FormField label="Document Type" required>
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="Aadhaar">Aadhaar Card</option>
                      <option value="Birth Certificate">Birth Certificate</option>
                      <option value="Transfer Certificate">Transfer Certificate (TC)</option>
                      <option value="Marksheet">Previous Marksheet</option>
                    </select>
                  </FormField>

                  <FileUpload
                    accept=".pdf,.png,.jpg,.jpeg"
                    maxSize={10}
                    onUpload={handleDocumentUpload}
                  />
                </div>
              </Modal>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h4 className="mb-4 font-semibold text-slate-900 dark:text-white">Profile Event Trail</h4>
            <div className="space-y-6">
              {timeline && timeline.length > 0 ? (
                <div className="relative border-l border-slate-200 pl-4 ml-2 dark:border-slate-800">
                  {timeline.map((event) => (
                    <div key={event.id} className="relative mb-6 last:mb-0">
                      <span className="absolute -left-[21px] top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-accent ring-4 ring-white dark:ring-slate-900" />
                      <div className="text-xs text-slate-500">{event.created_at}</div>
                      <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {event.action}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-slate-500">No profile change events logged.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {isPredictModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => {
            setIsPredictModalOpen(false)
            setPredictionResult(null)
          }}
          title="AI Performance Predictor"
        >
          <div className="space-y-4">
            {predictMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <Sparkles className="h-8 w-8 text-accent animate-pulse" />
                <div className="text-xs text-slate-500 animate-pulse">Running demographic & grading projections...</div>
              </div>
            ) : predictionResult ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div>
                    <div className="text-xs text-slate-500 font-semibold">RISK RATING CLASSIFICATION</div>
                    <Badge variant={predictionResult.risk_level === 'High Risk' ? 'danger' : predictionResult.risk_level === 'Moderate Risk' ? 'warning' : 'success'}>
                      {predictionResult.risk_level}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">PREDICTED GRADE SCORE</div>
                    <div className="text-xl font-bold text-accent">{predictionResult.predicted_next_exam_score}%</div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40">
                    <span className="text-slate-500 block">Class Attendance Rate</span>
                    <strong className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 block">{predictionResult.attendance_rate}%</strong>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40">
                    <span className="text-slate-500 block">Current Cumulative Avg</span>
                    <strong className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 block">{predictionResult.current_average}%</strong>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-slate-450">AI Remedial Interventions</span>
                  <ul className="mt-2.5 space-y-2 text-xs text-slate-650 dark:text-slate-400 list-disc pl-4">
                    {predictionResult.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="leading-relaxed">{rec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-danger">Failed to process projections.</div>
            )}
          </div>
        </Modal>
      )}
    </PageWrapper>
  )
}
