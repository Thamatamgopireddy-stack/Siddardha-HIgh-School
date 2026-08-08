import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Hotel, BedDouble, HelpCircle, Upload } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { FormField } from '@/components/shared/FormField'
import { Modal } from '@/components/shared/Modal'
import { ExcelImportModal } from '@/components/shared/ExcelImportModal'
import { DataTable } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/Badge'
import {
  useHostels,
  useCreateHostel,
  useHostelRooms,
  useCreateHostelRoom,
  useBulkImportHostelRoomsExcel,
} from '@/api/hooks'

type HostelTab = 'hostels' | 'rooms'

export function HostelPage() {
  const [activeTab, setActiveTab] = useState<HostelTab>('hostels')
  const [selectedHostelId, setSelectedHostelId] = useState<string>('')

  // Modals state
  const [isAddHostelOpen, setIsAddHostelOpen] = useState(false)
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false)
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false)

  // API Hooks
  const { data: hostels, isLoading: isHostelsLoading } = useHostels()
  const { data: rooms, isLoading: isRoomsLoading } = useHostelRooms(selectedHostelId || undefined)

  const createHostelMutation = useCreateHostel()
  const createRoomMutation = useCreateHostelRoom()
  const bulkImportHostelRoomsMutation = useBulkImportHostelRoomsExcel()


  // Form states
  const [hostelForm, setHostelForm] = useState({
    name: '',
    hostel_type: 'boys',
    capacity: 100,
  })

  const [roomForm, setRoomForm] = useState({
    hostel_id: '',
    room_number: '',
    bed_count: 4,
    cost_per_month: 2500,
  })

  const handleCreateHostel = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createHostelMutation.mutateAsync(hostelForm)
      toast.success('Hostel wing created successfully!')
      setIsAddHostelOpen(false)
      setHostelForm({ name: '', hostel_type: 'boys', capacity: 100 })
    } catch {
      toast.error('Failed to create hostel')
    }
  }

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetHostelId = roomForm.hostel_id || selectedHostelId
    if (!targetHostelId) {
      toast.error('Please select a hostel wing.')
      return
    }

    try {
      await createRoomMutation.mutateAsync({
        ...roomForm,
        hostel_id: targetHostelId,
      })
      toast.success('Hostel room configured successfully!')
      setIsAddRoomOpen(false)
      setRoomForm({ hostel_id: '', room_number: '', bed_count: 4, cost_per_month: 2500 })
    } catch {
      toast.error('Failed to configure hostel room')
    }
  }

  return (
    <PageWrapper
      title="Hostel Management"
      description="Manage campus residential hostels wings and room occupancies."
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Upload className="h-4 w-4" /> Import Rooms Excel
          </button>
          <button
            onClick={() => setIsAddHostelOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            Create Wing
          </button>
          <button
            onClick={() => setIsAddRoomOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Configure Room
          </button>
        </div>
      }
    >
      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        title="Hostel Rooms Excel Import"
        description="Upload an Excel sheet (.xlsx, .xls) or CSV file with hostel names, room numbers, capacities, and term fees."
        templateUrl="/ancillary/hostel/rooms/bulk-template"
        templateFileName="hostel_rooms_import_template.xlsx"
        onImport={async (file) => await bulkImportHostelRoomsMutation.mutateAsync(file)}
      />

      {/* Tabs Selector */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab('hostels')}
          className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-[2px] ${
            activeTab === 'hostels'
              ? 'border-accent text-accent'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Hostel Wings
        </button>
        <button
          onClick={() => setActiveTab('rooms')}
          className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-[2px] ${
            activeTab === 'rooms'
              ? 'border-accent text-accent'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Rooms & Beds Ledger
        </button>
      </div>

      {activeTab === 'hostels' && (
        <DataTable
          columns={[
            { accessorKey: 'name', header: 'Hostel Name', cell: ({ row }) => <span className="font-semibold text-slate-900 dark:text-white">{row.original.name}</span> },
            { accessorKey: 'hostel_type', header: 'Category', cell: ({ row }) => <span className="capitalize">{row.original.hostel_type} hostel</span> },
            { accessorKey: 'capacity', header: 'Total Capacity (Beds)' },
          ]}
          data={hostels || []}
          isLoading={isHostelsLoading}
          rowActions={(row) => (
            <button
              onClick={() => {
                setSelectedHostelId(row.id)
                setActiveTab('rooms')
              }}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <BedDouble className="h-4 w-4 text-slate-500" />
              View Rooms
            </button>
          )}
        />
      )}

      {activeTab === 'rooms' && (
        <div className="space-y-4">
          <div className="flex max-w-xs items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
            <span className="text-xs text-slate-500">Filter Hostel:</span>
            <select
              value={selectedHostelId}
              onChange={(e) => setSelectedHostelId(e.target.value)}
              className="rounded bg-transparent text-xs font-semibold text-slate-700 outline-none dark:text-slate-300"
            >
              <option value="">All Wings...</option>
              {hostels?.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <DataTable
            columns={[
              { accessorKey: 'room_number', header: 'Room No', cell: ({ row }) => <span className="font-semibold text-slate-900 dark:text-white">{row.original.room_number}</span> },
              { accessorKey: 'bed_count', header: 'Total Beds' },
              {
                accessorKey: 'available_beds',
                header: 'Vacancies',
                cell: ({ row }) => (
                  <Badge variant={row.original.available_beds > 0 ? 'success' : 'neutral'}>
                    {row.original.available_beds} Vacant
                  </Badge>
                ),
              },
              { accessorKey: 'cost_per_month', header: 'Monthly Rental', cell: ({ row }) => <span>₹{row.original.cost_per_month} / mo</span> },
            ]}
            data={rooms || []}
            isLoading={isRoomsLoading}
          />
        </div>
      )}

      {/* Add Hostel Modal */}
      {isAddHostelOpen && (
        <Modal isOpen={true} onClose={() => setIsAddHostelOpen(false)} title="Create Hostel Wing">
          <form onSubmit={handleCreateHostel} className="space-y-4">
            <FormField label="Hostel Wing Name" required>
              <input
                type="text"
                value={hostelForm.name}
                onChange={(e) => setHostelForm({ ...hostelForm, name: e.target.value })}
                placeholder="e.g. Block A Junior Girls Wing"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Hostel Type" required>
                <select
                  value={hostelForm.hostel_type}
                  onChange={(e) => setHostelForm({ ...hostelForm, hostel_type: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                >
                  <option value="boys">Boys Hostel</option>
                  <option value="girls">Girls Hostel</option>
                  <option value="coed">Co-Ed Hostel</option>
                </select>
              </FormField>
              <FormField label="Designed Capacity (Beds)" required>
                <input
                  type="number"
                  min={1}
                  value={hostelForm.capacity}
                  onChange={(e) => setHostelForm({ ...hostelForm, capacity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddHostelOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createHostelMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create Wing
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Room Modal */}
      {isAddRoomOpen && (
        <Modal isOpen={true} onClose={() => setIsAddRoomOpen(false)} title="Configure Hostel Room">
          <form onSubmit={handleCreateRoom} className="space-y-4">
            <FormField label="Select Hostel Wing" required>
              <select
                value={roomForm.hostel_id}
                onChange={(e) => setRoomForm({ ...roomForm, hostel_id: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              >
                <option value="">Select Hostel...</option>
                {hostels?.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Room Number" required>
              <input
                type="text"
                value={roomForm.room_number}
                onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })}
                placeholder="e.g. 101-B"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Beds Count" required>
                <input
                  type="number"
                  min={1}
                  value={roomForm.bed_count}
                  onChange={(e) => setRoomForm({ ...roomForm, bed_count: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
              <FormField label="Monthly Cost (INR)" required>
                <input
                  type="number"
                  min={0}
                  value={roomForm.cost_per_month}
                  onChange={(e) => setRoomForm({ ...roomForm, cost_per_month: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddRoomOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createRoomMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Configure Room
              </button>
            </div>
          </form>
        </Modal>
      )}
    </PageWrapper>
  )
}
