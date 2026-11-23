import type {
    AccountingOverview,
    AccountingPurchasingCosting,
    AccountingSalesCosting,
    ITEM_TYPES,
} from "@/components/modules/accounting/accounting.schema"

const DECIMAL_SCALE = BigInt(10_000)

export function scaled4(value: string | number | null | undefined): bigint {
    if (value === null || value === undefined) return BigInt(0)
    const text = String(value).trim()
    if (!/^-?\d+(?:\.\d+)?$/.test(text)) return BigInt(0)
    const negative = text.startsWith("-")
    const unsigned = negative ? text.slice(1) : text
    const [whole, fraction = ""] = unsigned.split(".")
    const padded = fraction.padEnd(5, "0")
    let units = BigInt(whole) * DECIMAL_SCALE + BigInt(padded.slice(0, 4))
    if (padded[4] >= "5") {
        units += BigInt(1)
    }
    return negative ? -units : units
}

export function formatScaled4(units: bigint): string {
    const negative = units < BigInt(0)
    const abs = negative ? -units : units
    const whole = abs / DECIMAL_SCALE
    const fraction = (abs % DECIMAL_SCALE).toString().padStart(4, "0")
    return `${negative ? "-" : ""}${whole}.${fraction}`
}

export function absUnits(units: bigint): bigint {
    return units < BigInt(0) ? -units : units
}

export function percentString(partUnits: bigint, totalUnits: bigint): string | null {
    if (totalUnits <= BigInt(0)) return null
    const half = totalUnits / BigInt(2)
    const basisPoints =
        partUnits >= BigInt(0)
            ? (partUnits * DECIMAL_SCALE + half) / totalUnits
            : -((-partUnits * DECIMAL_SCALE + half) / totalUnits)
    const negative = basisPoints < BigInt(0)
    const abs = negative ? -basisPoints : basisPoints
    const whole = abs / BigInt(100)
    const frac = (abs % BigInt(100)).toString().padStart(2, "0")
    return `${negative ? "-" : ""}${whole}.${frac}`
}

export type AccountType = "Asset" | "Liability" | "Equity" | "Revenue" | "Expense"

export type TrialBalanceRow = {
    accountCode: string
    accountName: string
    accountType: AccountType
    normalBalance: "Debit" | "Credit"
    debit: string
    credit: string
    netBalance: string
    sourceNote: string
}

export type TrialBalanceReport = {
    accounts: TrialBalanceRow[]
    totalDebits: string
    totalCredits: string
    difference: string
    isBalanced: boolean
}

export type AccountingJournalEntry = {
    journalNumber: string
    transactionId: number
    createdAt: string
    transactionType: string
    referenceId: string | null
    itemSku: string
    itemName: string
    lotNumber: string
    locationName: string
    qtyChange: string
    primaryUomName: string
    effectiveUnitCost: string
    costBasis: string
    debitAccountCode: string
    debitAccountName: string
    creditAccountCode: string
    creditAccountName: string
    amount: string
    signedImpact: string
    authorizedByName: string
    memo: string
}

export type IncomeStatementReport = {
    bookedSales: string
    unfulfilledBacklog: string
    recognizedRevenue: string
    deliveredCogs: string
    grossProfit: string
    grossMarginPercent: string | null
    scrapLoss: string
    adjustmentVarianceNet: string
    netOperatingIncome: string
    netOperatingMarginPercent: string | null
    inventoryAssetValue: string
    accruedSupplierPayable: string
    openPoCommitments: string
}

export type CustomerReceivableSummary = {
    customerName: string
    orderCount: number
    bookedRevenue: string
    deliveredRevenue: string
    backlogRevenue: string
    deliveredCogs: string
    grossProfit: string
    grossMarginPercent: string | null
    deliveryCount: number
    completedDeliveryCount: number
}

export type SupplierPayableSummary = {
    supplierName: string
    poCount: number
    lineCount: number
    totalCommitted: string
    receivedPayable: string
    outstandingCommitment: string
    receivedPercent: string | null
}

