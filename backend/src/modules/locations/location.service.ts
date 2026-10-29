import { asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
    locations,
    inventoryStock,
    inventoryReservations,
    inventoryTransactions,
    packingOrders,
    stockTransfers,
} from '../../db/schema.ts';
import type { CreateLocationInput, UpdateLocationInput } from './location.schema.ts';
import { assertLocationChange, assertActiveLocation } from './location.rules.ts';
type Reader = Pick<typeof db, 'select'>;
const isInUse = sql<boolean>`(
 exists(select 1 from ${inventoryStock} where ${inventoryStock.locationId}=${locations.locationId}) or
 exists(select 1 from ${inventoryReservations} where ${inventoryReservations.locationId}=${locations.locationId}) or
 exists(select 1 from ${inventoryTransactions} where ${inventoryTransactions.locationId}=${locations.locationId}) or
 exists(select 1 from ${packingOrders} where ${packingOrders.sourceLocationId}=${locations.locationId} or ${packingOrders.destinationLocationId}=${locations.locationId}) or
 exists(select 1 from ${stockTransfers} where ${stockTransfers.sourceLocationId}=${locations.locationId} or ${stockTransfers.destinationLocationId}=${locations.locationId})
)`;
const hasOperationalActivity = sql<boolean>`(
 exists(select 1 from ${inventoryStock} where ${inventoryStock.locationId}=${locations.locationId} and ${inventoryStock.qtyOnHand}>0) or
 exists(select 1 from ${inventoryReservations} where ${inventoryReservations.locationId}=${locations.locationId} and ${inventoryReservations.releasedAt} is null and ${inventoryReservations.qtyReserved}>${inventoryReservations.qtyConsumed}) or
 exists(select 1 from ${packingOrders} where (${packingOrders.sourceLocationId}=${locations.locationId} or ${packingOrders.destinationLocationId}=${locations.locationId}) and ${packingOrders.status} in ('Draft','Planned','In Progress')) or
 exists(select 1 from ${stockTransfers} where (${stockTransfers.sourceLocationId}=${locations.locationId} or ${stockTransfers.destinationLocationId}=${locations.locationId}) and ${stockTransfers.status} in ('Draft','In Transit'))
)`;
const fields = {
    locationId: locations.locationId,
    code: locations.code,
    name: locations.name,
    locationType: locations.locationType,
    isActive: locations.isActive,
    isInUse,
    hasOperationalActivity,
    createdBy: locations.createdBy,
    createdAt: locations.createdAt,
    updatedBy: locations.updatedBy,
    updatedAt: locations.updatedAt,
};
export async function listLocations() {
    return db.select(fields).from(locations).orderBy(asc(locations.name), asc(locations.code));
}
export async function getLocation(
    id: number,
    database: Reader = db,
): Promise<Awaited<ReturnType<typeof listLocations>>[number] | null> {
    const [location] = await database
        .select(fields)
        .from(locations)
        .where(eq(locations.locationId, id))
        .limit(1);
    return location ?? null;
}
// Intentional service boundary for inventory writers. Supply their transaction
// so the lock remains held until stock and ledger changes commit or roll back.
export async function requireActiveLocation(database: Reader, id: number) {
    const [location] = await database
        .select({ locationId: locations.locationId, isActive: locations.isActive })
        .from(locations)
        .where(eq(locations.locationId, id))
        .for('key share');
    assertActiveLocation(location);
    return location!;
}
export async function createLocation(input: CreateLocationInput, actorId: number) {
    return db.transaction(async (tx) => {
        const [created] = await tx
            .insert(locations)
            .values({ ...input, createdBy: actorId, updatedBy: actorId })
            .returning({ id: locations.locationId });
        if (!created) throw new Error('The location could not be created.');
        const saved = await getLocation(created.id, tx);
        if (!saved) throw new Error('The saved location could not be loaded.');
        return saved;
    });
}
export async function updateLocation(id: number, input: UpdateLocationInput, actorId: number) {
    return db.transaction(async (tx) => {
        const [locked] = await tx
            .select({ id: locations.locationId })
            .from(locations)
            .where(eq(locations.locationId, id))
            .for('update');
        if (!locked) return null;
        const current = await getLocation(id, tx);
        if (!current) return null;
        assertLocationChange(current, {
            locationType: input.locationType ?? current.locationType,
            isActive: input.isActive ?? current.isActive,
        });
        await tx
            .update(locations)
            .set({ ...input, updatedBy: actorId, updatedAt: new Date() })
            .where(eq(locations.locationId, id));
        return getLocation(id, tx);
    });
}
