import { useState, useMemo, useRef, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table'
import { ArrowUpDown, ChevronLeft, ChevronRight, Search, MoreVertical } from 'lucide-react'
import { cn } from '@/utils'

interface PaginationMeta {
  page: number
  limit: number
  total: number
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[]
  data: TData[]
  isLoading?: boolean
  pagination?: PaginationMeta
  onPageChange?: (page: number) => void
  onLimitChange?: (limit: number) => void
  onSearch?: (term: string) => void
  onSort?: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  selectable?: boolean
  onSelectionChange?: (selectedRows: TData[]) => void
  rowActions?: (row: TData) => React.ReactNode
}

function RowActionMenu({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const right = Math.max(8, window.innerWidth - rect.right)

      if (spaceBelow < 220 && rect.top > 200) {
        setCoords({ bottom: window.innerHeight - rect.top + 6, right })
      } else {
        setCoords({ top: rect.bottom + 6, right })
      }
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return

    function handleScrollOrResize() {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        const right = Math.max(8, window.innerWidth - rect.right)

        if (spaceBelow < 220 && rect.top > 200) {
          setCoords({ bottom: window.innerHeight - rect.top + 6, right })
        } else {
          setCoords({ top: rect.bottom + 6, right })
        }
      }
    }

    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="relative flex justify-end">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        title="Actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {isOpen && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: coords.top !== undefined ? `${coords.top}px` : 'auto',
            bottom: coords.bottom !== undefined ? `${coords.bottom}px` : 'auto',
            right: `${coords.right}px`,
          }}
          className="z-[9999] min-w-[12rem] rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in-50 zoom-in-95"
          onClick={(e) => {
            // Allow child button/link action to trigger first before closing
            const target = e.target as HTMLElement
            if (target.closest('a') || target.closest('button')) {
              setTimeout(() => setIsOpen(false), 80)
            }
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  pagination,
  onPageChange,
  onLimitChange,
  onSearch,
  onSort,
  selectable = false,
  onSelectionChange,
  rowActions,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState({})

  const tableColumns = useMemo(() => {
    const cols = [...columns]

    if (selectable) {
      cols.unshift({
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            ref={(input) => {
              if (input) {
                input.indeterminate = table.getIsSomePageRowsSelected()
              }
            }}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent dark:border-slate-700 dark:bg-slate-800"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent dark:border-slate-700 dark:bg-slate-800"
          />
        ),
      })
    }

    if (rowActions) {
      cols.push({
        id: 'actions',
        cell: ({ row }) => (
          <RowActionMenu>
            {rowActions(row.original)}
          </RowActionMenu>
        ),
      })
    }

    return cols
  }, [columns, selectable, rowActions])

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      rowSelection,
    },
    onSortingChange: (updater) => {
      const nextSorting = typeof updater === 'function' ? updater(sorting) : updater
      setSorting(nextSorting)
      if (onSort && nextSorting.length > 0) {
        onSort(nextSorting[0].id, nextSorting[0].desc ? 'desc' : 'asc')
      }
    },
    onRowSelectionChange: (updater) => {
      const nextSelection = typeof updater === 'function' ? updater(rowSelection) : updater
      setRowSelection(nextSelection)
      if (onSelectionChange) {
        const selected = Object.keys(nextSelection).map((idx) => data[parseInt(idx)])
        onSelectionChange(selected)
      }
    },
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-4">
      {onSearch && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search records..."
            onChange={(e) => onSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-4 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-800/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-3.5 sm:px-4 py-3.5 first:pl-4 sm:first:pl-6 last:pr-4 sm:last:pr-6 whitespace-nowrap">
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            'flex items-center gap-1.5',
                            header.column.getCanSort() && 'cursor-pointer select-none'
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, rIdx) => (
                  <tr key={rIdx} className="border-t border-slate-100 dark:border-slate-800">
                    {tableColumns.map((_, cIdx) => (
                      <td key={cIdx} className="px-3.5 sm:px-4 py-4 first:pl-4 sm:first:pl-6 last:pr-4 sm:last:pr-6">
                        <div className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={tableColumns.length} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-4xl text-slate-300 dark:text-slate-700">📂</div>
                      <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">No records found</h3>
                      <p className="mt-1 text-xs text-slate-500">There are no records to display in this list.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-slate-100 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/30"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3.5 sm:px-4 py-3.5 first:pl-4 sm:first:pl-6 last:pr-4 sm:last:pr-6 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && onPageChange && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 px-4 py-3.5 sm:px-6 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3 text-xs text-slate-500">
              <span>
                Showing{' '}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}
                </span>{' '}
                to{' '}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>{' '}
                of{' '}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {pagination.total}
                </span>{' '}
                results
              </span>
              {onLimitChange && (
                <div className="flex items-center gap-1">
                  <span>Show</span>
                  <select
                    value={pagination.limit}
                    onChange={(e) => onLimitChange(parseInt(e.target.value))}
                    className="rounded border border-slate-300 bg-white px-2 py-0.5 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                  >
                    {[10, 20, 50, 100, 250, 500].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page * pagination.limit >= pagination.total}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
