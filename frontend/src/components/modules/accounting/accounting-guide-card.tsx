"use client"

import { useState } from "react"
import { BookOpen, ChevronDown, ChevronUp, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const STEPS = [
    {
        step: "Step 1 · Buying & Receiving",
        title: "Supplier prices become batch unit costs",
        detail: "When a Purchase Order line is received, the system converts your agreed supplier unit price (including Dollar/Peso conversion) into the item's base unit and locks that cost onto the received batch (lot).",
    },
    {
        step: "Step 2 · Packing & Production",
        title: "Ingredient, pouch & label costs roll up automatically",
        detail: "When a Packing Order completes, every consumed bulk spice, pouch, jar, and label batch cost is summed and divided by the actual finished units produced to compute true Finished Good unit cost.",
    },
    {
        step: "Step 3 · Inventory & Shrinkage",
        title: "Stock on hand is valued per batch across all locations",
        detail: "Inventory Asset Value multiplies each batch's quantity on hand by its actual cost (or Catalog Reference Cost if no batch cost was recorded). Scrap & count adjustments show stock gain/loss impact.",
    },
    {
        step: "Step 4 · Sales & Profit (COGS)",
        title: "Delivered orders show true Gross Profit",
        detail: "When a Customer Delivery finishes, Sales Revenue is compared against the exact cost of the batches shipped (Cost of Goods Sold) to calculate Gross Profit and Margin %.",
    },
    {
        step: "Step 5 · Tax & VAT",
        title: "Mixed VATable & VAT-Exempt Items (Input vs Output VAT)",
        detail: "Items marked VATable pre-fill the Company Settings VAT rate on new PO and Sales Order lines, while VAT-exempt items default to 0%. Purchased inventory asset values (1210/1220) store Ex-VAT unit cost, creditable Input VAT tracks to 1150, customer Output VAT tracks to 2200, and Net VAT Payable equals Output VAT minus Input VAT.",
    },
] as const

const TERMS = [
    {
        term: "Purchase Actual",
        meaning: "Exact cost calculated from the Purchase Order price when the batch was received.",
    },
    {
        term: "Packing Roll-Up",
        meaning: "Finished-product unit cost computed from the raw materials, containers, and labels consumed.",
    },
    {
        term: "Catalog Reference",
        meaning: "Fallback Reference Cost saved on the Item record when a batch has no PO/Packing cost yet.",
    },
    {
        term: "COGS (Cost of Goods Sold)",
        meaning: "The batch cost of finished spices actually delivered to customers.",
    },
] as const

export function AccountingGuideCard() {
    const [open, setOpen] = useState(false)

    return (
        <Card className="border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                        <BookOpen className="size-4 text-primary" />
                        <CardTitle className="text-base font-semibold">
                            How to Use Accounting &amp; How Costing Links Together
                        </CardTitle>
                        <Badge variant="secondary" className="text-[10px]">
                            Plain-Language Guide
                        </Badge>
                    </div>
                    <CardDescription className="text-xs">
                        Follow these four steps to trace money from supplier purchasing through packing and customer profit.
                    </CardDescription>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
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
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                            Simple Costing Terms
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
