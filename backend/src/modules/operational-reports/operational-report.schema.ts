import { z } from 'zod';
export const operationalReportQuerySchema = z
    .strictObject({
        report: z.enum(['packing', 'purchasing', 'transfers', 'genealogy']),
        lotId: z.string().regex(/^\d+$/).transform(Number).pipe(z.int().positive()).optional(),
        fromDate: z.iso.date().optional(),
        toDate: z.iso.date().optional(),
    })
    .superRefine((q, c) => {
        if (q.fromDate && q.toDate && q.fromDate > q.toDate)
            c.addIssue({
                code: 'custom',
                path: ['toDate'],
                message: 'End date must follow start date.',
            });
        if (q.report === 'genealogy' && (q.fromDate || q.toDate))
            c.addIssue({
                code: 'custom',
                path: ['report'],
                message: 'Genealogy includes the complete lot history.',
            });
    });
export const operationalReportRequestSchema = z.object({ query: operationalReportQuerySchema });
export type OperationalReportQuery = z.output<typeof operationalReportQuerySchema>;
export type ReportSection = {
    title: string;
    columns: { key: string; label: string }[];
    rows: Record<string, string | null>[];
};
