"use client"

import { useId } from "react"
import Link from "next/link"
import { RefreshCw } from "lucide-react"
import {
    formatSalesDecimal,
    type SalesMaterialPlan,
    type SalesOrderOptions,
} from "@/components/modules/sales-orders/sales-order.schema"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
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

type Props = {
    open: boolean
    onClose: () => void
    sourceLocationId: number | null
    onSourceChange: (id: number | null) => void
    options: SalesOrderOptions
    optionsReady: boolean
    optionsError: Error | null
    retryOptions: () => void
    plan: SalesMaterialPlan | undefined
    error: Error | null
    loading: boolean
    refresh: () => void
}
export function SalesMaterialPlanDialog({
    open,
    onClose,
    sourceLocationId,
    onSourceChange,
    options,
    optionsReady,
    optionsError,
    retryOptions,
    plan,
    error,
    loading,
    refresh,
}: Props) {
    const id = useId()
    const sources = options.sourceLocations
        .filter((location) => location.isActive)
        .map((location) => ({
            value: location.locationId,
            label: location.code + " · " + location.name,
        }))
    const issues = plan?.products.filter((product) => product.issue) ?? []
    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!value) onClose()
            }}
        >
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-6xl">
                <DialogHeader>
                    <DialogTitle>
                        Customer order material plan
                        {plan ? ": " + plan.salesOrderNumber : ""}
                    </DialogTitle>
                    <DialogDescription>
                        Check finished stock first, then calculate raw
                        materials, packaging and labels needed for the remaining
                        demand.
                    </DialogDescription>
                </DialogHeader>
                <Field>
                    <FieldLabel htmlFor={id}>
                        Material source warehouse / packing location
                    </FieldLabel>
                    <Select
                        value={sourceLocationId}
                        items={sources}
                        disabled={!optionsReady}
                        onValueChange={onSourceChange}
                    >
                        <SelectTrigger
                            id={id}
                            className="w-full data-[size=default]:h-10"
                        >
                            <SelectValue placeholder="Select where materials will be packed from" />
                        </SelectTrigger>
                        <SelectContent>
                            {sources.map((source) => (
                                <SelectItem
                                    key={source.value}
                                    value={source.value}
                                >
                                    {source.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                {optionsError && (
                    <Alert variant="destructive">
                        <AlertTitle>Unable to load locations</AlertTitle>
                        <AlertDescription>
                            {optionsError.message}
                            <Button variant="outline" onClick={retryOptions}>
                                Retry locations
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
                {!optionsReady && !optionsError && (
                    <p role="status" className="text-sm text-muted-foreground">
                        Loading material source locations...
                    </p>
                )}
                {optionsReady && sources.length === 0 && (
                    <Alert>
                        <AlertTitle>No active material source</AlertTitle>
                        <AlertDescription>
                            Create or activate a Warehouse or Packing location
                            in Master Data before checking requirements.
                        </AlertDescription>
                    </Alert>
                )}
                {!sourceLocationId && sources.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                        Choose a source to calculate material availability at
                        that location. Finished-product availability covers
                        eligible warehouses, branches and stores.
                    </p>
                )}
                {loading && (
                    <p
                        role="status"
                        aria-live="polite"
                        className="text-sm text-muted-foreground"
                    >
                        Checking stock and material requirements...
                    </p>
                )}
                {error && (
                    <Alert variant="destructive">
                        <AlertTitle>
                            Unable to check material requirements
                        </AlertTitle>
                        <AlertDescription>
                            {error.message}
                            <Button
                                variant="outline"
                                disabled={loading}
                                onClick={refresh}
                            >
                                Retry material plan
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
                {plan && (
                    <div className="space-y-5" aria-busy={loading}>
                        {plan.customerPoNumber && (
                            <p className="text-sm">
                                Customer PO:{" "}
                                <span className="font-medium">
                                    {plan.customerPoNumber}
                                </span>
                            </p>
                        )}
                        <Alert>
                            <AlertTitle>Current planning estimate</AlertTitle>
                            <AlertDescription>
                                Outstanding delivery allocations are excluded
                                from demand. Finished supply excludes this
                                order’s draft deliveries. Available stock
                                deducts active reservations and excludes held,
                                expired and In Transit goods. This check creates
                                no reservations or purchase orders; refresh
                                before purchasing, packing or dispatching.
                            </AlertDescription>
                        </Alert>
                        <section className="space-y-2">
                            <h3 className="font-medium">Finished products</h3>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead>
                                            Unallocated demand
                                        </TableHead>
                                        <TableHead>
                                            Finished available
                                        </TableHead>
                                        <TableHead>Use from stock</TableHead>
                                        <TableHead>To pack</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {plan.products.map((product) => (
                                        <TableRow
                                            key={product.salesOrderLineId}
                                        >
                                            <TableCell>
                                                <p className="font-medium">
                                                    {product.itemName}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {product.itemSku}
                                                </p>
                                            </TableCell>
                                            {[
                                                product.qtyDemand,
                                                product.qtyFinishedAvailable,
                                                product.qtyFromStock,
                                                product.qtyToPack,
                                            ].map((qty, index) => (
                                                <TableCell
                                                    key={index}
                                                    className="tabular-nums"
                                                >
                                                    {formatSalesDecimal(qty)}{" "}
                                                    {product.uomName}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </section>
                        {issues.length > 0 && (
                            <Alert variant="destructive">
                                <AlertTitle>
                                    Resolve product setup before packing
                                </AlertTitle>
                                <AlertDescription>
                                    {issues.map((product) => (
                                        <p key={product.itemId}>
                                            {product.itemSku}: {product.issue}
                                        </p>
                                    ))}
                                </AlertDescription>
                            </Alert>
                        )}
                        <section className="space-y-2">
                            <h3 className="font-medium">
                                Combined materials at {plan.sourceLocationName}
                            </h3>
                            {plan.materials.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {issues.length
                                        ? "Requirements are unavailable for products with setup issues."
                                        : "No additional materials are needed for the current unallocated demand."}
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Material</TableHead>
                                            <TableHead>Required</TableHead>
                                            <TableHead>Available</TableHead>
                                            <TableHead>
                                                Shortage to purchase
                                            </TableHead>
                                            <TableHead>
                                                Linked suppliers
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {plan.materials.map((material) => (
                                            <TableRow key={material.itemId}>
                                                <TableCell>
                                                    <p className="font-medium">
                                                        {material.itemName}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {material.itemSku}
                                                    </p>
                                                </TableCell>
                                                {[
                                                    material.qtyRequired,
                                                    material.qtyAvailable,
                                                    material.qtyShortage,
                                                ].map((qty, index) => (
                                                    <TableCell
                                                        key={index}
                                                        className={
                                                            "tabular-nums " +
                                                            (index === 2 &&
                                                            /[1-9]/.test(qty)
                                                                ? "font-medium text-destructive"
                                                                : "")
                                                        }
                                                    >
                                                        {formatSalesDecimal(
                                                            qty,
                                                        )}{" "}
                                                        {material.uomName}
                                                    </TableCell>
                                                ))}
                                                <TableCell>
                                                    {material.suppliers.length
                                                        ? material.suppliers
                                                              .map(
                                                                  (supplier) =>
                                                                      supplier.name,
                                                              )
                                                              .join(", ")
                                                        : "Link an active supplier in Suppliers"}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                            {plan.materials.length > 0 && (
                                <p
                                    role="status"
                                    className="text-sm text-muted-foreground"
                                >
                                    {plan.canPack
                                        ? "Available materials cover this plan. Create packing orders and reserve the source lots to commit the stock."
                                        : "Resolve shortages or formula issues, receive any purchased materials into this source, then refresh the plan."}
                                </p>
                            )}
                        </section>
                        <p className="text-sm text-muted-foreground">
                            Shared components are combined across products
                            before availability is deducted. Create a separate
                            supplier PO per chosen supplier using the shortage
                            quantities and agreed purchase units. Open supplier
                            POs and other sales orders are not reserved supply
                            for this estimate.
                        </p>
                    </div>
                )}
                <DialogFooter className="flex-wrap">
                    <Button
                        variant="outline"
                        disabled={!sourceLocationId || loading}
                        onClick={refresh}
                    >
                        <RefreshCw />
                        Refresh stock
                    </Button>
                    <Button
                        variant="outline"
                        render={<Link href="/purchase-orders" />}
                        nativeButton={false}
                    >
                        Purchase orders
                    </Button>
                    <Button
                        variant="outline"
                        render={<Link href="/packing-orders" />}
                        nativeButton={false}
                    >
                        Packing orders
                    </Button>
                    <Button onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
