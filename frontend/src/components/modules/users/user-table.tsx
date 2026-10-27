"use client"

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
    UsersRound,
} from "lucide-react"

import type { User } from "@/components/modules/users/user.schema"
import { createUserColumns, userTableFeatures } from "@/components/modules/users/user-table-columns"
import { UserTableToolbar } from "@/components/modules/users/user-table-toolbar"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
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

type UserTableProps = {
    users: User[]
    onAdd: () => void
    onEdit: (user: User) => void
    onDelete: (users: User[]) => void
}

export function UserTable({ users, onAdd, onEdit, onDelete }: UserTableProps) {
    const columns = useMemo(() => createUserColumns({ onEdit, onDelete }), [onEdit, onDelete])
    const table = useTable({
        features: userTableFeatures,
        data: users,
        columns,
        getRowId: (user) => String(user.userId),
        globalFilterFn: "includesString",
        initialState: {
            pagination: { pageIndex: 0, pageSize: 10 },
            columnVisibility: { createdAt: false },
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
            <UserTableToolbar
                table={table}
                hasFilters={hasFilters}
                onClearFilters={clearFilters}
                onDelete={onDelete}
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
                                                : header.column.getIsSorted() ===
                                                    "desc"
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
                                            {header.column.getIsSorted() ===
                                            "asc" ? (
                                                <ArrowUp className="size-3.5" />
                                            ) : header.column.getIsSorted() ===
                                              "desc" ? (
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
                                data-state={
                                    row.getIsSelected() ? "selected" : undefined
                                }
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
                                <UsersRound className="mx-auto mb-3 size-8 text-muted-foreground" />
                                <p className="font-medium">
                                    {hasFilters
                                        ? "No users match your filters"
                                        : "No users yet"}
                                </p>
                                <p className="mt-1 text-muted-foreground">
                                    {hasFilters
                                        ? "Try a different search or clear your filters."
                                        : "Add your first user to get started."}
                                </p>
                                <Button
                                    variant="outline"
                                    className="mt-4"
                                    onClick={hasFilters ? clearFilters : onAdd}
                                >
                                    {hasFilters ? "Clear filters" : "Add user"}
                                </Button>
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
                    of {filteredRows.length} users
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
                                {pageSizeItems.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>
                                        {item.label}
                                    </SelectItem>
                                ))}
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
