"use client"
import { PageHeader } from "@/components/shared/page-header"
import { RecordTable } from "@/components/shared/record-table"
import { ReportFilters } from "@/components/modules/operational-reports/operational-report-filters"
import { useOperationalReports } from "@/hooks/modules/operational-reports/use-operational-reports"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
export default function Page() {
    const f = useOperationalReports("genealogy")
    return (
        <>
            <title>Lot Genealogy</title>
            <PageHeader
                title="Lot Genealogy"
                description="Operational records with exact quantities, source references and separate units."
                actions={
                    <Button variant="outline" onClick={f.refresh} disabled={f.busy}>
                        Refresh report
                    </Button>
                }
            />
            <ReportFilters
                kind="genealogy"
                filters={f.filters}
                lots={f.options?.lots ?? []}
                busy={f.busy}
                onApply={f.setFilters}
            />
            {f.error && (
                <p role="alert" className="text-destructive">
                    {f.error.message}
                    <Button onClick={f.refresh}>Retry</Button>
                </p>
            )}
            {f.loadStatus === "loading" && <Skeleton className="h-64" />}
            {f.loadStatus === "signed-out" && <p>Sign in to view reports.</p>}
            {f.report && (
                <>
                    <p className="text-xs text-muted-foreground">
                        Generated {f.report.generatedAt} ? Monetary values in{" "}
                        {f.report.currencyCode}. Date filters use order creation/request dates.
                        Quantities retain the displayed UOM.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-3">
                        {f.report.sections.map((s) => (
                            <div key={s.title} className="rounded-xl border bg-card p-5">
                                <p className="text-sm text-muted-foreground">{s.title}</p>
                                <p className="text-3xl font-semibold">{s.rows.length}</p>
                            </div>
                        ))}
                    </div>
                    {f.report.sections.map((s) => (
                        <section className="space-y-3" key={s.title}>
                            <h2 className="text-lg font-semibold">{s.title}</h2>
                            <RecordTable
                                key={JSON.stringify(f.filters)}
                                name={"genealogy-" + s.title}
                                rows={s.rows.map((r, i) => ({ ...r, rowKey: String(i) }))}
                                id={(r) => r.rowKey!}
                                columns={s.columns.map((c) => ({
                                    ...c,
                                    value: (r: Record<string, string | null>) => r[c.key] ?? "",
                                }))}
                            />
                        </section>
                    ))}
                </>
            )}
        </>
    )
}
