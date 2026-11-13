import { z } from "zod"
export const KINDS = ["Count", "Scrap", "Disposition", "QC", "Formula"] as const
export type ControlKind = (typeof KINDS)[number]
export const LABELS: Record<ControlKind, string> = {
    Count: "Count Sessions",
    Scrap: "Scrap & Disposal",
    Disposition: "Stock Dispositions",
    QC: "QC Decisions",
    Formula: "Formula Revisions",
}
const id = z.int().positive(),
    text = z.string(),
    nullable = text.nullable(),
    qty = text.regex(/^\d{1,10}(?:\.\d{1,4})?$/),
    positive = qty.refine((v) => /[1-9]/.test(v), "Quantity must be positive.")
export const controlSchema = z.object({
    requestId: id,
    requestNumber: text,
    kind: z.enum(KINDS),
    status: z.enum(["Draft", "Submitted", "Approved", "Rejected", "Cancelled"]),
    notes: text,
    evidenceReference: nullable,
    createdBy: id,
    submittedBy: id.nullable(),
    reviewedBy: id.nullable(),
    submittedAt: nullable,
    reviewedAt: nullable,
    reviewNote: nullable,
    createdAt: text,
    updatedAt: text,
})
export const detailSchema = controlSchema.extend({
    count: z.object({ locationId: id, reasonId: id }).nullable(),
    disposal: z
        .object({
            lotId: id,
            sourceLocationId: id,
            destinationLocationId: id.nullable(),
            reasonId: id,
            quantity: qty,
            expectedQty: qty,
        })
        .nullable(),
    qc: z.object({ lotId: id, previousStatus: text, newStatus: text }).nullable(),
    formula: z
        .object({
            itemId: id,
            revisionNumber: id,
            effectiveDate: text,
            changeType: z.enum(["Replace", "Retire"]),
        })
        .nullable(),
    observations: z.array(
        z.object({
            observationId: id,
            lotId: id,
            lotNumber: text,
            itemName: text,
            sku: text,
            primaryUomName: text,
            expectedQty: qty,
            countedQty: qty.nullable(),
            observedBy: id.nullable(),
            observedAt: nullable,
        }),
    ),
    materials: z.array(
        z.object({
            materialId: id,
            componentItemId: id,
            sku: text,
            itemName: text,
            quantity: text,
            uomId: id,
            uomName: text,
        }),
    ),
    events: z.array(
        z.object({
            eventId: id,
            action: text,
            note: text,
            actorId: id,
            createdAt: text,
            details: z.record(text, z.unknown()),
        }),
    ),
})
export const controlOptionsSchema = z.object({
    items: z.array(
        z.object({
            itemId: id,
            sku: text,
            name: text,
            itemType: text,
            isActive: z.boolean(),
            primaryUomId: id,
            primaryUomName: text,
            uomClassId: id,
        }),
    ),
    lots: z.array(
        z.object({
            lotId: id,
            lotNumber: text,
            itemId: id,
            qcStatus: text,
            expirationDate: nullable,
        }),
    ),
    locations: z.array(
        z.object({ locationId: id, name: text, locationType: text, isActive: z.boolean() }),
    ),
    uoms: z.array(z.object({ uomId: id, name: text, uomClassId: id })),
    reasons: z.array(
        z.object({ reasonId: id, codeName: text, category: text, isActive: z.boolean() }),
    ),
    stocks: z.array(z.object({ lotId: id, locationId: id, qtyOnHand: qty })),
})
const common = {
    requestNumber: text.trim().min(1).max(40),
    notes: text.trim().min(3).max(2000),
    evidenceReference: text.trim().max(2000).nullable(),
}
const component = z.object({
    componentItemId: id,
    quantity: text.regex(/^\d{1,8}(?:\.\d{1,6})?$/).refine((v) => /[1-9]/.test(v)),
    uomId: id,
})
export const controlInputSchema = z
    .discriminatedUnion("kind", [
        z.object({
            ...common,
            kind: z.literal("Count"),
            locationId: id,
            reasonId: id,
            lotIds: z.array(id).min(1).max(100),
        }),
        z.object({
            ...common,
            kind: z.literal("Scrap"),
            lotId: id,
            sourceLocationId: id,
            reasonId: id,
            quantity: positive,
            expectedQty: qty,
        }),
        z.object({
            ...common,
            kind: z.literal("Disposition"),
            lotId: id,
            sourceLocationId: id,
            destinationLocationId: id,
            reasonId: id,
            quantity: positive,
            expectedQty: qty,
        }),
        z.object({
            ...common,
            kind: z.literal("QC"),
            lotId: id,
            previousStatus: text,
            newStatus: text,
        }),
        z.object({
            ...common,
            kind: z.literal("Formula"),
            itemId: id,
            effectiveDate: z.iso.date(),
            changeType: z.enum(["Replace", "Retire"]),
            components: z.array(component).max(100),
        }),
    ])
    .superRefine((v, c) => {
        if (v.kind === "QC" && (!v.evidenceReference || v.previousStatus === v.newStatus))
            c.addIssue({ code: "custom", message: "QC requires evidence and a changed status." })
        if (v.kind === "Disposition" && v.sourceLocationId === v.destinationLocationId)
            c.addIssue({ code: "custom", message: "Choose distinct locations." })
        if (v.kind === "Formula" && v.changeType === "Replace" && !v.components.length)
            c.addIssue({ code: "custom", message: "Add at least one component." })
    })
export type Control = z.output<typeof controlSchema>
export type ControlDetail = z.output<typeof detailSchema>
export type ControlOptions = z.output<typeof controlOptionsSchema>
export type ControlInput = z.output<typeof controlInputSchema>
export type ControlAction = "submit" | "approve" | "reject" | "cancel" | "reopen"
