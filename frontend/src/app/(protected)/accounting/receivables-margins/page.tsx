"use client"

import { AccountingReceivablesView } from "@/components/modules/accounting/accounting-receivables-view"
import { AccountingShell } from "@/components/modules/accounting/accounting-shell"

export default function ReceivablesMarginsPage() {
    return (
        <>
            <title>Receivables &amp; Gross Margin | Accounting</title>
            <meta
                name="description"
                content="Customer billing receivables, sales backlog, delivered batch COGS, and gross margin analysis."
            />
            <AccountingShell
                title="Receivables & Gross Margin"
                description="Track customer account profitability, recognized delivery billing, unfulfilled sales backlog, and batch COGS."
            >
                {(overview) => <AccountingReceivablesView overview={overview} />}
            </AccountingShell>
        </>
    )
}
