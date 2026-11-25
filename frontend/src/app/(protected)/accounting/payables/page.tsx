"use client"

import { AccountingPayablesView } from "@/components/modules/accounting/accounting-payables-view"
import { AccountingShell } from "@/components/modules/accounting/accounting-shell"

export default function PayablesPage() {
    return (
        <>
            <title>Expenses &amp; Bills | Accounting Portal</title>
            <meta
                name="description"
                content="Track total operating expenses, supplier bills for received goods, open purchase orders, and stock losses."
            />
            <AccountingShell
                title="Expenses & Bills"
                description="Track total operating expenses, supplier bills for received goods, open orders, and stock write-offs."
            >
                {(overview) => <AccountingPayablesView overview={overview} />}
            </AccountingShell>
        </>
    )
}
