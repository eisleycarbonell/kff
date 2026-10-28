"use client"
import {
    Empty,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    EmptyDescription,
    EmptyContent,
} from "@/components/ui/empty"

import { useMemo } from "react"
import { useTable } from "@tanstack/react-table"
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    MapPin,
} from "lucide-react"

import type { Location } from "@/components/modules/locations/location.schema"
import {
    createLocationColumns,
    locationTableFeatures,
} from "@/components/modules/locations/location-table-columns"
import { LocationTableToolbar } from "@/components/modules/locations/location-table-toolbar"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

const pageSizeItems = [5, 10, 20, 50].map((size) => ({ value: String(size), label: String(size) }))

type LocationTableProps = {
    locations: Location[]
    canManage: boolean
    onAdd: () => void
    onEdit: (location: Location) => void
    onDeactivate: (locations: Location[]) => void
}

export function LocationTable({
    locations,
    canManage,
    onAdd,
    onEdit,
    onDeactivate,
}: LocationTableProps) {
    const columns = useMemo(
        () => createLocationColumns({ onEdit, onDeactivate, canManage }),
        [onEdit, onDeactivate, canManage],
    )
    const table = useTable({
        features: locationTableFeatures,
        data: locations,
        columns,
        getRowId: (location) => String(location.locationId),
        globalFilterFn: "includesString",
        initialState: {
            pagination: { pageIndex: 0, pageSize: 10 },
            columnVisibility: { createdAt: false, code: false },
            sorting: [{ id: "name", desc: false }],
        },
    })
    const filteredRows = table.getFilteredRowModel().rows
    const hasFilters = Boolean(table.state.globalFilter) || table.state.columnFilters.length > 0
    const { pageIndex, pageSize } = table.state.pagination
    const pageCount = Math.max(table.getPageCount(), 1)

    function clearFilters() {
        table.setGlobalFilter("")
        table.resetColumnFilters()
        table.resetRowSelection()
        table.setPageIndex(0)
    }

    return (
        <div className="min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs">
            <LocationTableToolbar
                table={table}
                canManage={canManage}
                hasFilters={hasFilters}
                onClearFilters={clearFilters}
                onDeactivate={onDeactivate}
            />
            <Table>
                <TableHeader className="bg-muted/50">
                    {table.getHeaderGroups().map((group) => (
                        <TableRow key={group.id}>
                            {group.headers.map((header) => (
                                <TableHead
                                    key={header.id}
                                    className={
                                        header.column.id === "select"
                                            ? "h-12 w-14 pl-5"
                                            : header.column.id === "actions"
                                              ? "h-12 w-14 pr-5"
                                              : "h-12 px-3"
                                    }
                                    aria-sort={
                                        header.column.getCanSort()
                                            ? header.column.getIsSorted() === "asc"
                                                ? "ascending"
                                                : header.column.getIsSorted() === "desc"
                                                  ? "descending"
                                                  : "none"
                                            : undefined
                                    }
                                >
                                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="-ml-2"
                                            onClick={header.column.getToggleSortingHandler()}
                                        >
                                            <table.FlexRender header={header} />
                                            {header.column.getIsSorted() === "asc" ? (
                                                <ArrowUp className="size-3.5" />
                                            ) : header.column.getIsSorted() === "desc" ? (
                                                <ArrowDown className="size-3.5" />
                                            ) : (
                                                <ArrowUpDown className="size-3.5 text-muted-foreground" />
                                            )}
                                        </Button>
                                    ) : (
                                        <table.FlexRender header={header} />
                                    )}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows.length ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow
                                key={row.id}
                                className="hover:bg-primary/5 data-[state=selected]:bg-primary/10"
                                data-state={row.getIsSelected() ? "selected" : undefined}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell
                                        key={cell.id}
                                        className={
                                            cell.column.id === "select"
                                                ? "pl-5"
                                                : cell.column.id === "actions"
                                                  ? "pr-5 text-right"
                                                  : "px-3 py-4"
                                        }
                                    >
                                        <table.FlexRender cell={cell} />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell
                                colSpan={table.getVisibleLeafColumns().length}
                                className="h-64 text-center"
                            >
                                <Empty>
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <MapPin />
                                        </EmptyMedia>
                                        <EmptyTitle>
                                            {hasFilters
                                                ? "No locations match your filters"
                                                : "No locations yet"}
                                        </EmptyTitle>
                                        <EmptyDescription>
                                            {hasFilters
                                                ? "Try a different search or clear your filters."
                                                : "Add your first location to get started."}
                                        </EmptyDescription>
                                    </EmptyHeader>
                                    <EmptyContent>
                                        <Button
                                            variant="outline"
                                            disabled={!hasFilters && !canManage}
                                            onClick={hasFilters ? clearFilters : onAdd}
                                        >
                                            {hasFilters ? "Clear filters" : "Add location"}
                                        </Button>
                                    </EmptyContent>
                                </Empty>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            <div className="flex flex-col gap-4 border-t bg-muted/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                    {filteredRows.length
                        ? `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, filteredRows.length)}`
                        : "0"}{" "}
                    of {filteredRows.length} locations
                </p>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Rows per page</span>
                        <Select
                            items={pageSizeItems}
                            value={String(pageSize)}
                            onValueChange={(value) => {
                                if (value) table.setPageSize(Number(value))
                            }}
                        >
                            <SelectTrigger aria-label="Rows per page" className="w-16">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {pageSizeItems.map((location) => (
                                        <SelectItem key={location.value} value={location.value}>
                                            {location.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                    <span className="text-sm tabular-nums">
                        Page {pageIndex + 1} of {pageCount}
                    </span>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="icon-sm"
                            aria-label="First page"
                            disabled={!table.getCanPreviousPage()}
                            onClick={() => table.firstPage()}
                        >
                            <ChevronsLeft />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon-sm"
                            aria-label="Previous page"
                            disabled={!table.getCanPreviousPage()}
                            onClick={() => table.previousPage()}
                        >
                            <ChevronLeft />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon-sm"
                            aria-label="Next page"
                            disabled={!table.getCanNextPage()}
                            onClick={() => table.nextPage()}
                        >
                            <ChevronRight />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon-sm"
                            aria-label="Last page"
                            disabled={!table.getCanNextPage()}
                            onClick={() => table.lastPage()}
                        >
                            <ChevronsRight />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
