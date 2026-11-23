"use client"

import { AccountingPayablesView } from "@/components/modules/accounting/accounting-payables-view"
import { AccountingShell } from "@/components/modules/accounting/accounting-shell"

export default function PayablesPage() {
    return (
        <>
            <title>Payables &amp; PO Commitments | Accounting</title>
            <meta
                name="description"
                content="Supplier Accounts Payable GRNI accruals, purchase order commitments, and open liabilities."
            />
            <AccountingShell
                title="Payables & PO Commitments"
                description="Monitor vendor GRNI liabilities for received goods alongside remaining open supplier purchase commitments."
            >
                {(overview) => <AccountingPayablesView overview={overview} />}
            </AccountingShell>
        </>
    )
}
