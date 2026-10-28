"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { Ellipsis, Package, Pencil, Plus, PowerOff, Search, Star } from "lucide-react"

import type { Supplier } from "@/components/modules/suppliers/supplier.schema"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { useSupplierItems } from "@/hooks/modules/suppliers/use-suppliers"

const SupplierItemForm = dynamic(() =>
    import("@/components/modules/suppliers/supplier-item-form").then(
        (module) => module.SupplierItemForm,
    ),
)

type Props = { open: boolean; onOpenChange: (open: boolean) => void; supplier: Supplier }

export function SupplierItemsDialog({ open, onOpenChange, supplier }: Props) {
    const {
        items,
        options,
        optionsReady,
        canManage,
        loadStatus,
        loadError,
        isFetching,
        retry,
        formOpen,
        setFormOpen,
        formRequested,
        editingItem,
        openAdd,
        openEdit,
        deactivatingItem,
        setDeactivatingItem,
        openDeactivate,
        handleSave,
        handleDeactivate,
        isSaving,
        isDeactivating,
        saveError,
        deactivateError,
    } = useSupplierItems(open ? supplier.supplierId : null)
    const [search, setSearch] = useState("")
    const searchTerm = search.trim().toLowerCase()
    const filteredItems = items.filter((item) =>
        `${item.itemSku} ${item.itemName} ${item.supplierItemCode ?? ""}`
            .toLowerCase()
            .includes(searchTerm),
    )
    const isBusy = isSaving || isDeactivating
    const errorMessage =
        loadError instanceof Error
            ? loadError.message
            : "Unable to load the supplier's item offers."

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={(value) => {
                    if (!isBusy) onOpenChange(value)
                }}
            >
                {open && (
                    <DialogContent
                        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl"
                        showCloseButton={!isBusy}
                    >
                        <DialogHeader>
                            <DialogTitle className="break-words pr-6">
                                Supplied items · {supplier.name}
                            </DialogTitle>
                            <DialogDescription>
                                Compare purchasing prices, units, delivery lead times, and preferred
                                item offers.
                            </DialogDescription>
                        </DialogHeader>
                        {!supplier.isActive && (
                            <Alert>
                                <AlertTitle>Inactive supplier</AlertTitle>
                                <AlertDescription>
                                    Reactivate this supplier before adding or enabling item offers.
                                    Existing offers remain available for reference.
                                </AlertDescription>
                            </Alert>
                        )}
                        {loadStatus === "loading" && (
                            <div
                                className="space-y-3"
                                aria-label="Loading supplied items"
                                aria-busy="true"
                            >
                                <Skeleton className="h-10 rounded-lg" />
                                <Skeleton className="h-60 rounded-lg" />
                            </div>
                        )}
                        {loadError && (
                            <Alert variant="destructive">
                                <AlertTitle>Unable to load supplied items</AlertTitle>
                                <AlertDescription>
                                    {errorMessage}
                                    <Button
                                        variant="outline"
                                        className="mt-2"
                                        disabled={isFetching}
                                        onClick={retry}
                                    >
                                        {isFetching ? "Retrying..." : "Retry"}
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        )}
                        {loadStatus === "signed-out" && (
                            <Alert>
                                <AlertTitle>Sign in required</AlertTitle>
                                <AlertDescription>
                                    Your session has ended. Sign in again to view this
                                    supplier&apos;s items.
                                </AlertDescription>
                            </Alert>
                        )}
                        {loadStatus === "ready" && (
                            <>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="relative w-full sm:w-72">
                                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            aria-label="Search supplied items"
                                            placeholder="Search items or supplier code..."
                                            value={search}
                                            onChange={(event) => setSearch(event.target.value)}
                                            className="h-10 pl-10"
                                        />
                                    </div>
                                    {canManage && (
                                        <Button
                                            className="h-10"
                                            disabled={isBusy || !supplier.isActive || !optionsReady}
                                            onClick={openAdd}
                                        >
                                            <Plus />
                                            Add supplied item
                                        </Button>
                                    )}
                                </div>
                                <div className="overflow-hidden rounded-lg border">
                                    <Table className="min-w-[720px]">
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead>Material</TableHead>
                                                <TableHead>Supplier code</TableHead>
                                                <TableHead>Price / unit</TableHead>
                                                <TableHead>Lead time</TableHead>
                                                <TableHead>Preference</TableHead>
                                                <TableHead>Status</TableHead>
                                                {canManage && (
                                                    <TableHead>
                                                        <span className="sr-only">Actions</span>
                                                    </TableHead>
                                                )}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredItems.map((item) => (
                                                <TableRow key={item.supplierItemId}>
                                                    <TableCell>
                                                        <p className="font-medium">
                                                            {item.itemName}
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                                            {item.itemSku}
                                                        </p>
                                                        {!item.itemIsActive && (
                                                            <Badge
                                                                variant="outline"
                                                                className="mt-1"
                                                            >
                                                                Item inactive
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {item.supplierItemCode ?? "—"}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-medium tabular-nums">
                                                            {item.defaultPrice ?? "Not set"}
                                                        </span>
                                                        <span className="ml-1 text-muted-foreground">
                                                            /{" "}
                                                            {item.defaultUomName ??
                                                                item.primaryUomName}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {item.leadTimeDays == null
                                                            ? "Not set"
                                                            : `${item.leadTimeDays} ${item.leadTimeDays === 1 ? "day" : "days"}`}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.isPreferred ? (
                                                            <Badge
                                                                variant="secondary"
                                                                className="gap-1 bg-primary/10 text-primary"
                                                            >
                                                                <Star className="size-3" />
                                                                Preferred
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground">
                                                                —
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="secondary"
                                                            className={
                                                                item.isActive
                                                                    ? "bg-primary/10 text-primary"
                                                                    : "text-muted-foreground"
                                                            }
                                                        >
                                                            {item.isActive ? "Active" : "Inactive"}
                                                        </Badge>
                                                    </TableCell>
                                                    {canManage && (
                                                        <TableCell className="text-right">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger
                                                                    render={
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon-sm"
                                                                            aria-label={`Actions for ${item.itemName}`}
                                                                            disabled={isBusy}
                                                                        />
                                                                    }
                                                                >
                                                                    <Ellipsis />
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuGroup>
                                                                        <DropdownMenuItem
                                                                            disabled={!optionsReady}
                                                                            onClick={() =>
                                                                                openEdit(item)
                                                                            }
                                                                        >
                                                                            <Pencil />
                                                                            Edit item offer
                                                                        </DropdownMenuItem>
                                                                        {item.isActive && (
                                                                            <DropdownMenuItem
                                                                                onClick={() =>
                                                                                    openDeactivate(
                                                                                        item,
                                                                                    )
                                                                                }
                                                                            >
                                                                                <PowerOff />
                                                                                Deactivate offer
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                    </DropdownMenuGroup>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))}
                                            {!filteredItems.length && (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={canManage ? 7 : 6}
                                                        className="h-44 text-center"
                                                    >
                                                        <Package className="mx-auto mb-3 size-7 text-muted-foreground" />
                                                        <p className="font-medium">
                                                            {searchTerm
                                                                ? "No supplied items match your search"
                                                                : "No supplied items yet"}
                                                        </p>
                                                        <p className="mt-1 text-muted-foreground">
                                                            {searchTerm
                                                                ? "Try another name, SKU, or supplier code."
                                                                : "Link a material to record its purchasing price and lead time."}
                                                        </p>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                <p className="text-sm text-muted-foreground" aria-live="polite">
                                    {filteredItems.length} of {items.length} supplied items
                                </p>
                            </>
                        )}
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => onOpenChange(false)}
                            >
                                Close
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>
            {formRequested && optionsReady && (
                <SupplierItemForm
                    open={open && formOpen && canManage}
                    onOpenChange={setFormOpen}
                    supplier={supplier}
                    item={editingItem}
                    items={items}
                    options={options}
                    onSave={handleSave}
                    isSaving={isSaving}
                    saveError={saveError}
                />
            )}
            <AlertDialog
                open={open && canManage && Boolean(deactivatingItem)}
                onOpenChange={(value) => {
                    if (!value && !isDeactivating) setDeactivatingItem(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate item offer?</AlertDialogTitle>
                        <AlertDialogDescription className="break-words">
                            {deactivatingItem?.itemName} will be disabled for this supplier and its
                            preferred status cleared. The offer and purchasing history remain
                            available.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {deactivateError && (
                        <Alert variant="destructive">
                            <AlertDescription>{deactivateError}</AlertDescription>
                        </Alert>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeactivating}>Cancel</AlertDialogCancel>
                        <AlertDialogAction disabled={isDeactivating} onClick={handleDeactivate}>
                            {isDeactivating ? "Deactivating..." : "Deactivate offer"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
