import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sql, type SQL } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { listLocations } from '../src/modules/locations/location.service.ts';
import { listUomClasses } from '../src/modules/uoms/uom.service.ts';

// Compile the service's real projection without executing or opening a DB connection.
function captureProjection() {
    let statement = '';
    const reader = {
        select(fields: Record<string, SQL>) {
            return {
                from(table: never) {
                    return {
                        orderBy() {
                            statement = db.select(fields).from(table).toSQL().sql;
                            return [];
                        },
                    };
                },
            };
        },
    };
    return { reader: reader as never, statement: () => statement };
}
test('location lifecycle flags retain the outer location reference in single-table SQL', async () => {
    const capture = captureProjection();
    await listLocations(capture.reader);
    assert.match(capture.statement(), /"location_id"="locations"\."location_id"/);
    assert.doesNotMatch(capture.statement(), /"location_id"="location_id"/);
});
test('unit-class counts and base names correlate only to the selected outer class', async () => {
    const capture = captureProjection();
    await listUomClasses(capture.reader);
    assert.equal(
        (capture.statement().match(/"uom_class_id"="uom_classes"\."uom_class_id"/g) ?? []).length,
        2,
    );
    assert.doesNotMatch(capture.statement(), /"uom_class_id"="uom_class_id"/);
});
