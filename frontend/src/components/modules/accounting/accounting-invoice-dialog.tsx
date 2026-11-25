"use client"

import { Printer } from "lucide-react"
import { scaled4 } from "@/components/modules/accounting/accounting-engine"
import {
    formatCurrency,
    type AccountingSalesCosting,
} from "@/components/modules/accounting/accounting.schema"
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
import { Separator } from "@/components/ui/separator"
import { useCompanySettings } from "@/hooks/modules/company-settings/use-company-settings"

function invoiceStatusLabel(row: AccountingSalesCosting): {
    label: string
    variant: "default" | "secondary" | "outline"
} {
    if (row.status === "Completed") return { label: "Billed", variant: "default" }
    if (row.status === "Partially Delivered") {
        return { label: "Partially Billed", variant: "secondary" }
    }
    if (row.status === "Cancelled") return { label: "Cancelled", variant: "outline" }
    return { label: "Pending Delivery", variant: "outline" }
}

export function AccountingInvoiceDialog({
    invoice,
    currencyCode,
    open,
    onOpenChange,
}: {
    invoice: AccountingSalesCosting | null
    currencyCode: string
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const company = useCompanySettings()
    const companyName = company.settings?.companyName ?? "Kusina Filipino Food"
    const billingStatus = invoice ? invoiceStatusLabel(invoice) : null
    const hasVat =
        invoice?.deliveredVatAmount != null &&
        scaled4(invoice.deliveredVatAmount) > BigInt(0)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg print:border-0 print:shadow-none">
                <DialogHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <DialogTitle>
                            Invoice Summary{" "}
                            {invoice ? `· INV-${invoice.salesOrderNumber}` : ""}
                        </DialogTitle>
                        {billingStatus && (
                            <Badge variant={billingStatus.variant}>
                                {billingStatus.label}
                            </Badge>
                        )}
                    </div>
                    <DialogDescription>
                        Customer invoice summary generated from sales order and completed deliveries.
                    </DialogDescription>
                </DialogHeader>

                {invoice && (
                    <div className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
                            <div className="space-y-1">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                    From
                                </p>
                                <p className="text-sm font-semibold text-foreground">
                                    {companyName}
                                </p>
                                {company.settings?.email && (
                                    <p className="text-muted-foreground">
                                        {company.settings.email}
                                    </p>
                                )}
                                {company.settings?.address && (
                                    <p className="text-muted-foreground">
                                        {company.settings.address}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Bill To
                                </p>
                                <p className="text-sm font-semibold text-foreground">
                                    {invoice.customerName}
                                </p>
                                <p className="text-muted-foreground">
                                    Order Date: {invoice.orderDate}
                                </p>
                                <p className="text-muted-foreground">
                                    Sales Order: {invoice.salesOrderNumber}
                                    {invoice.customerPoNumber
                                        ? ` · PO ${invoice.customerPoNumber}`
                                        : ""}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2 rounded-lg border p-3">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Order Status</span>
                                <span className="font-medium text-foreground">
                                    {invoice.status} ({invoice.completedDeliveryCount}/
                                    {invoice.deliveryCount} deliveries finished)
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Total Ordered (Ex-VAT)</span>
                                <span className="tabular-nums text-foreground">
                                    {formatCurrency(invoice.bookedRevenue, currencyCode)}
                                </span>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-foreground">
                                    Billed Sales (Delivered)
                                </span>
                                <span className="font-semibold tabular-nums text-foreground">
                                    {formatCurrency(invoice.deliveredRevenue, currencyCode)}
                                </span>
                            </div>
                            {hasVat && invoice.deliveredVatAmount && (
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-muted-foreground">Output VAT</span>
                                    <span className="tabular-nums text-foreground">
                                        {formatCurrency(invoice.deliveredVatAmount, currencyCode)}
                                    </span>
                                </div>
                            )}
                            <Separator />
                            <div className="flex items-center justify-between gap-2 text-sm">
                                <span className="font-semibold text-foreground">
                                    Total Billed Amount
                                </span>
                                <span className="font-bold tabular-nums text-foreground">
                                    {formatCurrency(
                                        invoice.deliveredBilling ?? invoice.deliveredRevenue,
                                        currencyCode,
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 rounded-lg border border-dashed bg-muted/10 p-3 sm:grid-cols-3 print:hidden">
                            <div>
                                <p className="text-[11px] text-muted-foreground">
                                    Product Cost (COGS)
                                </p>
                                <p className="font-semibold tabular-nums">
                                    {formatCurrency(invoice.deliveredCogs, currencyCode)}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] text-muted-foreground">Net Profit</p>
                                <p className="font-semibold tabular-nums">
                                    {formatCurrency(invoice.grossProfit, currencyCode)}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] text-muted-foreground">Margin %</p>
                                <p className="font-semibold tabular-nums">
                                    {invoice.grossMarginPercent !== null
                                        ? `${invoice.grossMarginPercent}%`
                                        : "—"}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter className="print:hidden">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Close
                    </Button>
                    <Button
                        type="button"
                        onClick={() => window.print()}
                        disabled={!invoice}
                    >
                        <Printer className="mr-1.5 size-4" />
                        Print Invoice
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
