import { z } from 'zod';

export const reportTypes = [
    'stock-by-location',
    'stock-by-lot',
    'low-stock',
    'near-expiry',
    'movement',
] as const;
const id = z.string().regex(/^\d+$/).transform(Number).pipe(z.int().positive().max(2_147_483_647));
export const inventoryReportQuerySchema = z
    .strictObject({
        report: z.enum(reportTypes).default('stock-by-location'),
        itemId: id.optional(),
        locationId: id.optional(),
        labelItemId: id.optional(),
        itemType: z
            .enum([
                'Raw Material - Bulk',
                'Packaging - Hardware',
                'Packaging - Label',
                'Finished Good',
            ])
            .optional(),
        qcStatus: z.enum(['Quarantine', 'Approved', 'Rejected', 'Expired']).optional(),
        q: z.string().trim().max(200).optional(),
        threshold: z
            .string()
            .regex(
                /^\d{1,10}(?:\.\d{1,4})?$/,
                'Use a nonnegative threshold with up to four decimal places.',
            )
            .optional(),
        expiryDays: z
            .string()
            .regex(/^\d+$/)
            .transform(Number)
            .pipe(z.int().min(0).max(3650))
            .optional(),
        includeExpired: z
            .enum(['true', 'false'])
            .transform((value) => value === 'true')
            .default(true),
        fromDate: z.iso.date().optional(),
        toDate: z.iso.date().optional(),
        transactionType: z
            .enum(['Receive', 'Consume', 'Produce', 'Transfer', 'Scrap', 'Adjustment', 'Sale'])
            .optional(),
    })
    .transform((input) => ({
        ...input,
        threshold: input.threshold ?? '10',
        expiryDays: input.expiryDays ?? 30,
        useReorderPolicies: input.threshold === undefined,
        useCompanyExpiryDays: input.expiryDays === undefined,
    }))
    .superRefine((input, context) => {
        if (input.fromDate && input.toDate && input.fromDate > input.toDate)
            context.addIssue({
                code: 'custom',
                path: ['toDate'],
                message: 'End date must be on or after start date.',
            });
        if (
            input.report !== 'movement' &&
            (input.fromDate || input.toDate || input.transactionType)
        )
            context.addIssue({
                code: 'custom',
                path: ['report'],
                message: 'Date ranges and movement types apply to Inventory Movement only.',
            });
        if (input.report === 'movement' && input.qcStatus)
            context.addIssue({
                code: 'custom',
                path: ['qcStatus'],
                message: 'QC filtering applies to current stock reports only.',
            });
    });
export const inventoryReportRequestSchema = z.object({ query: inventoryReportQuerySchema });
export type InventoryReportQuery = z.output<typeof inventoryReportQuerySchema>;
export type ReportType = (typeof reportTypes)[number];

export type ReportItem = {
    itemId: number;
    sku: string;
    itemName: string;
    itemType: import('../../db/schema.ts').Item['itemType'];
    labelItemId: number | null;
    labelItemName: string | null;
    primaryUomId: number;
    primaryUomName: string;
    isActive: boolean;
};
export type ReportStock = ReportItem & {
    stockId: number;
    locationIsActive?: boolean;
    lotId: number;
    lotNumber: string;
    qcStatus: string;
    expirationDate: string | null;
    locationId: number;
    locationCode: string;
    locationName: string;
    locationType: string;
    qtyOnHand: string;
    qtyReserved: string;
    qtyAvailable: string;
    sourceReference: string | null;
};
export type ReportMovement = ReportItem & {
    transactionId: number;
    transactionType: string;
    qtyChange: string;
    occurredAt: Date;
    lotId: number;
    lotNumber: string;
    locationId: number;
    locationCode: string;
    locationName: string;
    locationType: string;
    sourceReference: string | null;
    referenceId: string | null;
    actorName: string;
    reasonCode: string | null;
};
export type InventoryReportRow = ReportItem & {
    rowId: string;
    reorderLevel?: string;
    locationId: number | null;
    locationCode: string | null;
    locationName: string | null;
    locationType: string | null;
    lotId: number | null;
    lotNumber: string | null;
    lotCount: number;
    qcStatus: string | null;
    expirationDate: string | null;
    daysToExpiry: number | null;
    qtyOnHand: string | null;
    qtyReserved: string | null;
    qtyAvailable: string | null;
    transactionId: number | null;
    transactionType: string | null;
    qtyChange: string | null;
    occurredAt: Date | null;
    sourceReference: string | null;
    referenceId: string | null;
    actorName: string | null;
    reasonCode: string | null;
};
