import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
    lots,
    locations,
    inventoryStock,
    inventoryReservations,
    inventoryTransactions,
    scrapReasonCodes,
} from '../../db/schema.ts';
import { requireActiveLocation } from '../locations/location.service.ts';
import { outstandingReservations } from '../inventory-stocks/inventory-stock.rules.ts';
import { AppError } from '../../errors/app-error.ts';
import { checkedBalance } from './inventory-control.rules.ts';
export type ControlTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function lockControlStock(
    tx: ControlTransaction,
    lotIds: number[],
    locationIds: number[],
) {
    const orderedLots = [...new Set(lotIds)].sort((a, b) => a - b);
    const lockedLots = await tx
        .select()
        .from(lots)
        .where(inArray(lots.lotId, orderedLots))
        .orderBy(asc(lots.lotId))
        .for('update');
    if (lockedLots.length !== orderedLots.length) throw new AppError(400, 'Select existing lots.');
    const lockedLocations = [];
    for (const locationId of [...new Set(locationIds)].sort((a, b) => a - b)) {
        await requireActiveLocation(tx, locationId);
        const [location] = await tx
            .select()
            .from(locations)
            .where(eq(locations.locationId, locationId));
        if (location!.locationType === 'In Transit')
            throw new AppError(
                409,
                'Use the owning transfer or delivery workflow for In Transit stock.',
            );
        lockedLocations.push(location!);
    }
    const balances = await tx
        .select()
        .from(inventoryStock)
        .where(
            and(
                inArray(inventoryStock.lotId, orderedLots),
                inArray(inventoryStock.locationId, locationIds),
            ),
        )
        .orderBy(asc(inventoryStock.lotId), asc(inventoryStock.locationId))
        .for('update');
    const reservations = await tx
        .select()
        .from(inventoryReservations)
        .where(
            and(
                inArray(inventoryReservations.lotId, orderedLots),
                inArray(inventoryReservations.locationId, locationIds),
            ),
        )
        .orderBy(asc(inventoryReservations.reservationId))
        .for('update');
    const balance = (lotId: number, locationId: number) =>
        balances.find((row) => row.lotId === lotId && row.locationId === locationId)?.qtyOnHand ??
        '0.0000';
    const reserved = (lotId: number, locationId: number) =>
        outstandingReservations(
            reservations.filter((row) => row.lotId === lotId && row.locationId === locationId),
        );
    return { lots: lockedLots, locations: lockedLocations, balance, reserved };
}
export async function requireReason(tx: ControlTransaction, id: number, adjustment: boolean) {
    const [reason] = await tx
        .select()
        .from(scrapReasonCodes)
        .where(eq(scrapReasonCodes.reasonId, id))
        .for('share');
    if (
        !reason?.isActive ||
        (adjustment
            ? reason.category !== 'Inventory Adjustment'
            : reason.category === 'Inventory Adjustment')
    )
        throw new AppError(
            400,
            adjustment
                ? 'Choose an active Inventory Adjustment reason.'
                : 'Choose an active disposal/disposition reason outside Inventory Adjustment.',
        );
    return reason;
}
export async function postControlDelta(
    tx: ControlTransaction,
    input: {
        requestId: number;
        observationId?: number;
        lotId: number;
        itemId: number;
        locationId: number;
        current: string;
        reserved: string;
        change: string;
        type: 'Adjustment' | 'Scrap' | 'Transfer';
        reasonId: number;
        reference: string;
        actorId: number;
    },
) {
    const next = checkedBalance(input.current, input.reserved, input.change);
    await tx
        .insert(inventoryStock)
        .values({
            itemId: input.itemId,
            lotId: input.lotId,
            locationId: input.locationId,
            qtyOnHand: next,
        })
        .onConflictDoUpdate({
            target: [inventoryStock.lotId, inventoryStock.locationId],
            set: { qtyOnHand: next, lastUpdated: new Date() },
        });
    await tx.insert(inventoryTransactions).values({
        reviewRequestId: input.requestId,
        countObservationId: input.observationId ?? null,
        itemId: input.itemId,
        lotId: input.lotId,
        locationId: input.locationId,
        qtyChange: input.change,
        transactionType: input.type,
        reasonId: input.reasonId,
        referenceId: input.reference,
        authorizedByUserId: input.actorId,
    });
}
