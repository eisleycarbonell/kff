"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
    AlertCircle,
    ArrowUpRight,
    ClipboardList,
    Factory,
    ShoppingCart,
    X,
} from "lucide-react"

import {
    formatPurchaseOrderDecimal,
    type PurchaseOrderFormValues,
    type PurchaseOrderOptions,
} from "@/components/modules/purchase-orders/purchase-order.schema"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { DASHBOARD_QUERY_KEY, getDashboardData } from "@/hooks/modules/dashboard/use-dashboard"
import { useSession } from "@/hooks/use-session"

type Props = {
    canManage: boolean
    isBusy: boolean
    options: PurchaseOrderOptions
    optionsReady: boolean
    onPrepareRequisition: (draft: Partial<PurchaseOrderFormValues>) => void
}

function formatSignedQty(value: string): string {
    const trimmed = value.trim()
    if (trimmed.startsWith("-")) {
        const formatted = formatPurchaseOrderDecimal(trimmed.slice(1))
        return formatted === "—" ? "—" : `-${formatted}`
    }
    return formatPurchaseOrderDecimal(trimmed)
}

function parsePositiveInt(raw: string | null): number | null {
    if (!raw || !/^\d+$/.test(raw.trim())) return null
    const parsed = Number(raw.trim())
    return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2_147_483_647
        ? parsed
        : null
}

function normalizePositiveQty4(raw: string | null): string {
    if (!raw) return ""
    const trimmed = raw.trim()
    if (!/^\d{1,10}(?:\.\d+)?$/.test(trimmed)) return ""
    const [whole = "0", frac = ""] = trimmed.split(".")
    let units4: bigint
    if (frac.length <= 4) {
        units4 = BigInt(whole) * BigInt(10000) + BigInt(frac.padEnd(4, "0"))
    } else {
        const head = frac.slice(0, 4)
        const tail = frac.slice(4)
        units4 = BigInt(whole) * BigInt(10000) + BigInt(head) + (/[1-9]/.test(tail) ? BigInt(1) : BigInt(0))
    }
    if (units4 <= BigInt(0)) return ""
    const wholePart = units4 / BigInt(10000)
    const fracPart = (units4 % BigInt(10000)).toString().padStart(4, "0").replace(/0+$/, "")
    return fracPart ? `${wholePart}.${fracPart}` : `${wholePart}`
}

function parseItemsParam(raw: string | null): { itemId: number; qtyOrdered: string }[] {
    if (!raw) return []
    const parsed: { itemId: number; qtyOrdered: string }[] = []
    const seen = new Set<number>()
    for (const token of raw.split(",")) {
        const [idPart, qtyPart] = token.split(":")
        const itemId = parsePositiveInt(idPart ?? null)
        if (!itemId || seen.has(itemId)) continue
        seen.add(itemId)
        parsed.push({
            itemId,
            qtyOrdered: normalizePositiveQty4(qtyPart ?? null),
        })
    }
    return parsed
}

function findLinkedSuppliers(itemId: number, options: PurchaseOrderOptions) {
    const activeSuppliers = new Map(
        options.suppliers
            .filter((supplier) => supplier.isActive)
            .map((supplier) => [supplier.supplierId, supplier]),
    )
    return options.supplierItems
        .filter(
            (offer) =>
                offer.itemId === itemId &&
                offer.isActive &&
                activeSuppliers.has(offer.supplierId),
        )
        .map((offer) => ({
            supplierId: offer.supplierId,
            name: activeSuppliers.get(offer.supplierId)!.name,
            isPreferred: offer.isPreferred,
        }))
        .sort((a, b) => {
            if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1
            return a.name.localeCompare(b.name)
        })
}

