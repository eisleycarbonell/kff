import { z } from 'zod';
import {
    and,
    asc,
    desc,
    eq,
    ilike,
    or,
    sql,
    type SQL,
    type SQLWrapper,
    type Subquery,
} from 'drizzle-orm';
import type { PgSelect } from 'drizzle-orm/pg-core';
import { db } from '../db/index.ts';
import { AppError } from '../errors/app-error.ts';

const positiveInteger = z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.int().positive().max(2_147_483_647));
export const listPageFields = {
    page: positiveInteger.optional(),
    pageSize: positiveInteger.pipe(z.number().max(100)).optional(),
    search: z.string().trim().max(160).optional(),
    sortBy: z.string().min(1).max(80).optional(),
    sortDirection: z.enum(['asc', 'desc']).optional(),
};
export const listFilterId = positiveInteger;
export type ListPageQuery = {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
} & Record<string, unknown>;
type Columns = Record<string, SQLWrapper>;
type Expression = (columns: Columns) => SQLWrapper;
export type ListPageConfig = {
    id: string;
    defaultSort: string;
    defaultDirection?: 'asc' | 'desc';
    search: string[];
    numeric?: string[];
    aliases?: Record<string, Expression>;
    filters?: Record<string, Expression>;
    facets?: Record<string, { value: Expression; label: Expression }>;
    counts?: Record<string, (columns: Columns) => SQL>;
    quantities?: string[];
    amounts?: Record<string, (columns: Columns) => SQL>;
};

/** The source contains one row per entity. Counts and summaries apply before LIMIT. */
export async function readListPage<T extends PgSelect>(
    base: T,
    query: ListPageQuery,
    config: ListPageConfig,
) {
    // Drizzle's empty-selection conditional cannot resolve a generic PgSelect here.
    // Every caller supplies a selected entity row; retain the runtime subquery.
    const source = base.as('list_source') as Subquery;
    const columns = source as unknown as Columns;
    const expression = (key: string): SQLWrapper => {
        const alias = config.aliases?.[key];
        if (alias) return alias(columns);
        const column = columns[key];
        if (!column || key === '_') throw new AppError(400, 'Choose a supported sort column.');
        return config.numeric?.includes(key) ? sql`(${column})::numeric` : column;
    };
    const filters: SQL[] = [];
    if (query.search) {
        const pattern = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
        filters.push(
            or(...config.search.map((key) => ilike(sql`${expression(key)}::text`, pattern)))!,
        );
    }
    for (const [key, getValue] of Object.entries(config.filters ?? {})) {
        const value = query[key];
        if (value !== undefined && value !== '') filters.push(eq(getValue(columns), value));
    }
    const where = and(...filters);
    const sortBy = query.sortBy ?? config.defaultSort;
    const direction = query.sortDirection ?? config.defaultDirection ?? 'asc';
    const sort = direction === 'desc' ? desc : asc;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const rowQuery = db
        .select()
        .from(source)
        .where(where)
        .orderBy(sort(expression(sortBy)), sort(expression(config.id)))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
    const counts = {
        total: sql<number>`count(*)::int`,
        ...Object.fromEntries(
            Object.entries(config.counts ?? {}).map(([key, get]) => [key, get(columns)]),
        ),
    };
    const [rows, countRows, quantityRows, amountRows, facetResults] = await Promise.all([
        rowQuery,
        db.select(counts).from(source).where(where),
        config.quantities?.length
            ? db
                  .select({
                      primaryUomId: sql<number>`${columns.primaryUomId}`,
                      primaryUomName: sql<string>`${columns.primaryUomName}`,
                      ...Object.fromEntries(
                          config.quantities.map((key) => [
                              key,
                              sql<string>`coalesce(sum((${columns[key]})::numeric), 0)::text`,
                          ]),
                      ),
                  })
                  .from(source)
                  .where(where)
                  .groupBy(sql`${columns.primaryUomId}`, sql`${columns.primaryUomName}`)
                  .orderBy(asc(sql`${columns.primaryUomName}`))
            : Promise.resolve([]),
        config.amounts
            ? db
                  .select(
                      Object.fromEntries(
                          Object.entries(config.amounts).map(([key, get]) => [key, get(columns)]),
                      ),
                  )
                  .from(source)
                  .where(where)
            : Promise.resolve([{}]),
        Promise.all(
            Object.entries(config.facets ?? {}).map(async ([key, facet]) => {
                const options = await db
                    .selectDistinct({
                        value: sql<string>`${facet.value(columns)}::text`,
                        label: sql<string>`${facet.label(columns)}::text`,
                    })
                    .from(source)
                    .where(sql`${facet.value(columns)} is not null`)
                    .orderBy(
                        asc(sql`${facet.label(columns)}::text`),
                        asc(sql`${facet.value(columns)}::text`),
                    );
                return [key, options] as const;
            }),
        ),
    ]);
    const summaryCounts = countRows[0] ?? { total: 0 };
    return {
        rows: rows as T['_']['result'],
        total: Number(summaryCounts.total),
        page,
        pageSize,
        summary: { counts: summaryCounts, quantities: quantityRows, amounts: amountRows[0] ?? {} },
        facets: Object.fromEntries(facetResults),
    };
}
