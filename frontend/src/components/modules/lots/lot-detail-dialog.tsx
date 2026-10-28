"use client"

import { Pencil } from "lucide-react"
import { formatLotDecimal, type Lot } from "@/components/modules/lots/lot.schema"
import { useLotDetail } from "@/hooks/modules/lots/use-lots"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Skeleton } from "@/components/ui/skeleton"
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
    onOpenChange: (open: boolean) => void
    lot: Lot | null
    canManage: boolean
    isBusy: boolean
    onEdit: (lot: Lot) => void
}
const calendarFormat = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
})
const timeFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" })

export function LotDetailDialog({ open, onOpenChange, lot, canManage, isBusy, onEdit }: Props) {
    const detail = useLotDetail(open && lot ? lot.lotId : null)
    const current = detail.lot
    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!isBusy) onOpenChange(value)
            }}
        >
            {open && (
                <DialogContent
                    className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-5xl"
                    showCloseButton={!isBusy}
                >
                    <DialogHeader>
                        <DialogTitle className="break-words pr-6">
                            {current?.lotNumber ?? lot?.lotNumber ?? "Lot details"}
                        </DialogTitle>
                        <DialogDescription>
                            Review this lot&apos;s origin, inventory locations, and recorded
                            movements.
                        </DialogDescription>
                    </DialogHeader>
                    {detail.loadStatus === "loading" && (
                        <div
                            className="space-y-3"
                            aria-busy="true"
                            aria-label="Loading lot details"
                        >
                            <Skeleton className="h-24" />
                            <Skeleton className="h-64" />
                        </div>
                    )}
                    {detail.loadError && (
                        <Alert variant="destructive">
                            <AlertTitle>Unable to refresh lot details</AlertTitle>
                            <AlertDescription>
                                {detail.loadError.message}
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="mt-2"
                                    onClick={detail.retry}
                                    disabled={detail.isFetching || isBusy}
                                >
                                    {detail.isFetching ? "Retrying..." : "Retry"}
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}
                    {detail.loadStatus === "signed-out" && (
                        <Alert>
                            <AlertTitle>Sign in required</AlertTitle>
                            <AlertDescription>Sign in again to view this lot.</AlertDescription>
                        </Alert>
                    )}
                    {current && (
                        <>
                            <dl className="grid gap-4 rounded-lg border bg-muted/15 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                <div className="min-w-0">
                                    <dt className="text-xs font-medium text-muted-foreground">
                                        Item
                                    </dt>
                                    <dd className="mt-1 break-words font-medium">
                                        {current.itemName}
                                    </dd>
                                    <dd className="mt-1 break-words text-xs text-muted-foreground">
                                        {current.itemSku} · {current.itemType}
                                    </dd>
                                </div>
                                <div className="min-w-0">
                                    <dt className="text-xs font-medium text-muted-foreground">
                                        Origin
                                    </dt>
                                    <dd className="mt-1">{current.sourceType}</dd>
                                    {current.poNumber && (
                                        <dd className="mt-1 break-words font-medium">
                                            {current.poNumber}
                                            {current.poLineId !== null
                                                ? ` · line #${current.poLineId}`
                                                : ""}
                                        </dd>
                                    )}
                                    {current.packingOrderNumber && (
                                        <dd className="mt-1 break-words font-medium">
                                            {current.packingOrderNumber}
                                        </dd>
                                    )}
                                    {current.packingOrderId !== null &&
                                        !current.packingOrderNumber && (
                                            <dd className="mt-1">
                                                Packing order #{current.packingOrderId}
                                            </dd>
                                        )}
                                    {current.supplierName && (
                                        <dd className="mt-1 break-words text-xs text-muted-foreground">
                                            {current.supplierName}
                                        </dd>
                                    )}
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">
                                        Quality status
                                    </dt>
                                    <dd className="mt-1">
                                        <Badge
                                            variant="secondary"
                                            className={
                                                current.qcStatus === "Approved"
                                                    ? "bg-primary/10 text-primary"
                                                    : undefined
                                            }
                                        >
                                            {current.qcStatus}
                                        </Badge>
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">
                                        Primary unit
                                    </dt>
                                    <dd className="mt-1">{current.primaryUomName}</dd>
                                    {current.unitCost !== null && (
                                        <>
                                            <dt className="mt-2 text-xs font-medium text-muted-foreground">
                                                Unit cost
                                            </dt>
                                            <dd className="mt-1 break-words tabular-nums">
                                                {formatLotDecimal(current.unitCost)} /{" "}
                                                {current.primaryUomName}
                                            </dd>
                                        </>
                                    )}
                                </div>
                                {current.supplierLotNumber && (
                                    <div className="min-w-0">
                                        <dt className="text-xs font-medium text-muted-foreground">
                                            Supplier lot reference
                                        </dt>
                                        <dd className="mt-1 break-words">
                                            {current.supplierLotNumber}
                                        </dd>
                                    </div>
                                )}
                                {current.manufactureDate && (
                                    <div>
                                        <dt className="text-xs font-medium text-muted-foreground">
                                            Manufactured
                                        </dt>
                                        <dd className="mt-1">
                                            {calendarFormat.format(
                                                new Date(current.manufactureDate),
                                            )}
                                        </dd>
                                    </div>
                                )}
                                {current.expirationDate && (
                                    <div>
                                        <dt className="text-xs font-medium text-muted-foreground">
                                            Expires
                                        </dt>
                                        <dd className="mt-1">
                                            {calendarFormat.format(
                                                new Date(current.expirationDate),
                                            )}
                                        </dd>
                                    </div>
                                )}
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">
                                        Recorded
                                    </dt>
                                    <dd className="mt-1">
                                        {timeFormat.format(new Date(current.createdAt))}
                                    </dd>
                                    {current.createdBy !== null && (
                                        <dd className="mt-1 text-xs text-muted-foreground">
                                            User #{current.createdBy}
                                        </dd>
                                    )}
                                </div>
                            </dl>
                            <dl className="grid gap-3 sm:grid-cols-3">
                                {[
                                    { label: "On hand", value: current.qtyOnHand },
                                    { label: "Reserved", value: current.qtyReserved },
                                    { label: "Available", value: current.qtyAvailable },
                                ].map(({ label, value }) => (
                                    <div key={label} className="min-w-0 rounded-lg border p-4">
                                        <dt className="text-sm text-muted-foreground">{label}</dt>
                                        <dd className="mt-1 break-words text-xl font-semibold tabular-nums">
                                            {formatLotDecimal(value)}{" "}
                                            <span className="text-sm font-normal text-muted-foreground">
                                                {current.primaryUomName}
                                            </span>
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                            <section
                                aria-label="Lot inventory by location"
                                className="min-w-0 space-y-3"
                            >
                                <div>
                                    <h3 className="font-medium">Inventory by location</h3>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Quantities use {current.primaryUomName}, this item&apos;s
                                        primary unit.
                                    </p>
                                </div>
                                <div className="overflow-hidden rounded-lg border">
                                    <Table className="min-w-[720px]">
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead>Location</TableHead>
                                                <TableHead className="text-right">
                                                    On hand
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Reserved
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Available
                                                </TableHead>
                                                <TableHead>Updated</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {current.stocks.length ? (
                                                current.stocks.map((stock) => (
                                                    <TableRow key={stock.stockId}>
                                                        <TableCell className="max-w-64 whitespace-normal">
                                                            <p className="break-words font-medium">
                                                                {stock.locationName}
                                                            </p>
                                                            <p className="mt-1 break-words text-xs text-muted-foreground">
                                                                {stock.locationCode} ·{" "}
                                                                {stock.locationType}
                                                            </p>
                                                            {!stock.locationIsActive && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="mt-1"
                                                                >
                                                                    Inactive location
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums">
                                                            {formatLotDecimal(stock.qtyOnHand)}
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums">
                                                            {formatLotDecimal(stock.qtyReserved)}
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums">
                                                            {formatLotDecimal(stock.qtyAvailable)}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">
                                                            {timeFormat.format(
                                                                new Date(stock.lastUpdated),
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={5}
                                                        className="h-24 text-center text-muted-foreground"
                                                    >
                                                        No stock balances for this lot.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </section>
                            <section
                                aria-label="Lot inventory movements"
                                className="min-w-0 space-y-3"
                            >
                                <div>
                                    <h3 className="font-medium">Inventory movements</h3>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Recorded changes in {current.primaryUomName}, including
                                        receiving, packing, and transfers.
                                    </p>
                                </div>
                                <div className="overflow-hidden rounded-lg border">
                                    <Table className="min-w-[900px]">
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead>When</TableHead>
                                                <TableHead>Movement</TableHead>
                                                <TableHead>Location</TableHead>
                                                <TableHead className="text-right">
                                                    Quantity change
                                                </TableHead>
                                                <TableHead>References</TableHead>
                                                <TableHead>Authorized by</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {current.transactions.length ? (
                                                current.transactions.map((transaction) => {
                                                    const references = [
                                                        transaction.poLineId !== null
                                                            ? `PO line #${transaction.poLineId}`
                                                            : null,
                                                        transaction.packingOrderId !== null
                                                            ? `Packing order #${transaction.packingOrderId}`
                                                            : null,
                                                        transaction.transferLineId !== null
                                                            ? `Transfer line #${transaction.transferLineId}`
                                                            : null,
                                                        transaction.referenceId !== null
                                                            ? `Reference #${transaction.referenceId}`
                                                            : null,
                                                    ].filter(Boolean)
                                                    return (
                                                        <TableRow key={transaction.transactionId}>
                                                            <TableCell className="text-xs text-muted-foreground">
                                                                {timeFormat.format(
                                                                    new Date(transaction.createdAt),
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <p className="font-medium">
                                                                    {transaction.transactionType}
                                                                </p>
                                                                <p className="mt-1 text-xs text-muted-foreground">
                                                                    #{transaction.transactionId}
                                                                </p>
                                                            </TableCell>
                                                            <TableCell className="max-w-56 whitespace-normal">
                                                                <p className="break-words">
                                                                    {transaction.locationName}
                                                                </p>
                                                                <p className="mt-1 text-xs text-muted-foreground">
                                                                    {transaction.locationCode}
                                                                </p>
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">
                                                                {transaction.qtyChange.startsWith(
                                                                    "-",
                                                                )
                                                                    ? ""
                                                                    : "+"}
                                                                {formatLotDecimal(
                                                                    transaction.qtyChange,
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="max-w-64 whitespace-normal text-xs text-muted-foreground">
                                                                {references.length
                                                                    ? references.map(
                                                                          (reference) => (
                                                                              <p
                                                                                  key={reference}
                                                                                  className="break-words"
                                                                              >
                                                                                  {reference}
                                                                              </p>
                                                                          ),
                                                                      )
                                                                    : "—"}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">
                                                                User #
                                                                {transaction.authorizedByUserId}
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })
                                            ) : (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={6}
                                                        className="h-24 text-center text-muted-foreground"
                                                    >
                                                        No inventory movements for this lot.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </section>
                        </>
                    )}
                    <DialogFooter>
                        {current && canManage && (
                            <Button
                                type="button"
                                variant="outline"
                                className="mr-auto"
                                disabled={isBusy}
                                onClick={() => onEdit(current)}
                            >
                                <Pencil />
                                Edit metadata
                            </Button>
                        )}
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
    )
}
