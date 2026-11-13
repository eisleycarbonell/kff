import { z } from "zod"
export const reportKinds = ["packing", "purchasing", "transfers", "genealogy"] as const
export type ReportKind = (typeof reportKinds)[number]
export const reportSchema = z.object({
    report: z.enum(reportKinds),
    generatedAt: z.string(),
    currencyCode: z.string(),
    sections: z.array(
        z.object({
            title: z.string(),
            columns: z.array(z.object({ key: z.string(), label: z.string() })),
            rows: z.array(z.record(z.string(), z.string().nullable())),
        }),
    ),
})
export const optionsSchema = z.object({
    lots: z.array(z.object({ lotId: z.int().positive(), lotNumber: z.string() })),
})
export type Filters = { fromDate: string; toDate: string; lotId: string }