function inventoryAccountForType(
    itemType?: (typeof ITEM_TYPES)[number],
): { code: string; name: string } {
    if (itemType === "Raw Material - Bulk") {
        return { code: "1210", name: "Raw Materials Inventory" }
    }
    if (itemType === "Packaging - Hardware" || itemType === "Packaging - Label") {
        return { code: "1220", name: "Packaging & Labels Inventory" }
    }
    if (itemType === "Finished Good") {
        return { code: "1230", name: "Finished Goods Inventory" }
    }
    return { code: "1200", name: "Inventory Stock Asset" }
}

/** Build a balanced General Ledger Trial Balance from operational inventory, purchasing, and sales roll-ups. */
export function computeTrialBalance(overview: AccountingOverview): TrialBalanceReport {
    const s = overview.summary

    const rawInv = scaled4(s.rawMaterialAssetValue)
    const pkgInv = scaled4(s.packagingAssetValue)
    const fgInv = scaled4(s.finishedGoodsAssetValue)
    const arBilling = scaled4(s.totalDeliveredBilling ?? s.totalDeliveredRevenue)
    const inputVat = scaled4(s.totalInputVat ?? "0")
    const apGrni = scaled4(s.purchaseReceivedValue)
    const outputVat = scaled4(s.totalOutputVat ?? "0")
    const salesRev = scaled4(s.totalDeliveredRevenue)
    const cogs = scaled4(s.totalDeliveredCogs)
    const scrap = scaled4(s.scrapLossValue)
    const adjNet = scaled4(s.adjustmentNetValue)

    const makeDebitCredit = (
        signedDebitPosition: bigint,
    ): { debit: bigint; credit: bigint; net: bigint } => {
        if (signedDebitPosition >= BigInt(0)) {
            return { debit: signedDebitPosition, credit: BigInt(0), net: signedDebitPosition }
        }
        return { debit: BigInt(0), credit: -signedDebitPosition, net: signedDebitPosition }
    }

    const rawDc = makeDebitCredit(rawInv)
    const pkgDc = makeDebitCredit(pkgInv)
    const fgDc = makeDebitCredit(fgInv)
    const arDc = makeDebitCredit(arBilling)
    const inputVatDc = makeDebitCredit(inputVat)
    const apDc = makeDebitCredit(-apGrni)
    const outputVatDc = makeDebitCredit(-outputVat)
    const revDc = makeDebitCredit(-salesRev)
    const cogsDc = makeDebitCredit(cogs)
    const scrapDc = makeDebitCredit(scrap)
    // Negative stock adjustment reduces inventory and records an expense debit; positive adjustment is a gain credit.
    const adjDc = makeDebitCredit(-adjNet)

    const netPreEquity =
        rawInv +
        pkgInv +
        fgInv +
        arBilling +
        inputVat -
        apGrni -
        outputVat -
        salesRev +
        cogs +
        scrap -
        adjNet
    const equityDc = makeDebitCredit(-netPreEquity)

    const specs: Array<{
        code: string
        name: string
        type: AccountType
        normal: "Debit" | "Credit"
        dc: { debit: bigint; credit: bigint; net: bigint }
        sourceNote: string
    }> = [
        {
            code: "1100",
            name: "Trade Receivables & Delivered Billing",
            type: "Asset",
            normal: "Debit",
            dc: arDc,
            sourceNote: "Completed customer deliveries (Net Revenue + Output VAT)",
        },
        {
            code: "1150",
            name: "Input VAT Receivable",
            type: "Asset",
            normal: "Debit",
            dc: inputVatDc,
            sourceNote: "Creditable Input VAT from received VATable purchase order lines",
        },
        {
            code: "1210",
            name: "Raw Materials Inventory",
            type: "Asset",
            normal: "Debit",
            dc: rawDc,
            sourceNote: "On-hand bulk spice lots (Ex-VAT cost)",
        },
        {
            code: "1220",
            name: "Packaging & Labels Inventory",
            type: "Asset",
            normal: "Debit",
            dc: pkgDc,
            sourceNote: "Hardware containers and labels (Ex-VAT cost)",
        },
        {
            code: "1230",
            name: "Finished Goods Inventory",
            type: "Asset",
            normal: "Debit",
            dc: fgDc,
            sourceNote: "Packed finished products on hand",
        },
        {
            code: "2100",
            name: "Accounts Payable — Goods Received (GRNI)",
            type: "Liability",
            normal: "Credit",
            dc: apDc,
            sourceNote: "Gross supplier PO receipts (Net inventory + Input VAT)",
        },
        {
            code: "2200",
            name: "Output VAT Payable",
            type: "Liability",
            normal: "Credit",
            dc: outputVatDc,
            sourceNote: "Output VAT collected on delivered VATable customer sales",
        },
        {
            code: "3100",
            name: "Inventory Capital & Clearing Equity",
            type: "Equity",
            normal: "Credit",
            dc: equityDc,
            sourceNote: "Opening stock equity and inter-period cost clearing",
        },
        {
            code: "4100",
            name: "Sales Revenue — Delivered Orders",
            type: "Revenue",
            normal: "Credit",
            dc: revDc,
            sourceNote: "Recognized revenue on completed deliveries",
        },
        {
            code: "5100",
            name: "Cost of Goods Sold (Batch COGS)",
            type: "Expense",
            normal: "Debit",
            dc: cogsDc,
            sourceNote: "Specific batch cost of delivered goods",
        },
        {
            code: "6100",
            name: "Inventory Shrinkage & Scrap Loss",
            type: "Expense",
            normal: "Debit",
            dc: scrapDc,
            sourceNote: "Approved scrap & disposal write-offs",
        },
        {
            code: "6150",
            name: "Physical Count Adjustment Variance",
            type: "Expense",
            normal: "Debit",
            dc: adjDc,
            sourceNote: "Net count variances from stock adjustments",
        },
    ]

    let totalDebitUnits = BigInt(0)
    let totalCreditUnits = BigInt(0)
    const accounts: TrialBalanceRow[] = specs.map((spec) => {
        totalDebitUnits += spec.dc.debit
        totalCreditUnits += spec.dc.credit
        return {
            accountCode: spec.code,
            accountName: spec.name,
            accountType: spec.type,
            normalBalance: spec.normal,
            debit: formatScaled4(spec.dc.debit),
            credit: formatScaled4(spec.dc.credit),
            netBalance: formatScaled4(spec.dc.net),
            sourceNote: spec.sourceNote,
        }
    })

    const diffUnits = totalDebitUnits - totalCreditUnits
    return {
        accounts,
        totalDebits: formatScaled4(totalDebitUnits),
        totalCredits: formatScaled4(totalCreditUnits),
        difference: formatScaled4(diffUnits),
        isBalanced: diffUnits === BigInt(0),
    }
}

