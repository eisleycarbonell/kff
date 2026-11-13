"use client"
import Link from "next/link"
import { usePackingFormulas } from "@/hooks/modules/packing-formulas/use-packing-formulas"
import { PackingFormulaStatistics } from "@/components/modules/packing-formulas/packing-formula-statistics"
import { PageHeader } from "@/components/shared/page-header"
import { RecordTable } from "@/components/shared/record-table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
export default function Page() {
    const f = usePackingFormulas()
    const rows = f.formulas.flatMap((product) =>
        product.components.map((c) => ({ product, component: c })),
    )
    return (
        <>
            <title>Packing Formulas</title>
            <PageHeader
                title="Packing Formulas"
                description="Current published material requirements per finished-product primary unit."
                actions={
                    <Button render={<Link href="/formula-revisions" />} nativeButton={false}>
                        Formula revisions
                    </Button>
                }
            />
            <p className="text-sm text-muted-foreground">
                Prepare and release changes through Formula Revisions. Existing definitions are a
                legacy published baseline until replaced; historical packing orders keep their own
                material snapshot.
            </p>
            {f.loading && <Skeleton className="h-64" />}
            {f.error && (
                <p role="alert">
                    {f.error.message}
                    <Button onClick={f.retry}>Retry</Button>
                </p>
            )}
            <PackingFormulaStatistics formulas={f.formulas} />
            <RecordTable
                name="published-formulas"
                rows={rows}
                id={(r) => r.product.itemId + ":" + r.component.componentItemId}
                columns={[
                    {
                        key: "revision",
                        label: "Released revision request",
                        value: (r) =>
                            r.product.revisionId ? String(r.product.revisionId) : "Legacy baseline",
                    },
                    {
                        key: "product",
                        label: "Finished product",
                        value: (r) => r.product.itemSku + " ? " + r.product.itemName,
                    },
                    {
                        key: "component",
                        label: "Component",
                        value: (r) => r.component.componentSku + " ? " + r.component.componentName,
                    },
                    {
                        key: "quantity",
                        label: "Quantity per product unit",
                        value: (r) => r.component.quantity + " " + r.component.uomName,
                    },
                ]}
            />
        </>
    )
}
