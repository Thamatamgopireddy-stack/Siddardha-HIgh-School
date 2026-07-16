import { useState, useMemo } from 'react'
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
          <div className="relative flex justify-end">
            <div className="group relative">
              <button className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
                <MoreVertical className="h-4 w-4 text-slate-500" />
              </button>
              <div className="absolute right-0 top-full z-10 mt-1 hidden w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-md group-hover:block dark:border-slate-800 dark:bg-slate-900">
                {rowActions(row.original)}
              </div>
            </div>
          </div>
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
                    <th key={header.id} className="px-4 py-3.5 first:pl-6 last:pr-6">
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
                      <td key={cIdx} className="px-4 py-4 first:pl-6 last:pr-6">
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
                      <td key={cell.id} className="px-4 py-3.5 first:pl-6 last:pr-6">
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
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-slate-800">
            <div className="flex items-center gap-4 text-xs text-slate-500">
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
                    {[10, 20, 50, 100].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
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
