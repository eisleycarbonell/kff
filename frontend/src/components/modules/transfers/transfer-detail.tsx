"use client"

import Link from "next/link"
import {
    formatTransferDecimal,
    type TransferDetail,
} from "@/components/modules/transfers/transfer.schema"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
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
    transfer: TransferDetail | undefined
    isLoading: boolean
    error?: string
    onRetry: () => void
}
export function TransferDetailDialog({
    open,
    onOpenChange,
    transfer,
    isLoading,
    error,
    onRetry,
}: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>
                        {transfer?.transferNumber ?? "Stock transfer details"}
                    </DialogTitle>
                    <DialogDescription>
                        Track requested, shipped and received quantities by finished-product lot.
                    </DialogDescription>
                </DialogHeader>
                {error && (
                    <div role="alert" className="space-y-2">
                        <p className="text-sm text-destructive">{error}</p>
                        <Button variant="outline" disabled={isLoading} onClick={onRetry}>
                            Retry details
                        </Button>
                    </div>
                )}
                {isLoading && !transfer && (
                    <p role="status" className="py-8 text-center text-muted-foreground">
                        Loading stock transfer…
                    </p>
                )}
                {transfer && (
                    <div className="space-y-5">
                        <Badge variant="outline">{transfer.status}</Badge>
                        <dl className="grid gap-4 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                            {[
                                [
                                    "Source",
                                    `${transfer.sourceLocationCode} · ${transfer.sourceLocationName}`,
                                ],
                                [
                                    "Destination",
                                    `${transfer.destinationLocationCode} · ${transfer.destinationLocationName}`,
                                ],
                                ["Requested", new Date(transfer.requestedAt).toLocaleString()],
                                ...(transfer.dispatchedAt
                                    ? [
                                          [
                                              "Dispatched",
                                              new Date(transfer.dispatchedAt).toLocaleString(),
                                          ],
                                      ]
                                    : []),
                                ...(transfer.receivedAt
                                    ? [
                                          [
                                              "Completed receipt",
                                              new Date(transfer.receivedAt).toLocaleString(),
                                          ],
                                      ]
                                    : []),
                            ].map(([label, value]) => (
                                <div key={label}>
                                    <dt className="text-muted-foreground">{label}</dt>
                                    <dd className="mt-1 font-medium">{value}</dd>
                                </div>
                            ))}
                        </dl>
                        {transfer.notes && (
                            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                {transfer.notes}
                            </p>
                        )}
                        <div className="overflow-x-auto rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product / lot</TableHead>
                                        <TableHead>Requested</TableHead>
                                        <TableHead>Shipped</TableHead>
                                        <TableHead>Received</TableHead>
                                        <TableHead>Outstanding</TableHead>
                                        <TableHead>Unit</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transfer.lines.map((line) => (
                                        <TableRow key={line.transferLineId}>
                                            <TableCell>
                                                <p className="font-medium">{line.itemName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {line.itemSku} · {line.lotNumber}
                                                </p>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {line.qcStatus}
                                                    {line.expirationDate
                                                        ? ` · Expires ${line.expirationDate}`
                                                        : ""}
                                                </p>
                                                {line.packingOrderId && (
                                                    <Link
                                                        className="mt-1 inline-block text-xs text-primary underline underline-offset-4"
                                                        href="/packing-orders"
                                                    >
                                                        Packing order #{line.packingOrderId}
                                                    </Link>
                                                )}
                                            </TableCell>
                                            {[
                                                line.qtyRequested,
                                                line.qtyShipped,
                                                line.qtyReceived,
                                                line.qtyOutstanding,
                                            ].map((quantity, index) => (
                                                <TableCell key={index} className="tabular-nums">
                                                    {formatTransferDecimal(quantity)}
                                                </TableCell>
                                            ))}
                                            <TableCell>{line.primaryUomName}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {transfer.status === "In Transit" && (
                            <p className="text-sm text-muted-foreground">
                                Outstanding quantities remain in company inventory at the original
                                In Transit location until receipt is confirmed.
                            </p>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
