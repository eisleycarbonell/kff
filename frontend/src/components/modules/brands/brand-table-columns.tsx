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
    type ReactTable,
} from "@tanstack/react-table"
import { Ellipsis, Pencil, Power, PowerOff, Tags } from "lucide-react"

import type { Brand } from "@/components/modules/brands/brand.schema"
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

export const brandTableFeatures = tableFeatures({
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

export type BrandTableInstance = ReactTable<typeof brandTableFeatures, Brand>

const helper = createColumnHelper<typeof brandTableFeatures, Brand>()
const dateFormat = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
})

type BrandColumnActions = {
    canManage: boolean
    isUpdating: boolean
    onEdit: (brand: Brand) => void
    onDeactivate: (brand: Brand) => void
    onActivate: (brand: Brand) => Promise<boolean>
}

export function createBrandColumns({
    canManage,
    isUpdating,
    onEdit,
    onDeactivate,
    onActivate,
}: BrandColumnActions) {
    return helper.columns([
        helper.display({
            id: "select",
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    aria-label="Select all brands on this page"
                    checked={table.getIsAllPageRowsSelected()}
                    indeterminate={
                        table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
                    }
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    aria-label={`Select ${row.original.name}`}
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(checked)}
                />
            ),
        }),
        helper.accessor("name", {
            header: "Brand",
            enableHiding: false,
            sortFn: "text",
            filterFn: "includesString",
            cell: ({ row }) => (
                <div className="flex items-center gap-3 py-1">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Tags className="size-5" aria-hidden="true" />
                    </div>
                    {canManage ? (
                        <button
                            type="button"
                            disabled={isUpdating}
                            className="rounded-sm text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                            onClick={() => onEdit(row.original)}
                        >
                            {row.original.name}
                        </button>
                    ) : (
                        <span className="font-medium">{row.original.name}</span>
                    )}
                </div>
            ),
        }),
        helper.accessor("code", { header: "Code", sortFn: "text" }),
        helper.accessor("description", {
            header: "Description",
            cell: ({ cell }) => cell.getValue() ?? "",
            sortFn: "text",
        }),
        helper.accessor("itemCount", { header: "Items", enableGlobalFilter: false }),
        helper.accessor((brand) => (brand.isActive ? "Active" : "Inactive"), {
            id: "status",
            header: "Status",
            sortFn: "text",
            filterFn: "equalsString",
            enableGlobalFilter: false,
            cell: ({ row, cell }) => (
                <Badge
                    variant="secondary"
                    className={
                        row.original.isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground"
                    }
                >
                    {cell.getValue()}
                </Badge>
            ),
        }),
        helper.accessor("createdAt", {
            header: "Date added",
            sortFn: "text",
            enableGlobalFilter: false,
            cell: ({ cell }) => (
                <span className="text-muted-foreground">
                    {dateFormat.format(new Date(cell.getValue()))}
                </span>
            ),
        }),
        ...(canManage
            ? [
                  helper.display({
                      id: "actions",
                      enableHiding: false,
                      header: () => <span className="sr-only">Actions</span>,
                      cell: ({ row }) => (
                          <DropdownMenu>
                              <DropdownMenuTrigger
                                  disabled={isUpdating}
                                  render={
                                      <Button
                                          variant="ghost"
                                          size="icon-sm"
                                          aria-label={`Actions for ${row.original.name}`}
                                      />
                                  }
                              >
                                  <Ellipsis />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuGroup>
                                      <DropdownMenuLabel>Brand actions</DropdownMenuLabel>
                                      <DropdownMenuItem
                                          disabled={isUpdating}
                                          onClick={() => onEdit(row.original)}
                                      >
                                          <Pencil />
                                          Edit brand
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      {row.original.isActive ? (
                                          <DropdownMenuItem
                                              disabled={isUpdating}
                                              onClick={() => onDeactivate(row.original)}
                                          >
                                              <PowerOff />
                                              Deactivate brand
                                          </DropdownMenuItem>
                                      ) : (
                                          <DropdownMenuItem
                                              disabled={isUpdating}
                                              onClick={() => void onActivate(row.original)}
                                          >
                                              <Power />
                                              Reactivate brand
                                          </DropdownMenuItem>
                                      )}
                                  </DropdownMenuGroup>
                              </DropdownMenuContent>
                          </DropdownMenu>
                      ),
                  }),
              ]
            : []),
    ])
}
