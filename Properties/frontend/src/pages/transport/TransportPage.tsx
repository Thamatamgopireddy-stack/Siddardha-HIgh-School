import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, Navigation, Phone, Play, Square, Compass, RefreshCw } from 'lucide-react'

import { PageWrapper } from '@/components/layout/PageWrapper'
import { FormField } from '@/components/shared/FormField'
import { Modal } from '@/components/shared/Modal'
import { DataTable } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/api/client'
import {
  useTransportRoutes,
  useCreateTransportRoute,
  useVehicles,
  useCreateVehicle,
} from '@/api/hooks'

type TransportTab = 'routes' | 'vehicles'

// Leaflet Loader Hook
function useLeaflet() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if ((window as any).L) {
      setLoaded(true)
      return
    }

    // Load CSS
    if (!document.getElementById('leaflet-css')) {
      const cssLink = document.createElement('link')
      cssLink.rel = 'stylesheet'
      cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      cssLink.id = 'leaflet-css'
      document.head.appendChild(cssLink)
    }

    // Load JS
    if (!document.getElementById('leaflet-js')) {
      const jsScript = document.createElement('script')
      jsScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      jsScript.id = 'leaflet-js'
      jsScript.onload = () => {
        const L = (window as any).L
        if (L) {
          delete L.Icon.Default.prototype._getIconUrl
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          })
        }
        setLoaded(true)
      }
      document.head.appendChild(jsScript)
    } else {
      setLoaded(true)
    }
  }, [])

  return loaded
}

// Mock Delhi route coordinates for simulator
const MOCK_ROUTE_PATH = [
  { lat: 28.613939, lng: 77.209021, name: "School Main Gate (Origin)" },
  { lat: 28.614856, lng: 77.210523, name: "Sector 3 Crossing" },
  { lat: 28.616212, lng: 77.212001, name: "Main Market Stop" },
  { lat: 28.618199, lng: 77.214829, name: "Metro Station Gate 2" },
  { lat: 28.619512, lng: 77.216233, name: "Residential Complex A" },
  { lat: 28.621213, lng: 77.218900, name: "Public Park Station" },
  { lat: 28.623101, lng: 77.220551, name: "City Mall Crossing" },
  { lat: 28.625121, lng: 77.222301, name: "Terminal Station East (Destination)" }
]

