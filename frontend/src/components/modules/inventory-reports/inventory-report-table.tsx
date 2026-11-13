"use client"
import { memo, useMemo } from "react"
import {
    useTable,
    createColumnHelper,
    tableFeatures,
    rowSortingFeature,
    createSortedRowModel,
    rowPaginationFeature,
    createPaginatedRowModel,
    rowSelectionFeature,
    columnVisibilityFeature,
    sortFn_text,
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronLeft, ChevronRight, Download, Settings2 } from "lucide-react"
import {
    decimalUnits,
    reportCsv,
    type InventoryReport,
    type InventoryReportRow,
} from "./inventory-report.schema"
import { downloadCsv } from "@/lib/csv"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
    DropdownMenuLabel,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
const features = tableFeatures({
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: { text: sortFn_text },
    rowPaginationFeature,
    paginatedRowModel: createPaginatedRowModel(),
    rowSelectionFeature,
    columnVisibilityFeature,
})
const helper = createColumnHelper<typeof features, InventoryReportRow>()
const numericSort = (a: string | null, b: string | null) => {
    const left = decimalUnits(a ?? "0")
    const right = decimalUnits(b ?? "0")
    return left < right ? -1 : left > right ? 1 : 0
}
export const InventoryReportTable = memo(function InventoryReportTable({ report }: { report: InventoryReport }) {
    const columns = useMemo(() => {
        const movement = report.report === "movement"
        const detail = report.report === "stock-by-lot" || report.report === "near-expiry"
        return helper.columns([
            helper.display({
                id: "select",
                enableHiding: false,
                header: ({ table }) => (
                    <Checkbox
                        aria-label="Select report rows on this page"
                        checked={table.getIsAllPageRowsSelected()}
                        indeterminate={
                            table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
                        }
                        onCheckedChange={(value) => table.toggleAllPageRowsSelected(value)}
                    />
                ),
                cell: ({ row }) => (
                    <Checkbox
                        aria-label={`Select ${row.original.sku} ${row.original.rowId}`}
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(value)}
                    />
                ),
            }),
            helper.accessor("itemName", {
                header: "Item / Product",
                enableHiding: false,
                sortFn: "text",
                cell: ({ row }) => (
                    <div>
                        <p className="font-medium">{row.original.itemName}</p>
                        <p className="text-xs text-muted-foreground">
                            {row.original.sku}
                            {!row.original.isActive ? " (inactive)" : ""}
                        </p>
                    </div>
                ),
            }),
            helper.accessor((row) => row.brandName ?? "", {
                id: "brandName",
                header: "Brand",
                sortFn: "text",
            }),
            ...(report.report !== "low-stock"
                ? [
                      helper.accessor((row) => row.locationName ?? "", {
                          id: "locationName",
                          header: "Location",
                          sortFn: "text",
                          cell: ({ row }) => (
                              <div>
                                  {row.original.locationName}
                                  <p className="text-xs text-muted-foreground">
                                      {row.original.locationCode} / {row.original.locationType}
                                  </p>
                              </div>
                          ),
                      }),
                  ]
                : []),
            ...(detail || movement
                ? [
                      helper.accessor((row) => row.lotNumber ?? "", {
                          id: "lotNumber",
                          header: "Lot / Batch",
                          sortFn: "text",
                      }),
                  ]
                : [
                      helper.accessor("lotCount", {
                          header: "Lots",
                          sortFn: (a, b) => a.original.lotCount - b.original.lotCount,
                      }),
                  ]),
            ...(report.report === "low-stock"
                ? [
                      helper.accessor((row) => row.reorderLevel ?? "", {
                          id: "reorderLevel",
                          header: "Reorder level",
                          sortFn: (a, b) =>
                              numericSort(
                                  a.original.reorderLevel ?? null,
                                  b.original.reorderLevel ?? null,
                              ),
                      }),
                  ]
                : []),
            helper.accessor("primaryUomName", { header: "Unit", sortFn: "text" }),
            ...(!movement
                ? (["qtyOnHand", "qtyReserved", "qtyAvailable"] as const).map((key) =>
                      helper.accessor(key, {
                          header: {
                              qtyOnHand: "On hand",
                              qtyReserved: "Reserved",
                              qtyAvailable:
                                  report.report === "low-stock"
                                      ? "Eligible available"
                                      : "Available",
                          }[key],
                          sortFn: (a, b) => numericSort(a.original[key], b.original[key]),
                          cell: ({ cell }) => (
                              <span className="whitespace-nowrap tabular-nums">
                                  {cell.getValue()}
                              </span>
                          ),
                      }),
                  )
                : []),
            ...(detail
                ? [
                      helper.accessor((row) => row.qcStatus ?? "", {
                          id: "qcStatus",
                          header: "QC",
                          sortFn: "text",
                      }),
                      helper.accessor((row) => row.expirationDate ?? "", {
                          id: "expirationDate",
                          header: "Expiry date",
                          sortFn: "text",
                      }),
                      helper.accessor(
                          (row) =>
                              row.daysToExpiry === null
                                  ? ""
                                  : row.daysToExpiry < 0
                                    ? `Expired ${-row.daysToExpiry} days ago`
                                    : row.daysToExpiry === 0
                                      ? "Expires today"
                                      : `${row.daysToExpiry} days`,
                          {
                              id: "expiryStatus",
                              header: "Expiry status",
                              sortFn: (a, b) =>
                                  (a.original.daysToExpiry ?? Number.MAX_SAFE_INTEGER) -
                                  (b.original.daysToExpiry ?? Number.MAX_SAFE_INTEGER),
                          },
                      ),
                  ]
                : []),
            ...(movement
                ? [
                      helper.accessor((row) => row.occurredAt ?? "", {
                          id: "occurredAt",
                          header: "Date / Time (UTC)",
                          sortFn: "text",
                          cell: ({ cell }) =>
                              cell.getValue().replace("T", " ").replace("Z", " UTC"),
                      }),
                      helper.accessor((row) => row.transactionType ?? "", {
                          id: "transactionType",
                          header: "Movement",
                          sortFn: "text",
                      }),
                      helper.accessor((row) => row.qtyChange ?? "0", {
                          id: "qtyChange",
                          header: "Quantity change",
                          sortFn: (a, b) => numericSort(a.original.qtyChange, b.original.qtyChange),
                          cell: ({ cell }) => (
                              <span className="whitespace-nowrap font-medium tabular-nums">
                                  {cell.getValue()}
                              </span>
                          ),
                      }),
                      helper.accessor((row) => row.actorName ?? "", {
                          id: "actorName",
                          header: "Recorded by",
                          sortFn: "text",
                      }),
                      helper.accessor((row) => row.reasonCode ?? "", {
                          id: "reasonCode",
                          header: "Reason",
                          sortFn: "text",
                      }),
                  ]
                : []),
            ...(detail || movement
                ? [
                      helper.accessor((row) => row.sourceReference ?? "", {
                          id: "sourceReference",
                          header: "Source document",
                          sortFn: "text",
                      }),
                  ]
                : []),
        ])
    }, [report.report])
    const table = useTable({
        features,
        data: report.rows,
        columns,
        getRowId: (row) => row.rowId,
        initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
    })
    const selected = table.getSelectedRowModel().rows
    return (
        <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 border-b p-4">
                <p className="text-sm text-muted-foreground">{report.rows.length} matching rows</p>
                {selected.length > 0 && (
                    <Button
                        variant="ghost"
                        className="h-10"
                        onClick={() => table.resetRowSelection()}
                    >
                        {selected.length} selected / Clear selection
                    </Button>
                )}
                <div className="flex flex-wrap gap-3 sm:ml-auto">
                    <Button
                        variant="outline"
                        className="h-10"
                        disabled={!report.rows.length}
                        onClick={() =>
                            downloadCsv(
                                "kff-" + report.report + ".csv",
                                reportCsv(
                                    report,
                                    selected.length
                                        ? selected.map((row) => row.original)
                                        : report.rows,
                                ),
                            )
                        }
                    >
                        <Download />
                        {selected.length ? "Export selected" : "Export CSV"}
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger render={<Button className="h-10" variant="outline" />}>
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
                                            closeOnClick={false}
                                            onCheckedChange={(value) =>
                                                column.toggleVisibility(value)
                                            }
                                        >
                                            {typeof column.columnDef.header === "string"
                                                ? column.columnDef.header
                                                : column.id}
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
                    {!report.rows.length && (
                        <TableRow>
                            <TableCell
                                colSpan={table.getVisibleLeafColumns().length}
                                className="h-40 text-center text-muted-foreground"
                            >
                                No records match these report filters. Adjust the filters or record
                                the relevant inventory operation.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
                <span>
                    Page {table.state.pagination.pageIndex + 1} of{" "}
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
})
