import { quantityString, quantityUnits } from '../inventory-stocks/inventory-stock.rules.ts';
import type {
    InventoryReportQuery,
    InventoryReportRow,
    ReportItem,
    ReportStock,
    ReportMovement,
} from './inventory-report.schema.ts';

function emptyRow(item: ReportItem, rowId: string): InventoryReportRow {
    return {
        ...item,
        rowId,
        locationId: null,
        locationCode: null,
        locationName: null,
        locationType: null,
        lotId: null,
        lotNumber: null,
        lotCount: 0,
        qcStatus: null,
        expirationDate: null,
        daysToExpiry: null,
        qtyOnHand: null,
        qtyReserved: null,
        qtyAvailable: null,
        transactionId: null,
        transactionType: null,
        qtyChange: null,
        occurredAt: null,
        sourceReference: null,
        referenceId: null,
        actorName: null,
        reasonCode: null,
    };
}
const sum = (left: string | null, right: string) =>
    quantityString(quantityUnits(left ?? '0') + quantityUnits(right));
function matchesItem(row: ReportItem, query: InventoryReportQuery) {
    return (
        (!query.itemId || row.itemId === query.itemId) &&
        (!query.itemType || row.itemType === query.itemType) &&
        (!query.labelItemId || row.labelItemId === query.labelItemId)
    );
}
/** Exact quantities, with one bucket per primary UOM; no cross-unit grand total. */
export function buildInventoryReport(
    query: InventoryReportQuery,
    items: ReportItem[],
    stocks: ReportStock[],
    movements: ReportMovement[],
    now = new Date(),
    reorderLevels = new Map<number, string>(),
) {
    const asOfDate = now.toISOString().slice(0, 10);
    const day = Date.parse(asOfDate + 'T00:00:00Z');
    const scopedStocks = stocks.filter(
        (row) =>
            matchesItem(row, query) &&
            (!query.locationId || row.locationId === query.locationId) &&
            (!query.qcStatus || row.qcStatus === query.qcStatus),
    );
    let rows: InventoryReportRow[] = [];
    if (query.report === 'movement') {
        rows = movements
            .filter(
                (row) =>
                    matchesItem(row, query) &&
                    (!query.locationId || row.locationId === query.locationId) &&
                    (!query.transactionType || row.transactionType === query.transactionType) &&
                    (!query.fromDate ||
                        row.occurredAt.toISOString().slice(0, 10) >= query.fromDate) &&
                    (!query.toDate || row.occurredAt.toISOString().slice(0, 10) <= query.toDate),
            )
            .map((row) => ({
                ...emptyRow(row, 'movement:' + row.transactionId),
                ...row,
                rowId: 'movement:' + row.transactionId,
                lotCount: 1,
            }));
    } else if (query.report === 'stock-by-lot' || query.report === 'near-expiry') {
        rows = scopedStocks.map((row) => ({
            ...emptyRow(row, 'stock:' + row.stockId),
            ...row,
            rowId: 'stock:' + row.stockId,
            lotCount: 1,
            daysToExpiry:
                row.expirationDate === null
                    ? null
                    : Math.round((Date.parse(row.expirationDate + 'T00:00:00Z') - day) / 86400000),
        }));
        if (query.report === 'near-expiry')
            rows = rows.filter(
                (row) =>
                    quantityUnits(row.qtyOnHand!) > 0n &&
                    row.daysToExpiry !== null &&
                    row.daysToExpiry <= query.expiryDays &&
                    (query.includeExpired || row.daysToExpiry >= 0),
            );
    } else {
        const groups = new Map<string, InventoryReportRow>();
        const lots = new Map<string, Set<number>>();
        if (query.report === 'low-stock')
            for (const item of items.filter((row) => row.isActive && matchesItem(row, query))) {
                const key = 'item:' + item.itemId;
                groups.set(key, {
                    ...emptyRow(item, key),
                    qtyOnHand: '0.0000',
                    qtyReserved: '0.0000',
                    qtyAvailable: '0.0000',
                });
            }
        for (const stock of scopedStocks) {
            if (query.report === 'low-stock' && !stock.isActive) continue;
            const key =
                query.report === 'low-stock'
                    ? 'item:' + stock.itemId
                    : 'location:' + stock.locationId + ':item:' + stock.itemId;
            let row = groups.get(key);
            if (!row) {
                row = {
                    ...emptyRow(stock, key),
                    locationId: stock.locationId,
                    locationCode: stock.locationCode,
                    locationName: stock.locationName,
                    locationType: stock.locationType,
                    qtyOnHand: '0.0000',
                    qtyReserved: '0.0000',
                    qtyAvailable: '0.0000',
                };
                groups.set(key, row);
            }
            row.qtyOnHand = sum(row.qtyOnHand, stock.qtyOnHand);
            row.qtyReserved = sum(row.qtyReserved, stock.qtyReserved);
            const eligible =
                stock.locationIsActive !== false &&
                stock.qcStatus === 'Approved' &&
                !['In Transit', 'Quarantine', 'Scrap'].includes(stock.locationType) &&
                (stock.expirationDate === null || stock.expirationDate > asOfDate);
            row.qtyAvailable = sum(
                row.qtyAvailable,
                query.report === 'low-stock' && !eligible ? '0' : stock.qtyAvailable,
            );
            const set = lots.get(key) ?? new Set<number>();
            set.add(stock.lotId);
            lots.set(key, set);
            row.lotCount = set.size;
        }
        rows = [...groups.values()];
        if (query.report === 'low-stock')
            rows = rows.filter((row) => {
                row.reorderLevel = reorderLevels.get(row.itemId) ?? query.threshold;
                return quantityUnits(row.qtyAvailable!) <= quantityUnits(row.reorderLevel);
            });
    }
    if (query.q) {
        const term = query.q.toLocaleLowerCase();
        rows = rows.filter((row) =>
            [
                row.sku,
                row.itemName,
                row.labelItemName,
                row.locationCode,
                row.locationName,
                row.lotNumber,
                row.sourceReference,
                row.referenceId,
                row.actorName,
                row.reasonCode,
            ]
                .filter(Boolean)
                .join(' ')
                .toLocaleLowerCase()
                .includes(term),
        );
    }
    rows.sort((a, b) =>
        query.report === 'movement'
            ? b.occurredAt!.getTime() - a.occurredAt!.getTime() ||
              b.transactionId! - a.transactionId!
            : query.report === 'near-expiry'
              ? a.daysToExpiry! - b.daysToExpiry! || a.rowId.localeCompare(b.rowId)
              : a.itemName.localeCompare(b.itemName) ||
                (a.locationName ?? '').localeCompare(b.locationName ?? '') ||
                a.rowId.localeCompare(b.rowId),
    );
    const buckets = new Map<
        number,
        {
            primaryUomId: number;
            primaryUomName: string;
            qtyOnHand: string;
            qtyReserved: string;
            qtyAvailable: string;
            qtyIn: string;
            qtyOut: string;
            netChange: string;
        }
    >();
    for (const row of rows) {
        let bucket = buckets.get(row.primaryUomId);
        if (!bucket) {
            bucket = {
                primaryUomId: row.primaryUomId,
                primaryUomName: row.primaryUomName,
                qtyOnHand: '0.0000',
                qtyReserved: '0.0000',
                qtyAvailable: '0.0000',
                qtyIn: '0.0000',
                qtyOut: '0.0000',
                netChange: '0.0000',
            };
            buckets.set(row.primaryUomId, bucket);
        }
        if (row.qtyChange !== null) {
            const units = quantityUnits(row.qtyChange);
            bucket.netChange = sum(bucket.netChange, row.qtyChange);
            if (units > 0n) bucket.qtyIn = sum(bucket.qtyIn, row.qtyChange);
            else bucket.qtyOut = sum(bucket.qtyOut, quantityString(-units));
        } else {
            bucket.qtyOnHand = sum(bucket.qtyOnHand, row.qtyOnHand!);
            bucket.qtyReserved = sum(bucket.qtyReserved, row.qtyReserved!);
            bucket.qtyAvailable = sum(bucket.qtyAvailable, row.qtyAvailable!);
        }
    }
    const keys = new Set(rows.map((row) => row.rowId));
    const source =
        query.report === 'stock-by-location' || query.report === 'low-stock'
            ? scopedStocks.filter((row) =>
                  keys.has(
                      query.report === 'low-stock'
                          ? 'item:' + row.itemId
                          : 'location:' + row.locationId + ':item:' + row.itemId,
                  ),
              )
            : rows;
    return {
        report: query.report,
        filters: query,
        generatedAt: now.toISOString(),
        asOfDate,
        rows,
        summary: {
            rowCount: rows.length,
            itemCount: new Set(rows.map((row) => row.itemId)).size,
            lotCount: new Set(source.flatMap((row) => (row.lotId === null ? [] : [row.lotId])))
                .size,
            locationCount: new Set(
                source.flatMap((row) => (row.locationId === null ? [] : [row.locationId])),
            ).size,
        },
        totals: [...buckets.values()].sort((a, b) =>
            a.primaryUomName.localeCompare(b.primaryUomName),
        ),
    };
}