export function TransportPage() {
  const [activeTab, setActiveTab] = useState<TransportTab>('routes')

  // Modals state
  const [isAddRouteOpen, setIsAddRouteOpen] = useState(false)
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false)
  const [isTrackingOpen, setIsTrackingOpen] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null)

  // GPS Map states
  const leafletLoaded = useLeaflet()
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [vehicleLocation, setVehicleLocation] = useState<any>(null)

  // Simulator states
  const [isSimulating, setIsSimulating] = useState(false)
  const [simIndex, setSimIndex] = useState(0)

  // API Hooks
  const { data: routes, isLoading: isRoutesLoading } = useTransportRoutes()
  const { data: vehicles, isLoading: isVehiclesLoading, refetch: refetchVehicles } = useVehicles()

  const createRouteMutation = useCreateTransportRoute()
  const createVehicleMutation = useCreateVehicle()

  // Form states
  const [routeForm, setRouteForm] = useState({
    name: '',
    start_point: '',
    end_point: '',
    cost: 1500,
  })

  const [vehicleForm, setVehicleForm] = useState({
    vehicle_number: '',
    driver_name: '',
    driver_phone: '',
    capacity: 40,
  })

  // Poll GPS location when tracking modal is open
  useEffect(() => {
    if (!isTrackingOpen || !selectedVehicle) return

    const fetchGPS = async () => {
      try {
        const { data } = await api.get(`/ancillary/transport/vehicles/${selectedVehicle.id}/gps`)
        if (data.success) {
          setVehicleLocation(data.data)
        }
      } catch (err) {
        console.error("Failed to fetch GPS coordinates", err)
      }
    }

    fetchGPS() // Initial fetch
    const interval = setInterval(fetchGPS, 3000)

    return () => clearInterval(interval)
  }, [isTrackingOpen, selectedVehicle])

  // Leaflet map initialization
  useEffect(() => {
    if (!leafletLoaded || !isTrackingOpen || !mapRef.current) return

    const L = (window as any).L
    if (!L) return

    // Starting coordinate (default to first mock route point or current location)
    const initialLat = vehicleLocation?.latitude || 28.613939
    const initialLng = vehicleLocation?.longitude || 77.209021

    if (!leafletMapRef.current) {
      leafletMapRef.current = L.map(mapRef.current).setView([initialLat, initialLng], 14)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(leafletMapRef.current)
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
        markerRef.current = null
      }
    }
  }, [leafletLoaded, isTrackingOpen])

  // Update map marker when location changes
  useEffect(() => {
    if (!leafletMapRef.current || !vehicleLocation?.latitude || !vehicleLocation?.longitude) return

    const L = (window as any).L
    if (!L) return

    const pos: [number, number] = [vehicleLocation.latitude, vehicleLocation.longitude]

    if (!markerRef.current) {
      markerRef.current = L.marker(pos).addTo(leafletMapRef.current)
      markerRef.current.bindPopup(`<b>${selectedVehicle?.vehicle_number}</b><br>Driver: ${selectedVehicle?.driver_name}`).openPopup()
    } else {
      markerRef.current.setLatLng(pos)
    }

    leafletMapRef.current.setView(pos, leafletMapRef.current.getZoom())
  }, [vehicleLocation])

  // Simulator Tick Effect
  useEffect(() => {
    if (!isSimulating || !selectedVehicle) return

    const tick = async () => {
      const nextIndex = (simIndex + 1) % MOCK_ROUTE_PATH.length
      setSimIndex(nextIndex)
      const coord = MOCK_ROUTE_PATH[nextIndex]

      try {
        await api.post(`/ancillary/transport/vehicles/${selectedVehicle.id}/gps`, {
          latitude: coord.lat,
          longitude: coord.lng,
          is_tracking: true
        })
        refetchVehicles()
      } catch (err) {
        console.error("GPS simulation transmission failed", err)
      }
    }

    const interval = setInterval(tick, 3000)
    return () => clearInterval(interval)
  }, [isSimulating, simIndex, selectedVehicle])

  const handleStartSimulation = async () => {
    if (!selectedVehicle) return
    setIsSimulating(true)
    setSimIndex(0)
    const startCoord = MOCK_ROUTE_PATH[0]
    try {
      await api.post(`/ancillary/transport/vehicles/${selectedVehicle.id}/gps`, {
        latitude: startCoord.lat,
        longitude: startCoord.lng,
        is_tracking: true
      })
      refetchVehicles()
      toast.success("GPS Driver Simulation Started!")
    } catch {
      toast.error("Failed to start simulator")
    }
  }

  const handleStopSimulation = async () => {
    if (!selectedVehicle) return
    setIsSimulating(false)
    try {
      await api.post(`/ancillary/transport/vehicles/${selectedVehicle.id}/gps`, {
        latitude: 0,
        longitude: 0,
        is_tracking: false
      })
      refetchVehicles()
      setVehicleLocation(null)
      toast.info("GPS Driver Simulation Stopped.")
    } catch {
      toast.error("Failed to stop simulator")
    }
  }

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createRouteMutation.mutateAsync(routeForm)
      toast.success('Transport route configured successfully!')
      setIsAddRouteOpen(false)
      setRouteForm({ name: '', start_point: '', end_point: '', cost: 1500 })
    } catch {
      toast.error('Failed to create route')
    }
  }

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createVehicleMutation.mutateAsync(vehicleForm)
      toast.success('Vehicle added to school fleet!')
      setIsAddVehicleOpen(false)
      setVehicleForm({ vehicle_number: '', driver_name: '', driver_phone: '', capacity: 40 })
    } catch {
      toast.error('Failed to add vehicle')
    }
  }

  return (
    <PageWrapper
      title="Transport Management"
      description="Track school transit routes, bus details, and driver details."
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => setIsAddRouteOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            Create Route
          </button>
          <button
            onClick={() => setIsAddVehicleOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Vehicle
          </button>
        </div>
      }
    >
      {/* Tabs Selector */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab('routes')}
          className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-[2px] ${
            activeTab === 'routes'
              ? 'border-accent text-accent'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Transit Routes
        </button>
        <button
          onClick={() => setActiveTab('vehicles')}
          className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-[2px] ${
            activeTab === 'vehicles'
              ? 'border-accent text-accent'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Fleet Vehicles
        </button>
      </div>

      {activeTab === 'routes' && (
        <DataTable
          columns={[
            { accessorKey: 'name', header: 'Route Name', cell: ({ row }) => <span className="font-semibold text-slate-900 dark:text-white">{row.original.name}</span> },
            { accessorKey: 'start_point', header: 'Start Station' },
            { accessorKey: 'end_point', header: 'Terminal Station' },
            { accessorKey: 'cost', header: 'Monthly Fare', cell: ({ row }) => <span>₹{row.original.cost} / mo</span> },
          ]}
          data={routes || []}
          isLoading={isRoutesLoading}
        />
      )}

      {activeTab === 'vehicles' && (
        <DataTable
          columns={[
            { accessorKey: 'vehicle_number', header: 'Registration No', cell: ({ row }) => <span className="font-mono text-xs font-semibold uppercase">{row.original.vehicle_number}</span> },
            { accessorKey: 'driver_name', header: 'Driver Name' },
            {
              accessorKey: 'driver_phone',
              header: 'Driver Contact',
              cell: ({ row }) => (
                <span className="flex items-center gap-1 text-xs">
                  <Phone className="h-3 w-3 text-slate-400" />
                  {row.original.driver_phone}
                </span>
              ),
            },
            { accessorKey: 'capacity', header: 'Capacity (Seats)' },
            {
              id: 'gps',
              header: 'GPS Status',
              cell: ({ row }) => (
                <Badge variant={row.original.is_tracking ? 'success' : 'neutral'}>
                  {row.original.is_tracking ? 'Active' : 'Offline'}
                </Badge>
              ),
            },
            {
              id: 'actions',
              header: 'Action',
              cell: ({ row }) => (
                <button
                  onClick={() => {
                    setSelectedVehicle(row.original)
                    setIsTrackingOpen(true)
                  }}
                  className="flex items-center gap-1 rounded bg-accent/10 px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Track Live
                </button>
              ),
            },
          ]}
          data={vehicles || []}
          isLoading={isVehiclesLoading}
        />
      )}

      {/* Add Route Modal */}
      {isAddRouteOpen && (
        <Modal isOpen={true} onClose={() => setIsAddRouteOpen(false)} title="Configure Transit Route">
          <form onSubmit={handleCreateRoute} className="space-y-4">
            <FormField label="Route Identifier Name" required>
              <input
                type="text"
                value={routeForm.name}
                onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
                placeholder="e.g. South Delhi Route 3"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Start Station / Origin" required>
                <input
                  type="text"
                  value={routeForm.start_point}
                  onChange={(e) => setRouteForm({ ...routeForm, start_point: e.target.value })}
                  placeholder="e.g. Dwarka Sector 10"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
              <FormField label="Terminal Station / Destination" required>
                <input
                  type="text"
                  value={routeForm.end_point}
                  onChange={(e) => setRouteForm({ ...routeForm, end_point: e.target.value })}
                  placeholder="e.g. School Campus East Gate"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
            </div>

            <FormField label="Monthly Transit Fare Fee (INR)" required>
              <input
                type="number"
                min={0}
                value={routeForm.cost}
                onChange={(e) => setRouteForm({ ...routeForm, cost: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </FormField>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddRouteOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createRouteMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create Route
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Vehicle Modal */}
      {isAddVehicleOpen && (
        <Modal isOpen={true} onClose={() => setIsAddVehicleOpen(false)} title="Register Fleet Bus Vehicle">
          <form onSubmit={handleCreateVehicle} className="space-y-4">
            <FormField label="Vehicle Plate Number" required>
              <input
                type="text"
                value={vehicleForm.vehicle_number}
                onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_number: e.target.value })}
                placeholder="e.g. DL-1CA-1234"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </FormField>

            <FormField label="Driver Name" required>
              <input
                type="text"
                value={vehicleForm.driver_name}
                onChange={(e) => setVehicleForm({ ...vehicleForm, driver_name: e.target.value })}
                placeholder="e.g. Rajesh Kumar"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                required
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Driver Mobile Number" required>
                <input
                  type="text"
                  value={vehicleForm.driver_phone}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, driver_phone: e.target.value })}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
              <FormField label="Seating Capacity" required>
                <input
                  type="number"
                  min={1}
                  value={vehicleForm.capacity}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  required
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddVehicleOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createVehicleMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Add Vehicle
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Live Tracking Modal */}
      {isTrackingOpen && selectedVehicle && (
        <Modal isOpen={true} onClose={() => { setIsTrackingOpen(false); handleStopSimulation(); }} title={`Live GPS Tracking: ${selectedVehicle.vehicle_number}`}>
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-150 dark:border-slate-800 text-sm">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedVehicle.driver_name}</p>
                <p className="text-xs text-slate-500">{selectedVehicle.driver_phone}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Status</p>
                <Badge variant={vehicleLocation?.is_tracking ? 'success' : 'neutral'}>
                  {vehicleLocation?.is_tracking ? 'Online (Transmitting)' : 'Offline'}
                </Badge>
              </div>
            </div>

            {/* Map Container */}
            <div className="relative">
              <div ref={mapRef} className="w-full h-[350px] rounded-lg border border-slate-200 dark:border-slate-700 shadow-inner overflow-hidden bg-slate-100" />
              {!leafletLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 rounded-lg">
                  <span className="text-sm font-semibold flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <RefreshCw className="h-4 w-4 animate-spin text-accent" />
                    Loading Live Maps...
                  </span>
                </div>
              )}
              {leafletLoaded && !vehicleLocation?.is_tracking && (
                <div className="absolute top-3 left-3 right-3 bg-blue-50 border border-blue-200 text-blue-800 rounded p-2.5 text-xs shadow">
                  🚌 **Bus is currently offline.** Start the simulator panel below to broadcast mock location updates and watch it update live on the map.
                </div>
              )}
            </div>

            {/* Simulator Control Panel */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Bus Driver GPS Simulator</h4>
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-50 dark:bg-slate-800/30 p-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <Compass className={`h-4 w-4 text-accent ${isSimulating ? 'animate-spin' : ''}`} />
                  {isSimulating ? (
                    <span>Simulating route: <b>{MOCK_ROUTE_PATH[simIndex].name}</b></span>
                  ) : (
                    <span>Ready to simulate driver location updates.</span>
                  )}
                </div>

                <div className="flex gap-2 shrink-0">
                  {!isSimulating ? (
                    <button
                      onClick={handleStartSimulation}
                      className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                    >
                      <Play className="h-3 w-3 fill-white" />
                      Start Simulator
                    </button>
                  ) : (
                    <button
                      onClick={handleStopSimulation}
                      className="flex items-center gap-1.5 rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition"
                    >
                      <Square className="h-3 w-3 fill-white" />
                      Stop Simulator
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </PageWrapper>
  )
}
