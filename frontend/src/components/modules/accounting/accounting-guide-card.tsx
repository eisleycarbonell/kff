"use client"

import { useState } from "react"
import { BookOpen, ChevronDown, ChevronUp, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const STEPS = [
    {
        step: "1 · Buying Stock",
        title: "Supplier orders become bills when received",
        detail: "When goods arrive from a supplier, the agreed Ex-VAT price sets the unit cost of that batch and counts toward Supplier Bills in Expenses & Bills.",
    },
    {
        step: "2 · Packing Products",
        title: "Spices, containers & labels add up automatically",
        detail: "When a packing run completes, the cost of all spices, pouches/jars, and labels used is divided by the finished packs produced to find the unit cost.",
    },
    {
        step: "3 · Selling & Invoices",
        title: "Sales & Invoices count once deliveries finish",
        detail: "Pending customer orders stay in Pending Orders until delivery completes. Delivered orders appear under Billed Sales & Invoices with customer totals and printable invoice summaries.",
    },
    {
        step: "4 · Profit & Tax",
        title: "Total Sales minus Total Expenses equals Net Profit",
        detail: "Net Profit subtracts the cost of products delivered plus any scrap or count losses from Total Sales. VAT on purchases and sales is tracked separately for tax reporting.",
    },
] as const

const TERMS = [
    {
        term: "Total Sales",
        meaning: "Revenue earned from completed customer deliveries (excluding VAT).",
    },
    {
        term: "Total Expenses",
        meaning: "Product cost of delivered goods plus scrap losses and count adjustments.",
    },
    {
        term: "Supplier Bills",
        meaning: "Amount owed for supplier purchase orders already received into stock.",
    },
    {
        term: "Stock Value",
        meaning: "What all current raw spices, packaging, and finished packs on hand are worth.",
    },
] as const

export function AccountingGuideCard() {
    const [open, setOpen] = useState(false)

    return (
        <Card className="border shadow-xs">
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <BookOpen className="size-4 shrink-0 text-primary" />
                        <CardTitle className="text-base font-semibold">
                            How Simple Accounting Works
                        </CardTitle>
                        <Badge variant="secondary" className="text-[10px]">
                            Quick Guide
                        </Badge>
                    </div>
                    <CardDescription className="text-xs">
                        A plain-language walkthrough of how buying, packing, selling, and expenses connect.
                    </CardDescription>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 self-start text-xs sm:self-auto"
                    onClick={() => setOpen((current) => !current)}
                    aria-expanded={open}
                >
                    {open ? (
                        <>
                            Hide guide
                            <ChevronUp className="size-3.5" />
                        </>
                    ) : (
                        <>
                            Show guide
                            <ChevronDown className="size-3.5" />
                        </>
                    )}
                </Button>
            </CardHeader>

            {open && (
                <CardContent className="space-y-4 pt-1">
                    <div className="grid gap-3 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
                        {STEPS.map((item) => (
                            <div
                                key={item.step}
                                className="rounded-xl border border-border/60 bg-muted/20 p-3.5"
                            >
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                                    {item.step}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-foreground">
                                    {item.title}
                                </p>
                                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                                    {item.detail}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-xl border border-border/60 bg-card p-3.5">
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                            <Info className="size-3.5 text-primary" />
                            Key Terms
                        </div>
                        <div className="grid gap-2.5 @lg/main:grid-cols-2 @4xl/main:grid-cols-4">
                            {TERMS.map((item) => (
                                <div key={item.term} className="text-xs">
                                    <span className="font-semibold text-foreground">{item.term}: </span>
                                    <span className="text-muted-foreground">{item.meaning}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
    )
}
