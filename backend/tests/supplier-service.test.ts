import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { drizzle } from 'drizzle-orm/pg-proxy';
import { db } from '../src/db/index.ts';
import { getSupplier, listSuppliers } from '../src/modules/suppliers/supplier.service.ts';

// Exercise the real service and installed Drizzle SQL compiler, without a live
// database. Fake-service HTTP tests cannot detect lost correlation qualifiers.
test('supplier list and detail correlate every count and open-order flag to the outer supplier', async () => {
    const queries: { sql: string; params: unknown[] }[] = [];
    const proxy = drizzle(async (sql, params) => {
        queries.push({ sql, params });
        return { rows: [] };
    });
    const select = mock.method(db, 'select', proxy.select.bind(proxy) as typeof db.select);
    try {
        await listSuppliers();
        await getSupplier(4);
    } finally {
        select.mock.restore();
    }
    assert.equal(queries.length, 2);
    for (const { sql } of queries) {
        assert.equal(
            [...sql.matchAll(/"supplier_items"\."supplier_id"="suppliers"\."supplier_id"/g)].length,
            3,
            'total, active and preferred link counts must be supplier-specific',
        );
        assert.match(sql, /"purchase_orders"\."supplier_id"="suppliers"\."supplier_id"/);
        assert.doesNotMatch(sql, /"supplier_id"="supplier_id"/);
        assert.match(sql, /and "is_active"/);
        assert.match(sql, /and "is_preferred"/);
        assert.match(sql, /in \('Draft','Sent','Partially Received'\)/);
    }
    assert.deepEqual(queries[0]!.params, []);
    assert.deepEqual(queries[1]!.params, [4, 1]);
});
