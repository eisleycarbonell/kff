"use client"

import { useMemo } from "react"
import { useTable } from "@tanstack/react-table"
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    ShieldCheck,
} from "lucide-react"
import type { Role } from "@/components/modules/roles/role.schema"
import { createRoleColumns, roleTableFeatures } from "@/components/modules/roles/role-table-columns"
import { RoleTableToolbar } from "@/components/modules/roles/role-table-toolbar"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty"

const sizes = [10, 20, 50].map((value) => ({ value: String(value), label: String(value) }))
export function RoleTable({
    roles,
    onAdd,
    onEdit,
    onDelete,
}: {
    roles: Role[]
    onAdd: () => void
    onEdit: (role: Role) => void
    onDelete: (role: Role) => void
}) {
    const columns = useMemo(() => createRoleColumns(onEdit, onDelete), [onEdit, onDelete])
    const table = useTable({
        features: roleTableFeatures,
        data: roles,
        columns,
        getRowId: (role) => String(role.roleId),
        globalFilterFn: "includesString",
        initialState: {
            pagination: { pageIndex: 0, pageSize: 10 },
            sorting: [{ id: "name", desc: false }],
            columnVisibility: { permission: false, userCount: false },
        },
    })
    const hasFilters = Boolean(table.state.globalFilter) || table.state.columnFilters.length > 0
    const filtered = table.getFilteredRowModel().rows
    const { pageIndex, pageSize } = table.state.pagination
    function reset() {
        table.setGlobalFilter("")
        table.resetColumnFilters()
        table.resetRowSelection()
        table.setPageIndex(0)
    }
    return (
        <div className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-xs">
            <RoleTableToolbar table={table} hasFilters={hasFilters} onReset={reset} />
            <Table>
                <TableHeader className="bg-muted/50">
                    {table.getHeaderGroups().map((group) => (
                        <TableRow key={group.id}>
                            {group.headers.map((header) => (
                                <TableHead
                                    key={header.id}
                                    className="h-12 px-4"
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
                                                <ArrowUpDown className="size-3.5" />
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
                                data-state={row.getIsSelected() ? "selected" : undefined}
                                className="hover:bg-primary/5 data-[state=selected]:bg-primary/10"
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id} className="px-4 py-4">
                                        <table.FlexRender cell={cell} />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell
                                colSpan={table.getVisibleLeafColumns().length}
                                className="h-64"
                            >
                                <Empty>
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <ShieldCheck />
                                        </EmptyMedia>
                                        <EmptyTitle>
                                            {hasFilters ? "No matching roles" : "No roles yet"}
                                        </EmptyTitle>
                                        <EmptyDescription>
                                            {hasFilters
                                                ? "Try another search or clear the filters."
                                                : "Create a role to define what your team can manage."}
                                        </EmptyDescription>
                                    </EmptyHeader>
                                    <EmptyContent>
                                        <Button
                                            variant="outline"
                                            onClick={hasFilters ? reset : onAdd}
                                        >
                                            {hasFilters ? "Clear filters" : "Add role"}
                                        </Button>
                                    </EmptyContent>
                                </Empty>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/15 px-5 py-4 text-sm">
                <p className="text-muted-foreground" aria-live="polite">
                    {filtered.length
                        ? `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, filtered.length)}`
                        : "0"}{" "}
                    of {filtered.length} roles
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    <Select
                        items={sizes}
                        value={String(pageSize)}
                        onValueChange={(value) => {
                            if (value) table.setPageSize(Number(value))
                        }}
                    >
                        <SelectTrigger aria-label="Rows per page" className="w-20">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {sizes.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span>
                        Page {pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
                    </span>
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
                </div>
            </div>
        </div>
    )
}
