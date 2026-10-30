import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTableName, type SQL, type Table } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { db } from '../src/db/index.ts';
import {
    quantityString,
    quantityUnits,
} from '../src/modules/packing-orders/packing-order.rules.ts';

process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
const {
    createPackingOrder,
    planPackingOrder,
    startPackingOrder,
    completePackingOrder,
    cancelPackingOrder,
} = await import('../src/modules/packing-orders/packing-order.service.ts');
type Row = Record<string, unknown>;
const copy = <T>(value: T): T => structuredClone(value);
const primaryKeys: Record<string, string> = {
    packing_orders: 'packingOrderId',
    packing_order_materials: 'packingOrderMaterialId',
    items: 'itemId',
    lots: 'lotId',
    locations: 'locationId',
    inventory_stock: 'stockId',
    inventory_reservations: 'reservationId',
    inventory_transactions: 'transactionId',
    uoms: 'uomId',
    bill_of_materials: 'bomId',
};
const camel = (value: string) =>
    value.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());

/** Transaction fake with row-lock waits and rollback journals. It runs the real
 * service, while keeping operational database credentials entirely unused. */
function fixture() {
    const now = new Date('2026-10-29T00:00:00Z');
    const audit = { createdBy: 7, updatedBy: 7, createdAt: now, updatedAt: now };
    const state: Record<string, Row[]> = {
        packing_orders: [1, 2].map((id) => ({
            packingOrderId: id,
            packingOrderNumber: `PK-${id}`,
            itemId: 10,
            targetQty: '10.0000',
            actualQty: '0.0000',
            status: 'Draft',
            sourceLocationId: 1,
            destinationLocationId: 2,
            scheduledDate: null,
            startedAt: null,
            completedAt: null,
            notes: null,
            ...audit,
        })),
        packing_order_materials: [1, 2].map((id) => ({
            packingOrderMaterialId: id,
            packingOrderId: id,
            itemId: 1,
            uomId: 1,
            requiredQty: '5.0000',
            consumedQty: '0.0000',
            ...audit,
        })),
        items: [
            {
                itemId: 1,
                sku: 'RAW',
                name: 'Raw garlic',
                itemType: 'Raw Material - Bulk',
                primaryUomId: 1,
                isActive: true,
                requiresQc: false,
            },
            {
                itemId: 10,
                sku: 'FG',
                name: 'Packed garlic',
                itemType: 'Finished Good',
                primaryUomId: 2,
                isActive: true,
                requiresQc: false,
            },
        ],
        uoms: [
            { uomId: 1, name: 'kg', uomClassId: 1, factorToBase: '1.00000000' },
            { uomId: 2, name: 'pc', uomClassId: 2, factorToBase: '1.00000000' },
        ],
        locations: [
            {
                locationId: 1,
                code: 'RM',
                name: 'Raw warehouse',
                locationType: 'Warehouse',
                isActive: true,
            },
            {
                locationId: 2,
                code: 'FG',
                name: 'Finished warehouse',
                locationType: 'Warehouse',
                isActive: true,
            },
        ],
        lots: [
            {
                lotId: 1,
                lotNumber: 'RAW-1',
                itemId: 1,
                unitCost: '2.0000',
                qcStatus: 'Approved',
                expirationDate: null,
                packingOrderId: null,
                ...audit,
            },
        ],
        inventory_stock: [{ stockId: 1, itemId: 1, lotId: 1, locationId: 1, qtyOnHand: '8.0000' }],
        inventory_reservations: [],
        inventory_transactions: [],
        bill_of_materials: [
            { bomId: 1, parentItemId: 10, componentItemId: 1, quantity: '0.500000', uomId: 1 },
        ],
    };
    const events: string[] = [];
    const held = new Map<string, Promise<void>>();
    let failProduce = false;
    let transactionId = 0;
    const dialect = new PgDialect();
    function filtered(name: string, where: SQL | undefined) {
        let rows = state[name] ?? [];
        if (!where) return rows;
        const query = dialect.sqlToQuery(where);
        for (const match of query.sql.matchAll(/"[^\"]+"\."([^\"]+)" = \$(\d+)/g)) {
            const key = camel(match[1]!);
            const value = query.params[Number(match[2]) - 1];
            if (key === 'qcStatus') continue; // Joined lot eligibility is applied below.
            rows = rows.filter((row) => row[key] === value);
        }
        for (const match of query.sql.matchAll(/"[^\"]+"\."([^\"]+)" in \(([^)]+)\)/g)) {
            const key = camel(match[1]!);
            const values = [...match[2]!.matchAll(/\$(\d+)/g)].map(
                (entry) => query.params[Number(entry[1]) - 1],
            );
            rows = rows.filter((row) => values.includes(row[key]));
        }
        return rows;
    }
    function enrich(name: string, row: Row, fields: Row | undefined) {
        const result = copy(row);
        if (name === 'inventory_stock' && fields?.qtyReserved) {
            result.expirationDate = state.lots!.find(
                (lot) => lot.lotId === row.lotId,
            )?.expirationDate;
            result.qtyReserved = quantityString(
                state
                    .inventory_reservations!.filter(
                        (res) =>
                            res.lotId === row.lotId &&
                            res.locationId === row.locationId &&
                            res.releasedAt === null,
                    )
                    .reduce(
                        (sum, res) =>
                            sum +
                            quantityUnits(String(res.qtyReserved)) -
                            quantityUnits(String(res.qtyConsumed)),
                        0n,
                    ),
            );
        }
        if (name === 'packing_orders' && fields?.materialCount) {
            const item = state.items!.find((item) => item.itemId === row.itemId)!;
            const unit = state.uoms!.find((unit) => unit.uomId === item.primaryUomId)!;
            const source = state.locations!.find((loc) => loc.locationId === row.sourceLocationId)!;
            const destination = state.locations!.find(
                (loc) => loc.locationId === row.destinationLocationId,
            )!;
            Object.assign(result, {
                itemSku: item.sku,
                itemName: item.name,
                primaryUomId: item.primaryUomId,
                primaryUomName: unit.name,
                sourceLocationCode: source.code,
                sourceLocationName: source.name,
                destinationLocationCode: destination.code,
                destinationLocationName: destination.name,
                materialCount: state.packing_order_materials!.filter(
                    (mat) => mat.packingOrderId === row.packingOrderId,
                ).length,
            });
        }
        if (name === 'packing_order_materials' && fields?.qtyReserved)
            result.qtyReserved = quantityString(
                state
                    .inventory_reservations!.filter(
                        (res) =>
                            res.packingOrderMaterialId === row.packingOrderMaterialId &&
                            res.releasedAt === null,
                    )
                    .reduce(
                        (sum, res) =>
                            sum +
                            quantityUnits(String(res.qtyReserved)) -
                            quantityUnits(String(res.qtyConsumed)),
                        0n,
                    ),
            );
        return result;
    }
    const database = {
        transaction: async <T>(run: (tx: unknown) => Promise<T>): Promise<T> => {
            const id = ++transactionId;
            const release: (() => void)[] = [];
            const acquired = new Set<string>();
            const undo: (() => void)[] = [];
            async function lock(key: string) {
                if (acquired.has(key)) return;
                const previous = held.get(key) ?? Promise.resolve();
                let unlock!: () => void;
                const next = new Promise<void>((resolve) => {
                    unlock = resolve;
                });
                held.set(key, next);
                await previous;
                acquired.add(key);
                release.push(unlock);
                events.push(`${id}:lock:${key}`);
            }
            function select(fields?: Row) {
                let name = '';
                let where: SQL | undefined;
                let mode: string | undefined;
                const builder = {
                    from(table: Table) {
                        name = getTableName(table);
                        return builder;
                    },
                    innerJoin() {
                        return builder;
                    },
                    leftJoin() {
                        return builder;
                    },
                    where(condition: SQL | undefined) {
                        where = condition;
                        return builder;
                    },
                    orderBy() {
                        return builder;
                    },
                    limit() {
                        return builder;
                    },
                    for(value: string) {
                        mode = value;
                        return builder;
                    },
                    then(resolve: (rows: Row[]) => unknown, reject: (error: unknown) => unknown) {
                        return (async () => {
                            if (mode === 'update' && (name === 'lots' || name === 'packing_orders'))
                                for (const row of filtered(name, where))
                                    await lock(name + ':' + row[primaryKeys[name]!]);
                            let rows = filtered(name, where);
                            if (name === 'inventory_stock' && fields?.qtyReserved)
                                rows = rows.filter((row) => {
                                    const lot = state.lots!.find((lot) => lot.lotId === row.lotId);
                                    return (
                                        lot?.qcStatus === 'Approved' &&
                                        (lot.expirationDate === null ||
                                            String(lot.expirationDate) >
                                                new Date().toISOString().slice(0, 10))
                                    );
                                });
                            return rows.map((row) => enrich(name, row, fields));
                        })().then(resolve, reject);
                    },
                };
                return builder;
            }
            function insert(table: Table) {
                const name = getTableName(table);
                let values: Row[] = [];
                let executed = false;
                let inserted: Row[] = [];
                const execute = () => {
                    if (executed) return inserted;
                    executed = true;
                    for (const value of values) {
                        if (
                            name === 'inventory_transactions' &&
                            value.transactionType === 'Produce' &&
                            failProduce
                        )
                            throw new Error('Simulated output ledger failure');
                        if (
                            name === 'lots' &&
                            state.lots!.some((lot) => lot.lotNumber === value.lotNumber)
                        )
                            throw new Error('Duplicate finished lot');
                        const key = primaryKeys[name]!;
                        const row = {
                            ...audit,
                            ...copy(value),
                            [key]: Math.max(0, ...state[name]!.map((row) => Number(row[key]))) + 1,
                        };
                        if (name === 'inventory_reservations')
                            Object.assign(row, { qtyConsumed: '0.0000', releasedAt: null });
                        if (name === 'packing_orders')
                            Object.assign(row, {
                                status: 'Draft',
                                actualQty: '0.0000',
                                scheduledDate: null,
                                startedAt: null,
                                completedAt: null,
                                notes: null,
                            });
                        if (name === 'packing_order_materials')
                            Object.assign(row, { consumedQty: '0.0000' });
                        state[name]!.push(row);
                        inserted.push(row);
                        undo.push(() => {
                            state[name] = state[name]!.filter((current) => current !== row);
                        });
                        events.push(`${id}:insert:${name}`);
                    }
                    return inserted;
                };
                const builder = {
                    values(value: Row | Row[]) {
                        values = Array.isArray(value) ? value : [value];
                        return builder;
                    },
                    returning(fields: Row) {
                        const rows = execute();
                        return Promise.resolve(
                            rows.map((row) =>
                                Object.fromEntries(
                                    Object.keys(fields).map((key) => [
                                        key,
                                        row[key] ?? row[primaryKeys[name]!],
                                    ]),
                                ),
                            ),
                        );
                    },
                    then(resolve: (rows: Row[]) => unknown, reject: (error: unknown) => unknown) {
                        return Promise.resolve().then(execute).then(resolve, reject);
                    },
                };
                return builder;
            }
            function update(table: Table) {
                const name = getTableName(table);
                let patch: Row = {};
                return {
                    set(value: Row) {
                        patch = value;
                        return {
                            where(condition: SQL) {
                                for (const row of filtered(name, condition)) {
                                    const previous = copy(row);
                                    Object.assign(row, copy(patch));
                                    undo.push(() => {
                                        for (const key of Object.keys(row)) delete row[key];
                                        Object.assign(row, previous);
                                    });
                                }
                                events.push(`${id}:update:${name}`);
                                return Promise.resolve();
                            },
                        };
                    },
                };
            }
            try {
                const result = await run({ select, insert, update });
                events.push(`${id}:commit`);
                return result;
            } catch (error) {
                for (const revert of undo.reverse()) revert();
                events.push(`${id}:rollback`);
                throw error;
            } finally {
                for (const unlock of release.reverse()) unlock();
            }
        },
    };
    return {
        state,
        events,
        database: database as unknown as typeof db,
        failOutput() {
            failProduce = true;
        },
    };
}