export function PurchaseOrderRequisitions({
    canManage,
    isBusy,
    options,
    optionsReady,
    onPrepareRequisition,
}: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const session = useSession()

    const dashboardQuery = useQuery({
        queryKey: [...DASHBOARD_QUERY_KEY, session.data?.userId],
        queryFn: ({ signal }) => getDashboardData(signal),
        enabled: Boolean(session.data),
    })

    const source = searchParams.get("source")
    const soNumber = searchParams.get("soNumber")?.trim() ?? ""
    const customerPo = searchParams.get("customerPo")?.trim() ?? ""
    const requestedSupplierId = parsePositiveInt(searchParams.get("supplierId"))
    const requestedItems = parseItemsParam(searchParams.get("items"))
    const singleItemId = parsePositiveInt(searchParams.get("itemId"))
    const singleSku = searchParams.get("sku")?.trim() ?? ""
    const singleQty = normalizePositiveQty4(searchParams.get("qty"))

    const hasIncomingSalesReq = source === "sales-order" && requestedItems.length > 0
    const hasIncomingLowStockReq = source === "low-stock" && singleItemId !== null

    const lowStockMaterials = (dashboardQuery.data?.lowStockItems ?? []).filter(
        (item) => item.itemType !== "Finished Good",
    )

    if (!hasIncomingSalesReq && !hasIncomingLowStockReq && lowStockMaterials.length === 0) {
        return null
    }

    const dismissUrlRequisition = () => {
        router.replace("/purchase-orders")
    }

    const renderIncomingRequisition = () => {
        if (hasIncomingSalesReq) {
            const supplier = requestedSupplierId
                ? options.suppliers.find((s) => s.supplierId === requestedSupplierId)
                : undefined
            const resolvedLines = requestedItems
                .map((entry) => {
                    const item = options.items.find((candidate) => candidate.itemId === entry.itemId)
                    return {
                        ...entry,
                        item,
                    }
                })
                .filter((entry) =>
                    !optionsReady ||
                    (entry.item?.isActive && entry.item.itemType !== "Finished Good"),
                )

            const canConvert =
                canManage &&
                optionsReady &&
                Boolean(supplier?.isActive) &&
                resolvedLines.length > 0 &&
                resolvedLines.every((entry) =>
                    options.supplierItems.some(
                        (offer) =>
                            offer.supplierId === supplier!.supplierId &&
                            offer.itemId === entry.itemId &&
                            offer.isActive,
                    ),
                )

            const notesParts = [
                soNumber ? `Replenishment requisition for ${soNumber}` : "Sales demand requisition",
                customerPo ? `Customer PO: ${customerPo}` : "",
            ].filter(Boolean)

            return (
                <Alert className="border-primary/40 bg-primary/5">
                    <ClipboardList className="size-4 text-primary" />
                    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1.5">
                            <AlertTitle className="flex flex-wrap items-center gap-2">
                                <span>
                                    Sales Order Material Requisition
                                    {soNumber ? `: ${soNumber}` : ""}
                                </span>
                                {customerPo && (
                                    <Badge variant="outline" className="text-[11px]">
                                        Customer PO: {customerPo}
                                    </Badge>
                                )}
                            </AlertTitle>
                            <AlertDescription className="space-y-1.5">
                                <p>
                                    {supplier
                                        ? `Suggested supplier: ${supplier.name}${supplier.isActive ? "" : " (inactive)"}.`
                                        : "Review material shortages from Customer Demand before drafting the PO."}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {resolvedLines.map((entry) => (
                                        <Badge
                                            key={entry.itemId}
                                            variant="secondary"
                                            className="font-mono text-[11px]"
                                        >
                                            {entry.item
                                                ? `${entry.item.sku} · ${entry.item.name}`
                                                : `Item #${entry.itemId}`}
                                            {entry.qtyOrdered
                                                ? ` (${formatPurchaseOrderDecimal(entry.qtyOrdered)}${entry.item ? ` ${entry.item.primaryUomName}` : ""})`
                                                : ""}
                                        </Badge>
                                    ))}
                                </div>
                                {!canManage && (
                                    <p className="text-xs text-muted-foreground">
                                        Purchasing permission is required to prepare a PO from this
                                        requisition.
                                    </p>
                                )}
                            </AlertDescription>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {canManage && (
                                <Button
                                    size="sm"
                                    disabled={isBusy || !canConvert}
                                    onClick={() =>
                                        onPrepareRequisition({
                                            supplierId: supplier!.supplierId,
                                            notes: notesParts.join(" · "),
                                            lines: resolvedLines.map((entry) => ({
                                                itemId: entry.itemId,
                                                uomId: entry.item?.primaryUomId ?? null,
                                                qtyOrdered: entry.qtyOrdered,
                                                unitPrice: "",
                                            })),
                                        })
                                    }
                                >
                                    <ShoppingCart className="size-3.5" />
                                    Prepare Requisition PO
                                </Button>
                            )}
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={dismissUrlRequisition}
                                aria-label="Dismiss requisition"
                            >
                                <X className="size-4" />
                                Dismiss
                            </Button>
                        </div>
                    </div>
                </Alert>
            )
        }

        if (hasIncomingLowStockReq && singleItemId !== null) {
            const optionItem = options.items.find((item) => item.itemId === singleItemId)
            const lowStockMatch = dashboardQuery.data?.lowStockItems.find(
                (item) => item.itemId === singleItemId,
            )
            const itemType = optionItem?.itemType ?? lowStockMatch?.itemType
            const itemSku = optionItem?.sku ?? lowStockMatch?.itemSku ?? singleSku
            const itemName = optionItem?.name ?? lowStockMatch?.itemName ?? `Item #${singleItemId}`

            if (itemType === "Finished Good") {
                return (
                    <Alert>
                        <Factory className="size-4" />
                        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 space-y-1">
                                <AlertTitle>
                                    Finished Good Low Stock: {itemSku || itemName}
                                </AlertTitle>
                                <AlertDescription>
                                    {itemName} is a Finished Good and is replenished by creating a
                                    Packing Order from raw and packaging materials rather than a
                                    supplier Purchase Order.
                                </AlertDescription>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    render={<Link href="/packing-orders" />}
                                    nativeButton={false}
                                >
                                    Go to Packing Orders
                                    <ArrowUpRight className="size-3.5" />
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={dismissUrlRequisition}
                                >
                                    <X className="size-4" />
                                    Dismiss
                                </Button>
                            </div>
                        </div>
                    </Alert>
                )
            }

            const linkedSuppliers = optionsReady ? findLinkedSuppliers(singleItemId, options) : []
            const primarySupplier = linkedSuppliers[0] ?? null

            return (
                <Alert className="border-amber-500/40 bg-amber-500/5">
                    <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
                    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1">
                            <AlertTitle>
                                Low-Stock Replenishment Requisition:{" "}
                                {itemSku ? `${itemSku} · ${itemName}` : itemName}
                            </AlertTitle>
                            <AlertDescription className="space-y-1">
                                {lowStockMatch && (
                                    <p className="tabular-nums">
                                        Available: {formatSignedQty(lowStockMatch.qtyAvailable)}{" "}
                                        {lowStockMatch.primaryUomName} (On hand:{" "}
                                        {formatSignedQty(lowStockMatch.qtyOnHand)}, Reserved:{" "}
                                        {formatSignedQty(lowStockMatch.qtyReserved)})
                                    </p>
                                )}
                                <p>
                                    {optionsReady
                                        ? primarySupplier
                                            ? `Linked supplier: ${primarySupplier.name}${linkedSuppliers.length > 1 ? ` (+${linkedSuppliers.length - 1} more)` : ""}.`
                                            : "No active supplier is linked to this material yet."
                                        : "Loading linked supplier options..."}
                                </p>
                            </AlertDescription>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {canManage && optionsReady && primarySupplier && optionItem?.isActive && (
                                <Button
                                    size="sm"
                                    disabled={isBusy}
                                    onClick={() =>
                                        onPrepareRequisition({
                                            supplierId: primarySupplier.supplierId,
                                            notes: `Low-stock replenishment requisition for ${itemSku || itemName}`,
                                            lines: [
                                                {
                                                    itemId: singleItemId,
                                                    uomId: singleQty ? optionItem.primaryUomId : null,
                                                    qtyOrdered: singleQty,
                                                    unitPrice: "",
                                                },
                                            ],
                                        })
                                    }
                                >
                                    <ShoppingCart className="size-3.5" />
                                    Prepare Requisition PO
                                </Button>
                            )}
                            {optionsReady && !primarySupplier && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    render={<Link href="/suppliers" />}
                                    nativeButton={false}
                                >
                                    Link supplier
                                    <ArrowUpRight className="size-3.5" />
                                </Button>
                            )}
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={dismissUrlRequisition}
                            >
                                <X className="size-4" />
                                Dismiss
                            </Button>
                        </div>
                    </div>
                </Alert>
            )
        }

        return null
    }

    return (
        <div className="space-y-4">
            {renderIncomingRequisition()}

            {lowStockMaterials.length > 0 && (
                <Card className="border border-amber-500/30 shadow-xs">
                    <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                                <CardTitle className="text-base font-semibold">
                                    Replenishment Requisitions
                                </CardTitle>
                                <Badge variant="destructive" className="h-5 px-1.5 text-[11px]">
                                    {lowStockMaterials.length} Low Stock
                                </Badge>
                            </div>
                            <CardDescription className="text-xs">
                                Active raw materials, packaging, and labels below their reorder
                                threshold ready for supplier PO creation.
                            </CardDescription>
                        </div>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 self-start text-xs text-muted-foreground hover:text-foreground sm:self-auto"
                            render={<Link href="/reports/inventory" />}
                            nativeButton={false}
                        >
                            Low Stock Report
                            <ArrowUpRight className="size-3.5" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-2.5 md:grid-cols-2">
                            {lowStockMaterials.map((item) => {
                                const linkedSuppliers = optionsReady
                                    ? findLinkedSuppliers(item.itemId, options)
                                    : []
                                const primarySupplier = linkedSuppliers[0] ?? null
                                const optionItem = options.items.find(
                                    (candidate) => candidate.itemId === item.itemId,
                                )
                                const isOut = !/[1-9]/.test(item.qtyAvailable) || item.qtyAvailable.startsWith("-")

                                return (
                                    <div
                                        key={item.itemId}
                                        className="flex min-w-0 flex-col justify-between gap-2.5 rounded-xl border bg-card p-3 sm:flex-row sm:items-center"
                                    >
                                        <div className="min-w-0 space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-mono text-xs font-semibold text-primary">
                                                    {item.itemSku}
                                                </span>
                                                <Badge
                                                    variant={isOut ? "destructive" : "secondary"}
                                                    className="text-[10px]"
                                                >
                                                    {isOut ? "Out of Stock" : "Below Threshold"}
                                                </Badge>
                                                <span className="text-[11px] text-muted-foreground">
                                                    {item.itemType}
                                                </span>
                                            </div>
                                            <p className="truncate text-sm font-medium text-foreground">
                                                {item.itemName}
                                            </p>
                                            <p className="text-xs text-muted-foreground tabular-nums">
                                                Available:{" "}
                                                <span className="font-semibold text-foreground">
                                                    {formatSignedQty(item.qtyAvailable)}{" "}
                                                    {item.primaryUomName}
                                                </span>{" "}
                                                · On hand: {formatSignedQty(item.qtyOnHand)} ·
                                                Reserved: {formatSignedQty(item.qtyReserved)}
                                            </p>
                                            {optionsReady && (
                                                <p className="truncate text-[11px] text-muted-foreground">
                                                    {linkedSuppliers.length > 0
                                                        ? `Suppliers: ${linkedSuppliers.map((s) => s.name).join(", ")}`
                                                        : "No active supplier linked"}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            {canManage &&
                                            optionsReady &&
                                            primarySupplier &&
                                            optionItem?.isActive ? (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={isBusy}
                                                    onClick={() =>
                                                        onPrepareRequisition({
                                                            supplierId: primarySupplier.supplierId,
                                                            notes: `Low-stock replenishment for ${item.itemSku} (${item.itemName})`,
                                                            lines: [
                                                                {
                                                                    itemId: item.itemId,
                                                                    uomId: null,
                                                                    qtyOrdered: "",
                                                                    unitPrice: "",
                                                                },
                                                            ],
                                                        })
                                                    }
                                                >
                                                    <ShoppingCart className="size-3.5" />
                                                    Create Replenishment PO
                                                </Button>
                                            ) : optionsReady && linkedSuppliers.length === 0 ? (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    render={<Link href="/suppliers" />}
                                                    nativeButton={false}
                                                >
                                                    Link supplier
                                                    <ArrowUpRight className="size-3.5" />
                                                </Button>
                                            ) : null}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
