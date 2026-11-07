import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTableColumns, getTableName, is, SQL, type Table } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { applicationTables, type Database } from '../src/db/test-database.ts';
import { seedSampleData, SAMPLE_ADMIN_EMAIL } from '../src/db/sample-data.ts';
import { quantityUnits } from '../src/modules/inventory-stocks/inventory-stock.rules.ts';

type Row = Record<string, unknown>;
type State = Record<string, Row[]>;
const now = new Date('2026-11-05T08:00:00Z');
const clone = <T>(value: T): T => structuredClone(value);
const units = (value: unknown) => quantityUnits(String(value));
const key = (row: Row) => `${row.itemId}:${row.lotId}:${row.locationId}`;

/** Capture the actual import's writes without using application credentials.
 * This fake only supports the seed's basic inserts, audit updates, lot lookup,
 * and transaction boundary. Native PostgreSQL tests cover database locking. */
function fixture() {
    const state: State = Object.fromEntries(
        applicationTables.map((table) => [getTableName(table), []]),
    );
    const dialect = new PgDialect();
    let rejectLedger = false;
    const rows = (table: Table) => state[getTableName(table)]!;
    function matches(table: Table, condition: SQL | undefined, row: Row) {
        if (!condition) return true;
        const query = dialect.sqlToQuery(condition);
        const match = query.sql.match(/"[^"]+"\."([^"]+)"\s*=\s*(?:\$(\d+)|'([^']*)')/);
        assert.ok(match, `Unexpected sample lookup: ${query.sql}`);
        const property = Object.entries(getTableColumns(table)).find(
            ([, column]) => column.name === match[1],
        )?.[0];
        assert.ok(property, 'Lookup must reference a table column');
        const expected = match[2] ? query.params[Number(match[2]) - 1] : match[3];
        return row[property] === expected;
    }
    function defaults(table: Table) {
        return Object.fromEntries(
            Object.entries(getTableColumns(table)).map(([property, column]) => {
                const value = column.default;
                return [
                    property,
                    is(value, SQL) ? new Date(now) : value !== undefined ? clone(value) : null,
                ];
            }),
        );
    }
    const transaction = {
        async execute(statement: SQL) {
            const query = dialect.sqlToQuery(statement);
            if (/^select exists/i.test(query.sql)) {
                for (const name of [
                    'sales_orders',
                    'sales_order_lines',
                    'delivery_orders',
                    'delivery_order_lines',
                ])
                    assert.ok(
                        query.sql.includes(`"${name}"`),
                        `${name} participates in the empty-database check`,
                    );
                return [{ populated: Object.values(state).some((records) => records.length > 0) }];
            }
            assert.match(
                query.sql,
                /^(select pg_advisory_xact_lock|select set_config|set local|lock table)/i,
            );
            return [];
        },
        insert(table: Table) {
            let provided: Row[] = [];
            let saved: Row[] | undefined;
            function execute() {
                if (saved) return saved;
                if (getTableName(table) === 'inventory_transactions' && rejectLedger) {
                    rejectLedger = false;
                    throw new Error('Injected sample ledger failure');
                }
                const primary = Object.entries(getTableColumns(table)).find(
                    ([, column]) => column.primary,
                )?.[0];
                assert.ok(primary, 'Sample tables have generated primary keys');
                saved = provided.map((input) => {
                    const row = { ...defaults(table), ...clone(input) };
                    row[primary] =
                        input[primary] ??
                        Math.max(0, ...rows(table).map((item) => Number(item[primary]))) + 1;
                    rows(table).push(row);
                    return row;
                });
                return saved;
            }
            const builder = {
                values(input: Row | Row[]) {
                    provided = Array.isArray(input) ? input : [input];
                    return builder;
                },
                async returning() {
                    return execute();
                },
                then(resolve: (value: Row[]) => unknown, reject: (error: unknown) => unknown) {
                    return Promise.resolve().then(execute).then(resolve, reject);
                },
            };
            return builder;
        },
        update(table: Table) {
            let changes: Row = {};
            let condition: SQL | undefined;
            function execute() {
                const changed = rows(table).filter((row) => matches(table, condition, row));
                for (const row of changed) Object.assign(row, clone(changes));
                return changed;
            }
            const builder = {
                set(value: Row) {
                    changes = value;
                    return builder;
                },
                where(value: SQL) {
                    condition = value;
                    return builder;
                },
                async returning() {
                    return execute();
                },
                then(resolve: (value: Row[]) => unknown, reject: (error: unknown) => unknown) {
                    return Promise.resolve().then(execute).then(resolve, reject);
                },
            };
            return builder;
        },
        select() {
            let table: Table;
            let condition: SQL | undefined;
            const builder = {
                from(value: Table) {
                    table = value;
                    return builder;
                },
                where(value: SQL) {
                    condition = value;
                    return builder;
                },
                then(resolve: (value: Row[]) => unknown, reject: (error: unknown) => unknown) {
                    return Promise.resolve()
                        .then(() => rows(table).filter((row) => matches(table, condition, row)))
                        .then(resolve, reject);
                },
            };
            return builder;
        },
    };
    const database = {
        async transaction<T>(run: (value: unknown) => Promise<T>) {
            const before = clone(state);
            try {
                return await run(transaction);
            } catch (error) {
                for (const name of Object.keys(state)) state[name] = before[name]!;
                throw error;
            }
        },
    } as unknown as Database;
    return {
        state,
        options: { database, now, environment: { KFF_ALLOW_TEST_DATA: 'true' } },
        failLedger() {
            rejectLedger = true;
        },
    };
}

test('sample import creates every sales/delivery state and assigns the six testing roles', async () => {
    const seeded = fixture();
    assert.deepEqual(await seedSampleData(seeded.options), { status: 'seeded' });
    const { state } = seeded;
    assert.equal(state.brands!.length, 3);
    assert.equal(state.brands!.filter((row) => row.isActive).length, 2);
    const finishedProducts = state.items!.filter((row) => row.itemType === 'Finished Good');
    assert.equal(finishedProducts.length, 8);
    for (const product of finishedProducts) {
        assert.ok(
            state.brands!.some((brand) => brand.brandId === product.brandId && brand.isActive),
        );
        assert.equal(
            state.bill_of_materials!.filter((row) => row.parentItemId === product.itemId).length,
            4,
        );
    }
    assert.equal(state.sales_orders!.length, 5);
    assert.equal(state.delivery_orders!.length, 6);
    assert.deepEqual(
        new Set(state.sales_orders!.map((row) => row.status)),
        new Set(['Draft', 'Confirmed', 'Partially Delivered', 'Completed', 'Cancelled']),
    );
    assert.deepEqual(
        new Set(state.delivery_orders!.map((row) => row.status)),
        new Set(['Draft', 'In Transit', 'Completed', 'Cancelled']),
    );
    const roleFor = (email: string) => {
        const account = state.users!.find((row) => row.email === email);
        assert.ok(account, `${email} was created`);
        return state.roles!.find((row) => row.roleId === account.roleId)!;
    };
    assert.equal(state.roles!.length, 6);
    assert.equal(state.users!.length, 6);
    assert.deepEqual(roleFor('sales@spice.local').settings, { canManageInventory: true });
    assert.deepEqual(roleFor('delivery@spice.local').settings, { canManageTransfers: true });
    assert.deepEqual(roleFor('viewer@spice.local').settings, {});
    assert.equal(roleFor(SAMPLE_ADMIN_EMAIL).name, 'Sample Administrator');
    for (const account of state.users!)
        assert.ok(state.roles!.some((role) => role.roleId === account.roleId));

    const admin = state.users!.find((row) => row.email === SAMPLE_ADMIN_EMAIL)!;
    for (const table of [
        'sales_orders',
        'sales_order_lines',
        'delivery_orders',
        'delivery_order_lines',
    ])
        for (const row of state[table]!) {
            assert.equal(row.createdBy, admin.userId);
            assert.equal(row.updatedBy, admin.userId);
        }
    for (const line of state.sales_order_lines!) {
        const deliveries = state.delivery_order_lines!.filter(
            (row) => row.salesOrderLineId === line.salesOrderLineId,
        );
        const completed = deliveries.filter(
            (row) =>
                state.delivery_orders!.find(
                    (header) => header.deliveryOrderId === row.deliveryOrderId,
                )!.status === 'Completed',
        );
        const allocated = deliveries.filter((row) =>
            ['Draft', 'In Transit'].includes(
                String(
                    state.delivery_orders!.find(
                        (header) => header.deliveryOrderId === row.deliveryOrderId,
                    )!.status,
                ),
            ),
        );
        assert.equal(
            units(line.qtyDelivered),
            completed.reduce((sum, row) => sum + units(row.qtyDelivered), 0n),
        );
        assert.ok(
            units(line.qtyOrdered) >=
                units(line.qtyDelivered) +
                    allocated.reduce((sum, row) => sum + units(row.qtyDelivered), 0n),
        );
        assert.equal(
            line.uomId,
            state.items!.find((item) => item.itemId === line.itemId)!.primaryUomId,
        );
    }
});

test('sample delivery stock reconciles with traceable transfer/sale entries and protected transit allocations', async () => {
    const seeded = fixture();
    await seedSampleData(seeded.options);
    const { state } = seeded;
    const quantities = new Map<string, bigint>();
    for (const row of state.inventory_transactions!)
        quantities.set(key(row), (quantities.get(key(row)) ?? 0n) + units(row.qtyChange));
    assert.equal(state.inventory_stock!.length, quantities.size);
    for (const stock of state.inventory_stock!) {
        assert.equal(units(stock.qtyOnHand), quantities.get(key(stock)));
        const reserved = state
            .inventory_reservations!.filter(
                (row) => key(row) === key(stock) && row.releasedAt === null,
            )
            .reduce((sum, row) => sum + units(row.qtyReserved) - units(row.qtyConsumed), 0n);
        assert.ok(
            units(stock.qtyOnHand) >= reserved,
            'active allocations cannot exceed the seed balance',
        );
    }
    for (const line of state.delivery_order_lines!) {
        const header = state.delivery_orders!.find(
            (row) => row.deliveryOrderId === line.deliveryOrderId,
        )!;
        const salesLine = state.sales_order_lines!.find(
            (row) => row.salesOrderLineId === line.salesOrderLineId,
        )!;
        const lot = state.lots!.find((row) => row.lotId === line.lotId)!;
        assert.equal(salesLine.salesOrderId, header.salesOrderId);
        assert.equal(salesLine.itemId, line.itemId);
        assert.equal(lot.itemId, line.itemId);
        assert.ok(lot.packingOrderId);
        const entries = state.inventory_transactions!.filter(
            (row) => row.deliveryOrderLineId === line.deliveryOrderLineId,
        );
        const reservations = state.inventory_reservations!.filter(
            (row) => row.deliveryOrderLineId === line.deliveryOrderLineId,
        );
        if (['Draft', 'Cancelled'].includes(String(header.status))) {
            assert.equal(entries.length, 0);
            assert.equal(reservations.length, 0);
            continue;
        }
        const movements = entries.filter((row) => row.transactionType === 'Transfer');
        assert.equal(movements.length, 2);
        assert.equal(
            movements.reduce((sum, row) => sum + units(row.qtyChange), 0n),
            0n,
        );
        assert.equal(
            units(movements.find((row) => row.locationId === header.sourceLocationId)!.qtyChange),
            -units(line.qtyDelivered),
        );
        assert.equal(
            units(movements.find((row) => row.locationId === header.transitLocationId)!.qtyChange),
            units(line.qtyDelivered),
        );
        assert.equal(reservations.length, 1);
        const reservation = reservations[0]!;
        assert.equal(reservation.packingOrderMaterialId, null);
        assert.equal(reservation.locationId, header.transitLocationId);
        assert.equal(units(reservation.qtyReserved), units(line.qtyDelivered));
        const sales = entries.filter((row) => row.transactionType === 'Sale');
        if (header.status === 'Completed') {
            assert.equal(sales.length, 1);
            assert.equal(units(sales[0]!.qtyChange), -units(line.qtyDelivered));
            assert.equal(sales[0]!.locationId, header.transitLocationId);
            assert.equal(units(reservation.qtyConsumed), units(reservation.qtyReserved));
            assert.ok(reservation.releasedAt instanceof Date);
        } else {
            assert.equal(sales.length, 0);
            assert.equal(units(reservation.qtyConsumed), 0n);
            assert.equal(reservation.releasedAt, null);
        }
        for (const entry of entries) {
            assert.equal(entry.referenceId, header.deliveryOrderNumber);
            assert.equal(entry.lotId, line.lotId);
            assert.equal(entry.itemId, line.itemId);
            assert.ok(entry.authorizedByUserId);
        }
    }
});

test('sample loading preserves populated databases including existing sales documents', async () => {
    const seeded = fixture();
    seeded.state.sales_orders!.push({ salesOrderId: 91, salesOrderNumber: 'KEEP-THIS-ORDER' });
    const before = clone(seeded.state);
    assert.deepEqual(await seedSampleData(seeded.options), { status: 'skipped-existing' });
    assert.deepEqual(seeded.state, before);
});

test('a late sample ledger failure rolls back roles, users, orders, lots and reservations together', async () => {
    const seeded = fixture();
    seeded.failLedger();
    await assert.rejects(seedSampleData(seeded.options), /Injected sample ledger failure/);
    for (const [name, rows] of Object.entries(seeded.state))
        assert.equal(rows.length, 0, `${name} rolled back`);
    assert.deepEqual(await seedSampleData(seeded.options), { status: 'seeded' });
    assert.equal(seeded.state.sales_orders!.length, 5);
    assert.equal(seeded.state.delivery_orders!.length, 6);
});