/** Map inventory cost ledger events into explicit double-entry debit/credit journal rows. */
export function computeJournalEntries(overview: AccountingOverview): AccountingJournalEntry[] {
    const lotTypeMap = new Map<string, (typeof ITEM_TYPES)[number]>(
        overview.lotCosting.map((lot) => [lot.lotNumber.trim().toUpperCase(), lot.itemType]),
    )

    return overview.costLedger.map((entry) => {
        const inv = inventoryAccountForType(lotTypeMap.get(entry.lotNumber.trim().toUpperCase()))
        const qtyUnits = scaled4(entry.qtyChange)
        const amountUnits = absUnits(scaled4(entry.totalCostImpact))

        let debit = inv
        let credit = { code: "3100", name: "Inventory Capital & Clearing Equity" }
        let memo = `${entry.transactionType} at ${entry.locationName}`

        switch (entry.transactionType) {
            case "Receive":
                debit = inv
                credit = { code: "2100", name: "Accounts Payable — Goods Received (GRNI)" }
                memo = `PO receipt into ${entry.locationName}`
                break
            case "Consume":
                debit = { code: "1250", name: "Work-in-Process — Packing Control" }
                credit = inv
                memo = `Material consumed for packing at ${entry.locationName}`
                break
            case "Produce":
                debit = { code: "1230", name: "Finished Goods Inventory" }
                credit = { code: "1250", name: "Work-in-Process — Packing Control" }
                memo = `Finished lot produced into ${entry.locationName}`
                break
            case "Sale":
                debit = { code: "5100", name: "Cost of Goods Sold (Batch COGS)" }
                credit = { code: "1230", name: "Finished Goods Inventory" }
                memo = `Customer delivery COGS from ${entry.locationName}`
                break
            case "Transfer":
                if (qtyUnits >= BigInt(0)) {
                    debit = inv
                    credit = { code: "1240", name: "Stock-in-Transit Clearing" }
                    memo = `Transfer arrival at ${entry.locationName}`
                } else {
                    debit = { code: "1240", name: "Stock-in-Transit Clearing" }
                    credit = inv
                    memo = `Transfer dispatch from ${entry.locationName}`
                }
                break
            case "Scrap":
                debit = { code: "6100", name: "Inventory Shrinkage & Scrap Loss" }
                credit = inv
                memo = `Scrap write-off from ${entry.locationName}`
                break
            case "Adjustment":
                if (qtyUnits >= BigInt(0)) {
                    debit = inv
                    credit = { code: "6150", name: "Physical Count Adjustment Variance" }
                    memo = `Positive count gain at ${entry.locationName}`
                } else {
                    debit = { code: "6150", name: "Physical Count Adjustment Variance" }
                    credit = inv
                    memo = `Negative count write-down at ${entry.locationName}`
                }
                break
            default:
                break
        }

        return {
            journalNumber: `JE-${String(entry.transactionId).padStart(5, "0")}`,
            transactionId: entry.transactionId,
            createdAt: entry.createdAt,
            transactionType: entry.transactionType,
            referenceId: entry.referenceId,
            itemSku: entry.itemSku,
            itemName: entry.itemName,
            lotNumber: entry.lotNumber,
            locationName: entry.locationName,
            qtyChange: entry.qtyChange,
            primaryUomName: entry.primaryUomName,
            effectiveUnitCost: entry.effectiveUnitCost,
            costBasis: entry.costBasis,
            debitAccountCode: debit.code,
            debitAccountName: debit.name,
            creditAccountCode: credit.code,
            creditAccountName: credit.name,
            amount: formatScaled4(amountUnits),
            signedImpact: entry.totalCostImpact,
            authorizedByName: entry.authorizedByName,
            memo,
        }
    })
}

