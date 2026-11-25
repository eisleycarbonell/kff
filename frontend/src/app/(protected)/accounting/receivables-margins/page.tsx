"use client"

import { AccountingReceivablesView } from "@/components/modules/accounting/accounting-receivables-view"
import { AccountingShell } from "@/components/modules/accounting/accounting-shell"

export default function ReceivablesMarginsPage() {
    return (
        <>
            <title>Sales &amp; Invoices | Accounting Portal</title>
            <meta
                name="description"
                content="Track customer sales, pending deliveries, customer profitability, and printable customer invoices."
            />
            <AccountingShell
                title="Sales & Invoices"
                description="Track customer sales, pending deliveries, customer profit, and printable invoice summaries."
            >
                {(overview) => <AccountingReceivablesView overview={overview} />}
            </AccountingShell>
        </>
    )
}
