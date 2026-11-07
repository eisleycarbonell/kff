"use client"
import { useMemo } from "react"
import {
    useTable,
    createColumnHelper,
    tableFeatures,
    columnFilteringFeature,
    globalFilteringFeature,
    createFilteredRowModel,
    filterFn_includesString,
    rowSortingFeature,
    createSortedRowModel,
    sortFn_text,
    rowPaginationFeature,
    createPaginatedRowModel,
    rowSelectionFeature,
    columnVisibilityFeature,
} from "@tanstack/react-table"
import {
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    Download,
    Ellipsis,
    Pencil,
    Settings2,
    Trash2,
    X,
} from "lucide-react"
import type { PackingFormula } from "@/components/modules/packing-formulas/packing-formula.schema"
import { downloadCsv } from "@/lib/csv"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableHeader,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
const features = tableFeatures({
    columnFilteringFeature,
    globalFilteringFeature,
    filteredRowModel: createFilteredRowModel(),
    filterFns: { includesString: filterFn_includesString },
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: { text: sortFn_text },
    rowPaginationFeature,
    paginatedRowModel: createPaginatedRowModel(),
    rowSelectionFeature,
    columnVisibilityFeature,
})
const helper = createColumnHelper<typeof features, PackingFormula>()
type Props = {
    formulas: PackingFormula[]
    canManage: boolean
    busy: boolean
    onAdd: () => void
    onEdit: (formula: PackingFormula) => void
    onRemove: (formula: PackingFormula) => void
}
const labels: Record<string, string> = {
    itemSku: "SKU",
    itemName: "Product",
    brandName: "Brand",
    primaryUomName: "Output unit",
    materials: "Materials",
    updatedAt: "Updated",
}
export function PackingFormulaTable({ formulas, canManage, busy, onAdd, onEdit, onRemove }: Props) {
    const columns = useMemo(
        () =>
            helper.columns([
                helper.display({
                    id: "select",
                    enableHiding: false,
                    header: ({ table }) => (
                        <Checkbox
                            aria-label="Select formulas on this page"
                            checked={table.getIsAllPageRowsSelected()}
                            indeterminate={
                                table.getIsSomePageRowsSelected() &&
                                !table.getIsAllPageRowsSelected()
                            }
                            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                        />
                    ),
                    cell: ({ row }) => (
                        <Checkbox
                            aria-label={`Select ${row.original.itemName}`}
                            checked={row.getIsSelected()}
                            onCheckedChange={(checked) => row.toggleSelected(checked)}
                        />
                    ),
                }),
                helper.accessor("itemName", {
                    header: "Finished product",
                    sortFn: "text",
                    enableHiding: false,
                    cell: ({ row }) => (
                        <div>
                            <p className="font-medium">{row.original.itemName}</p>
                            <p className="text-xs text-muted-foreground">
                                {row.original.itemSku}
                                {!row.original.isActive ? " · Inactive product" : ""}
                            </p>
                        </div>
                    ),
                }),
                helper.accessor("itemSku", { header: "SKU", sortFn: "text" }),
                helper.accessor((row) => row.brandName ?? "", {
                    id: "brandName",
                    header: "Brand",
                    sortFn: "text",
                }),
                helper.accessor("primaryUomName", { header: "Per 1", sortFn: "text" }),
                helper.accessor(
                    (row) =>
                        row.components
                            .map(
                                (entry) =>
                                    `${entry.quantity} ${entry.uomName} ${entry.componentName} ${entry.componentSku}`,
                            )
                            .join("; "),
                    {
                        id: "materials",
                        header: "Materials",
                        cell: ({ row }) => (
                            <details>
                                <summary className="cursor-pointer font-medium">
                                    {row.original.componentCount} materials
                                </summary>
                                <ul className="mt-2 space-y-1 text-sm">
                                    {row.original.components.map((entry) => (
                                        <li key={entry.bomId}>
                                            {entry.quantity} {entry.uomName} · {entry.componentName}
                                            {!entry.componentIsActive ? " (inactive)" : ""}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        ),
                    },
                ),
                helper.accessor("updatedAt", {
                    header: "Updated",
                    sortFn: "text",
                    cell: ({ cell }) => new Date(cell.getValue()).toLocaleDateString(),
                }),
                helper.display({
                    id: "actions",
                    enableHiding: false,
                    header: () => <span className="sr-only">Actions</span>,
                    cell: ({ row }) =>
                        canManage && (
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    disabled={busy}
                                    render={
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label={`Actions for ${row.original.itemSku}`}
                                        />
                                    }
                                >
                                    <Ellipsis />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuGroup>
                                        <DropdownMenuItem
                                            disabled={busy || !row.original.isActive}
                                            onClick={() => onEdit(row.original)}
                                        >
                                            <Pencil />
                                            Edit formula
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            variant="destructive"
                                            disabled={busy}
                                            onClick={() => onRemove(row.original)}
                                        >
                                            <Trash2 />
                                            Remove formula
                                        </DropdownMenuItem>
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ),
                }),
            ]),
        [canManage, busy, onEdit, onRemove],
    )
    const table = useTable({
        features,
        data: formulas,
        columns,
        getRowId: (row) => String(row.itemId),
        globalFilterFn: "includesString",
        initialState: {
            pagination: { pageSize: 10, pageIndex: 0 },
            sorting: [{ id: "itemName", desc: false }],
            columnVisibility: { itemSku: false, updatedAt: false },
        },
    })
    const selected = table.getFilteredSelectedRowModel().rows
    const filtered = table.getFilteredRowModel().rows
    function exportRows() {
        downloadCsv("kff-packing-formulas.csv", [
            ["SKU", "Product", "Brand", "Output unit", "Materials"],
            ...(selected.length ? selected : filtered).map(({ original: row }) => [
                row.itemSku,
                row.itemName,
                row.brandName ?? "",
                row.primaryUomName,
                row.components
                    .map((entry) => `${entry.quantity} ${entry.uomName} ${entry.componentSku}`)
                    .join("; "),
            ]),
        ])
    }
    return (
        <div className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-xs">
            <div className="flex flex-wrap items-center gap-3 border-b p-4">
                <Input
                    className="h-10 w-full sm:w-72"
                    aria-label="Search packing formulas"
                    placeholder="Search products, brands, materials..."
                    value={table.state.globalFilter ?? ""}
                    onChange={(e) => {
                        table.setGlobalFilter(e.target.value)
                        table.setPageIndex(0)
                        table.resetRowSelection()
                    }}
                />
                {table.state.globalFilter && (
                    <Button
                        variant="ghost"
                        className="h-10"
                        onClick={() => {
                            table.setGlobalFilter("")
                            table.setPageIndex(0)
                            table.resetRowSelection()
                        }}
                    >
                        <X />
                        Reset
                    </Button>
                )}
                {selected.length > 0 && (
                    <Button variant="ghost" onClick={() => table.resetRowSelection()}>
                        {selected.length} selected · Clear selection
                    </Button>
                )}
                <div className="flex flex-wrap gap-3 sm:ml-auto">
                    <Button
                        variant="outline"
                        className="h-10"
                        disabled={!filtered.length}
                        onClick={exportRows}
                    >
                        <Download />
                        {selected.length ? "Export selected" : "Export CSV"}
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="outline" className="h-10" />}>
                            <Settings2 />
                            Columns
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                                {table
                                    .getAllLeafColumns()
                                    .filter((column) => column.getCanHide())
                                    .map((column) => (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(checked) =>
                                                column.toggleVisibility(checked)
                                            }
                                            closeOnClick={false}
                                        >
                                            {labels[column.id] ?? column.id}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <Table>
                <TableHeader className="bg-muted/50">
                    {table.getHeaderGroups().map((group) => (
                        <TableRow key={group.id}>
                            {group.headers.map((header) => (
                                <TableHead
                                    key={header.id}
                                    className="px-4"
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
                                            onClick={header.column.getToggleSortingHandler()}
                                        >
                                            <table.FlexRender header={header} />
                                            <ArrowUpDown className="size-3" />
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
                    {table.getRowModel().rows.map((row) => (
                        <TableRow
                            key={row.id}
                            data-state={row.getIsSelected() ? "selected" : undefined}
                            className="hover:bg-primary/5 data-[state=selected]:bg-primary/10"
                        >
                            {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id} className="px-4 py-4 align-top">
                                    <table.FlexRender cell={cell} />
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                    {!table.getRowModel().rows.length && (
                        <TableRow>
                            <TableCell
                                colSpan={table.getVisibleLeafColumns().length}
                                className="h-40 text-center"
                            >
                                <p>
                                    {table.state.globalFilter
                                        ? "No formulas match your search."
                                        : "No packing formulas yet."}
                                </p>
                                {canManage && !table.state.globalFilter && (
                                    <Button className="mt-3" disabled={busy} onClick={onAdd}>
                                        Create formula
                                    </Button>
                                )}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
                <span>
                    {filtered.length} formulas · Page {table.state.pagination.pageIndex + 1} of{" "}
                    {Math.max(1, table.getPageCount())}
                </span>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!table.getCanPreviousPage()}
                        onClick={() => table.previousPage()}
                    >
                        <ChevronLeft />
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!table.getCanNextPage()}
                        onClick={() => table.nextPage()}
                    >
                        Next
                        <ChevronRight />
                    </Button>
                </div>
            </div>
        </div>
    )
}