/** Build the Income Statement (P&L) and Working Capital position from overview metrics. */
export function computeIncomeStatement(overview: AccountingOverview): IncomeStatementReport {
    const s = overview.summary
    const bookedUnits = scaled4(s.totalBookedRevenue)
    const deliveredRevUnits = scaled4(s.totalDeliveredRevenue)
    const backlogUnits = bookedUnits > deliveredRevUnits ? bookedUnits - deliveredRevUnits : BigInt(0)
    const cogsUnits = scaled4(s.totalDeliveredCogs)
    const grossProfitUnits = deliveredRevUnits - cogsUnits
    const scrapLossUnits = scaled4(s.scrapLossValue)
    const adjNetUnits = scaled4(s.adjustmentNetValue)
    const netOperatingUnits = grossProfitUnits - scrapLossUnits + adjNetUnits

    return {
        bookedSales: formatScaled4(bookedUnits),
        unfulfilledBacklog: formatScaled4(backlogUnits),
        recognizedRevenue: formatScaled4(deliveredRevUnits),
        deliveredCogs: formatScaled4(cogsUnits),
        grossProfit: formatScaled4(grossProfitUnits),
        grossMarginPercent: percentString(grossProfitUnits, deliveredRevUnits),
        scrapLoss: formatScaled4(scrapLossUnits),
        adjustmentVarianceNet: formatScaled4(adjNetUnits),
        netOperatingIncome: formatScaled4(netOperatingUnits),
        netOperatingMarginPercent: percentString(netOperatingUnits, deliveredRevUnits),
        inventoryAssetValue: s.totalInventoryAssetValue,
        accruedSupplierPayable: s.purchaseReceivedValue,
        openPoCommitments: s.purchaseOutstandingValue,
    }
}

