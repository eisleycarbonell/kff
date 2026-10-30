"use client"

import {
    columnFilteringFeature,
    columnVisibilityFeature,
    createColumnHelper,
    createFilteredRowModel,
    createPaginatedRowModel,
    createSortedRowModel,
    filterFn_equalsString,
    filterFn_includesString,
    globalFilteringFeature,
    rowPaginationFeature,
    rowSelectionFeature,
    rowSortingFeature,
    sortFn_text,
    tableFeatures,
} from "@tanstack/react-table"
import { Ellipsis, Eye, Pencil, Truck, PackageCheck, X } from "lucide-react"
import type { Transfer } from "@/components/modules/transfers/transfer.schema"
import type { TransferAction } from "@/hooks/modules/transfers/use-transfers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export const features = tableFeatures({
    columnFilteringFeature,
    globalFilteringFeature,
    filteredRowModel: createFilteredRowModel(),
    filterFns: { includesString: filterFn_includesString, equalsString: filterFn_equalsString },
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: { text: sortFn_text },
    rowPaginationFeature,
    paginatedRowModel: createPaginatedRowModel(),
    rowSelectionFeature,
    columnVisibilityFeature,
})
const helper = createColumnHelper<typeof features, Transfer>()
export type TransferTableActions = {
    onView: (id: number) => void
    onEdit: (transfer: Transfer) => void
    onAction: (transfer: Transfer, action: TransferAction) => void
    canManage: boolean
    busy: boolean
}
export const labels: Record<string, string> = {
    transferNumber: "Transfer",
    status: "Status",
    source: "Source",
    destination: "Destination",
    lineCount: "Lots",
    requestedAt: "Requested",
    dispatchedAt: "Dispatched",
    receivedAt: "Received",
    notes: "Notes",
}
export function transferColumns({
    onView,
    onEdit,
    onAction,
    canManage,
    busy,
}: TransferTableActions) {
    return helper.columns([
        helper.display({
            id: "select",
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    aria-label="Select all transfers on page"
                    checked={table.getIsAllPageRowsSelected()}
                    indeterminate={
                        table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
                    }
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    aria-label={`Select ${row.original.transferNumber}`}
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(checked)}
                />
            ),
        }),
        helper.accessor("transferNumber", {
            header: "Transfer",
            sortFn: "text",
            enableHiding: false,
            cell: ({ row }) => (
                <button
                    className="font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onView(row.original.transferId)}
                >
                    {row.original.transferNumber}
                </button>
            ),
        }),
        helper.accessor("status", {
            header: "Status",
            sortFn: "text",
            filterFn: "equalsString",
            cell: ({ getValue }) => (
                <Badge
                    variant="outline"
                    className={
                        getValue() === "Completed"
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : getValue() === "In Transit"
                              ? "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                              : ""
                    }
                >
                    {getValue()}
                </Badge>
            ),
        }),
        helper.accessor((row) => `${row.sourceLocationCode} · ${row.sourceLocationName}`, {
            id: "source",
            header: "Source",
            sortFn: "text",
        }),
        helper.accessor(
            (row) => `${row.destinationLocationCode} · ${row.destinationLocationName}`,
            { id: "destination", header: "Destination", sortFn: "text" },
        ),
        helper.accessor("lineCount", {
            header: "Lots",
            enableGlobalFilter: false,
            sortFn: (a, b) => a.original.lineCount - b.original.lineCount,
            cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
        }),
        ...(["requestedAt", "dispatchedAt", "receivedAt"] as const).map((key) =>
            helper.accessor(key, {
                header: labels[key],
                sortFn: "text",
                enableGlobalFilter: false,
                cell: ({ getValue }) => {
                    const value = getValue()
                    return value ? (
                        <time dateTime={value} title={new Date(value).toLocaleString()}>
                            {value.slice(0, 10)}
                        </time>
                    ) : (
                        <span className="text-muted-foreground">Pending</span>
                    )
                },
            }),
        ),
        helper.accessor("notes", {
            header: "Notes",
            sortFn: "text",
            cell: ({ getValue }) => (
                <span className="block max-w-56 truncate" title={getValue() ?? undefined}>
                    {getValue()}
                </span>
            ),
        }),
        helper.display({
            id: "actions",
            enableHiding: false,
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => {
                const transfer = row.original
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Actions for ${transfer.transferNumber}`}
                                />
                            }
                        >
                            <Ellipsis />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>Stock transfer</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => onView(transfer.transferId)}>
                                    <Eye />
                                    View details
                                </DropdownMenuItem>
                                {canManage && transfer.status === "Draft" && (
                                    <>
                                        <DropdownMenuItem
                                            disabled={busy}
                                            onClick={() => onEdit(transfer)}
                                        >
                                            <Pencil />
                                            Edit draft
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            disabled={busy}
                                            onClick={() => onAction(transfer, "dispatch")}
                                        >
                                            <Truck />
                                            Dispatch
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            variant="destructive"
                                            disabled={busy}
                                            onClick={() => onAction(transfer, "cancel")}
                                        >
                                            <X />
                                            Cancel transfer
                                        </DropdownMenuItem>
                                    </>
                                )}
                                {canManage && transfer.status === "In Transit" && (
                                    <DropdownMenuItem
                                        disabled={busy}
                                        onClick={() => onAction(transfer, "receive")}
                                    >
                                        <PackageCheck />
                                        Confirm receipt
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            },
        }),
    ])
}