test('real planning service serializes competing orders on the parent lot and never promises the same stock twice', async () => {
    const fixtureDb = fixture();
    const outcomes = await Promise.allSettled([
        planPackingOrder(1, 7, fixtureDb.database),
        planPackingOrder(2, 7, fixtureDb.database),
    ]);
    assert.equal(outcomes.filter((row) => row.status === 'fulfilled').length, 1);
    const failure = outcomes.find((row) => row.status === 'rejected');
    assert.ok(failure && failure.status === 'rejected');
    assert.equal(failure.reason.status, 409);
    assert.equal(fixtureDb.state.inventory_reservations!.length, 1);
    assert.equal(fixtureDb.state.inventory_reservations![0]!.qtyReserved, '5.0000');
    assert.equal(fixtureDb.state.inventory_stock![0]!.qtyOnHand, '8.0000');
    assert.equal(fixtureDb.state.inventory_transactions!.length, 0);
    assert.equal(
        fixtureDb.state.packing_orders!.filter((row) => row.status === 'Planned').length,
        1,
    );
    assert.equal(fixtureDb.events.filter((event) => event.endsWith('lock:lots:1')).length, 2);
});
test('start retains allocations; partial completion consumes snapshot quantities, releases unused stock and traces output atomically', async () => {
    const fixtureDb = fixture();
    await planPackingOrder(1, 7, fixtureDb.database);
    await startPackingOrder(1, 7, fixtureDb.database);
    assert.equal(fixtureDb.state.inventory_stock![0]!.qtyOnHand, '8.0000');
    assert.equal(fixtureDb.state.inventory_reservations![0]!.releasedAt, null);
    await completePackingOrder(1, { actualQty: '6', lotNumber: 'FG-1' }, 7, fixtureDb.database);
    assert.equal(fixtureDb.state.inventory_stock![0]!.qtyOnHand, '5.0000');
    const reservation = fixtureDb.state.inventory_reservations![0]!;
    assert.equal(reservation.qtyConsumed, '3.0000');
    assert.ok(reservation.releasedAt instanceof Date);
    assert.equal(fixtureDb.state.packing_order_materials![0]!.consumedQty, '3.0000');
    const output = fixtureDb.state.lots!.find((row) => row.lotNumber === 'FG-1')!;
    assert.equal(output.packingOrderId, 1);
    assert.equal(output.poLineId, null);
    assert.equal(output.unitCost, '1.0000');
    assert.equal(output.createdBy, 7);
    assert.deepEqual(
        fixtureDb.state.inventory_transactions!.map((row) => [
            row.transactionType,
            row.qtyChange,
            row.packingOrderId,
            row.authorizedByUserId,
        ]),
        [
            ['Consume', '-3.0000', 1, 7],
            ['Produce', '6.0000', 1, 7],
        ],
    );
    assert.equal(
        fixtureDb.state.inventory_stock!.find((row) => row.lotId === output.lotId)!.qtyOnHand,
        '6.0000',
    );
    assert.equal(fixtureDb.state.packing_orders![0]!.status, 'Completed');
    await assert.rejects(
        completePackingOrder(1, { actualQty: '6', lotNumber: 'FG-2' }, 7, fixtureDb.database),
        { status: 409 },
    );
    assert.equal(fixtureDb.state.inventory_transactions!.length, 2);
});
test('a failed Produce ledger write rolls back material balances, Consume entries, reservations, output lot and order status', async () => {
    const fixtureDb = fixture();
    await planPackingOrder(1, 7, fixtureDb.database);
    await startPackingOrder(1, 7, fixtureDb.database);
    const before = copy(fixtureDb.state);
    fixtureDb.failOutput();
    await assert.rejects(
        completePackingOrder(1, { actualQty: '10', lotNumber: 'FG-FAILED' }, 7, fixtureDb.database),
        /Simulated output ledger failure/,
    );
    assert.deepEqual(fixtureDb.state, before);
});
test('creation copies converted BOM requirements and later planning and completion use the saved snapshot', async () => {
    const fixtureDb = fixture();
    const created = await createPackingOrder(
        {
            packingOrderNumber: 'PK-SNAPSHOT',
            itemId: 10,
            targetQty: '12',
            sourceLocationId: 1,
            destinationLocationId: 2,
        },
        7,
        fixtureDb.database,
    );
    const material = fixtureDb.state.packing_order_materials!.find(
        (row) => row.packingOrderId === created.packingOrderId,
    )!;
    assert.equal(material.requiredQty, '6.0000');
    assert.equal(material.uomId, 1);
    fixtureDb.state.bill_of_materials![0]!.quantity = '9.000000';
    await planPackingOrder(created.packingOrderId, 7, fixtureDb.database);
    const allocation = fixtureDb.state.inventory_reservations!.find(
        (row) => row.packingOrderMaterialId === material.packingOrderMaterialId,
    )!;
    assert.equal(allocation.qtyReserved, '6.0000');
    await startPackingOrder(created.packingOrderId, 7, fixtureDb.database);
    await completePackingOrder(
        created.packingOrderId,
        { actualQty: '6', lotNumber: 'FG-SNAPSHOT' },
        7,
        fixtureDb.database,
    );
    assert.equal(material.consumedQty, '3.0000');
    assert.equal(fixtureDb.state.inventory_stock![0]!.qtyOnHand, '5.0000');
});
test('start/completion recheck lot quality and expiry; cancellation releases allocations without altering stock or ledger', async () => {
    const fixtureDb = fixture();
    await planPackingOrder(1, 7, fixtureDb.database);
    fixtureDb.state.lots![0]!.qcStatus = 'Quarantine';
    await assert.rejects(startPackingOrder(1, 7, fixtureDb.database), { status: 409 });
    fixtureDb.state.lots![0]!.qcStatus = 'Approved';
    await startPackingOrder(1, 7, fixtureDb.database);
    fixtureDb.state.lots![0]!.expirationDate = '2000-01-01';
    await assert.rejects(
        completePackingOrder(
            1,
            { actualQty: '10', lotNumber: 'FG-EXPIRED' },
            7,
            fixtureDb.database,
        ),
        { status: 409 },
    );
    await cancelPackingOrder(1, 7, fixtureDb.database);
    assert.equal(fixtureDb.state.packing_orders![0]!.status, 'Cancelled');
    assert.ok(fixtureDb.state.inventory_reservations![0]!.releasedAt instanceof Date);
    assert.equal(fixtureDb.state.inventory_stock![0]!.qtyOnHand, '8.0000');
    assert.equal(fixtureDb.state.inventory_transactions!.length, 0);
});