/** Aggregate non-cancelled sales orders by customer for Accounts Receivable & Margin review. */
export function computeCustomerReceivables(
    rows: AccountingSalesCosting[],
): CustomerReceivableSummary[] {
    const map = new Map<
        string,
        {
            customerName: string
            orderCount: number
            bookedUnits: bigint
            deliveredRevUnits: bigint
            deliveredCogsUnits: bigint
            deliveryCount: number
            completedDeliveryCount: number
        }
    >()

    for (const row of rows) {
        if (row.status === "Cancelled") continue
        const key = row.customerName.trim().toLowerCase()
        const bucket = map.get(key) ?? {
            customerName: row.customerName,
            orderCount: 0,
            bookedUnits: BigInt(0),
            deliveredRevUnits: BigInt(0),
            deliveredCogsUnits: BigInt(0),
            deliveryCount: 0,
            completedDeliveryCount: 0,
        }
        bucket.orderCount += 1
        bucket.bookedUnits += scaled4(row.bookedRevenue)
        bucket.deliveredRevUnits += scaled4(row.deliveredRevenue)
        bucket.deliveredCogsUnits += scaled4(row.deliveredCogs)
        bucket.deliveryCount += row.deliveryCount
        bucket.completedDeliveryCount += row.completedDeliveryCount
        map.set(key, bucket)
    }

    return [...map.values()]
        .sort((a, b) =>
            b.bookedUnits === a.bookedUnits
                ? a.customerName.localeCompare(b.customerName)
                : b.bookedUnits > a.bookedUnits
                  ? 1
                  : -1,
        )
        .map((bucket) => {
            const backlogUnits =
                bucket.bookedUnits > bucket.deliveredRevUnits
                    ? bucket.bookedUnits - bucket.deliveredRevUnits
                    : BigInt(0)
            const profitUnits = bucket.deliveredRevUnits - bucket.deliveredCogsUnits
            return {
                customerName: bucket.customerName,
                orderCount: bucket.orderCount,
                bookedRevenue: formatScaled4(bucket.bookedUnits),
                deliveredRevenue: formatScaled4(bucket.deliveredRevUnits),
                backlogRevenue: formatScaled4(backlogUnits),
                deliveredCogs: formatScaled4(bucket.deliveredCogsUnits),
                grossProfit: formatScaled4(profitUnits),
                grossMarginPercent: percentString(profitUnits, bucket.deliveredRevUnits),
                deliveryCount: bucket.deliveryCount,
                completedDeliveryCount: bucket.completedDeliveryCount,
            }
        })
}

/** Aggregate non-cancelled purchase orders by supplier for AP & Commitment tracking. */
export function computeSupplierPayables(
    rows: AccountingPurchasingCosting[],
): SupplierPayableSummary[] {
    const map = new Map<
        string,
        {
            supplierName: string
            poCount: number
            lineCount: number
            committedUnits: bigint
            receivedUnits: bigint
            outstandingUnits: bigint
        }
    >()

    for (const row of rows) {
        if (row.status === "Cancelled") continue
        const key = row.supplierName.trim().toLowerCase()
        const bucket = map.get(key) ?? {
            supplierName: row.supplierName,
            poCount: 0,
            lineCount: 0,
            committedUnits: BigInt(0),
            receivedUnits: BigInt(0),
            outstandingUnits: BigInt(0),
        }
        bucket.poCount += 1
        bucket.lineCount += row.lineCount
        bucket.committedUnits += scaled4(row.totalAmount)
        bucket.receivedUnits += scaled4(row.receivedAmount)
        bucket.outstandingUnits += scaled4(row.outstandingAmount)
        map.set(key, bucket)
    }

    return [...map.values()]
        .sort((a, b) =>
            b.committedUnits === a.committedUnits
                ? a.supplierName.localeCompare(b.supplierName)
                : b.committedUnits > a.committedUnits
                  ? 1
                  : -1,
        )
        .map((bucket) => ({
            supplierName: bucket.supplierName,
            poCount: bucket.poCount,
            lineCount: bucket.lineCount,
            totalCommitted: formatScaled4(bucket.committedUnits),
            receivedPayable: formatScaled4(bucket.receivedUnits),
            outstandingCommitment: formatScaled4(bucket.outstandingUnits),
            receivedPercent: percentString(bucket.receivedUnits, bucket.committedUnits),
        }))
}
