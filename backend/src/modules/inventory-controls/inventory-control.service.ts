import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
    reviewRequests,
    reviewEvents,
    countSessions,
    countObservations,
    inventoryDisposals,
    qcDecisions,
    formulaRevisions,
    formulaRevisionMaterials,
    items,
    lots,
    locations,
    uoms,
    scrapReasonCodes,
    inventoryStock,
    inventoryReservations,
    billOfMaterials,
} from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import {
    quantityUnits,
    quantityString,
    outstandingReservations,
} from '../inventory-stocks/inventory-stock.rules.ts';
import { assertLotMetadataChange } from '../lots/lot.rules.ts';
import {
    lockControlStock,
    postControlDelta,
    requireReason,
    type ControlTransaction,
} from './inventory-control.stock.ts';
import {
    assertActiveControlKind,
    assertExpected,
    assertReview,
    checkedBalance,
} from './inventory-control.rules.ts';
import type { CreateControlInput, ControlKind, ControlAction } from './inventory-control.schema.ts';
type Reader = Pick<typeof db, 'select'>;
const today = () => new Date().toISOString().slice(0, 10);
export async function listControls(kind?: ControlKind, database: Reader = db) {
    return database
        .select()
        .from(reviewRequests)
        .where(kind ? eq(reviewRequests.kind, kind) : undefined)
        .orderBy(desc(reviewRequests.requestId));
}
export async function getControl(id: number, database: Reader = db) {
    const [request] = await database
        .select()
        .from(reviewRequests)
        .where(eq(reviewRequests.requestId, id));
    if (!request) return null;
    const [session, disposal, qc, formula, observations, materials, events] = await Promise.all([
        database.select().from(countSessions).where(eq(countSessions.requestId, id)),
        database.select().from(inventoryDisposals).where(eq(inventoryDisposals.requestId, id)),
        database.select().from(qcDecisions).where(eq(qcDecisions.requestId, id)),
        database.select().from(formulaRevisions).where(eq(formulaRevisions.requestId, id)),
        database
            .select({
                observationId: countObservations.observationId,
                lotId: lots.lotId,
                lotNumber: lots.lotNumber,
                itemId: items.itemId,
                itemName: items.name,
                sku: items.sku,
                primaryUomName: uoms.name,
                expectedQty: countObservations.expectedQty,
                countedQty: countObservations.countedQty,
                observedBy: countObservations.observedBy,
                observedAt: countObservations.observedAt,
            })
            .from(countObservations)
            .innerJoin(lots, eq(lots.lotId, countObservations.lotId))
            .innerJoin(items, eq(items.itemId, lots.itemId))
            .innerJoin(uoms, eq(uoms.uomId, items.primaryUomId))
            .where(eq(countObservations.requestId, id))
            .orderBy(asc(countObservations.observationId)),
        database
            .select({
                materialId: formulaRevisionMaterials.materialId,
                componentItemId: items.itemId,
                sku: items.sku,
                itemName: items.name,
                quantity: formulaRevisionMaterials.quantity,
                uomId: uoms.uomId,
                uomName: uoms.name,
            })
            .from(formulaRevisionMaterials)
            .innerJoin(items, eq(items.itemId, formulaRevisionMaterials.componentItemId))
            .innerJoin(uoms, eq(uoms.uomId, formulaRevisionMaterials.uomId))
            .where(eq(formulaRevisionMaterials.requestId, id))
            .orderBy(asc(formulaRevisionMaterials.materialId)),
        database
            .select()
            .from(reviewEvents)
            .where(eq(reviewEvents.requestId, id))
            .orderBy(asc(reviewEvents.eventId)),
    ]);
    return {
        ...request,
        count: session[0] ?? null,
        disposal: disposal[0] ?? null,
        qc: qc[0] ?? null,
        formula: formula[0] ?? null,
        observations,
        materials,
        events,
    };
}
export async function getControlOptions(database: Reader = db) {
    const [itemRows, lotRows, locationRows, unitRows, reasons, stocks] = await Promise.all([
        database
            .select({
                itemId: items.itemId,
                name: items.name,
                sku: items.sku,
                itemType: items.itemType,
                primaryUomId: items.primaryUomId,
                isActive: items.isActive,
                uomClassId: uoms.uomClassId,
                primaryUomName: uoms.name,
            })
            .from(items)
            .innerJoin(uoms, eq(uoms.uomId, items.primaryUomId))
            .orderBy(asc(items.name)),
        database
            .select({
                lotId: lots.lotId,
                lotNumber: lots.lotNumber,
                itemId: lots.itemId,
                qcStatus: lots.qcStatus,
                expirationDate: lots.expirationDate,
            })
            .from(lots)
            .orderBy(asc(lots.lotNumber)),
        database.select().from(locations).orderBy(asc(locations.name)),
        database.select().from(uoms).orderBy(asc(uoms.name)),
        database.select().from(scrapReasonCodes).orderBy(asc(scrapReasonCodes.codeName)),
        database.select().from(inventoryStock),
    ]);
    return {
        items: itemRows,
        lots: lotRows,
        locations: locationRows,
        uoms: unitRows,
        reasons,
        stocks,
    };
}
async function event(
    tx: ControlTransaction,
    id: number,
    action: string,
    note: string,
    actorId: number,
    details: Record<string, unknown> = {},
) {
    await tx.insert(reviewEvents).values({ requestId: id, action, note, actorId, details });
}
async function lockFormulaDefinition(
    tx: ControlTransaction,
    itemId: number,
    components: { componentItemId: number; quantity: string; uomId: number }[],
) {
    const ids = [...new Set(components.map((row) => row.componentItemId))].sort((a, b) => a - b);
    const materials = ids.length
        ? await tx
              .select()
              .from(items)
              .where(inArray(items.itemId, ids))
              .orderBy(asc(items.itemId))
              .for('key share')
        : [];
    const [product] = await tx.select().from(items).where(eq(items.itemId, itemId)).for('update');
    if (!product?.isActive || product.itemType !== 'Finished Good')
        throw new AppError(400, 'Choose an active finished product.');
    const unitIds = [
        ...new Set([
            ...components.map((row) => row.uomId),
            ...materials.map((row) => row.primaryUomId),
        ]),
    ].sort((a, b) => a - b);
    const units = unitIds.length
        ? await tx
              .select()
              .from(uoms)
              .where(inArray(uoms.uomId, unitIds))
              .orderBy(asc(uoms.uomId))
              .for('share')
        : [];
    for (const component of components) {
        const material = materials.find((row) => row.itemId === component.componentItemId);
        const unit = units.find((row) => row.uomId === component.uomId);
        const primary = units.find((row) => row.uomId === material?.primaryUomId);
        if (
            !material?.isActive ||
            material.itemType === 'Finished Good' ||
            material.itemId === itemId ||
            !unit ||
            !primary ||
            unit.uomClassId !== primary.uomClassId
        )
            throw new AppError(
                400,
                'Every formula component must be active, distinct from its product, and use a compatible unit.',
            );
    }
}
export async function createControl(
    input: CreateControlInput,
    actorId: number,
    database: typeof db = db,
) {
    assertActiveControlKind(input.kind);
    return database.transaction(async (tx) => {
        let expectedQty = '0.0000';
        let previousStatus: typeof lots.$inferSelect.qcStatus = 'Quarantine';
        let revisionNumber = 0;
        let countExpected = new Map<number, string>();
        if (input.kind === 'Count') {
            const stock = await lockControlStock(tx, input.lotIds, [input.locationId]);
            await requireReason(tx, input.reasonId, true);
            countExpected = new Map(
                stock.lots.map((lot) => [lot.lotId, stock.balance(lot.lotId, input.locationId)]),
            );
        }
        if (input.kind === 'Scrap' || input.kind === 'Disposition') {
            const stock = await lockControlStock(
                tx,
                [input.lotId],
                input.kind === 'Disposition'
                    ? [input.sourceLocationId, input.destinationLocationId]
                    : [input.sourceLocationId],
            );
            await requireReason(tx, input.reasonId, false);
            expectedQty = stock.balance(input.lotId, input.sourceLocationId);
            assertExpected(expectedQty, input.expectedQty);
            if (input.kind === 'Disposition')
                assertDisposition(
                    stock.locations,
                    stock.lots[0]!.qcStatus,
                    input.sourceLocationId,
                    input.destinationLocationId,
                );
        }
        if (input.kind === 'QC') {
            const [lot] = await tx
                .select()
                .from(lots)
                .where(eq(lots.lotId, input.lotId))
                .for('update');
            if (!lot) throw new AppError(400, 'Select an existing lot.');
            if (lot.qcStatus !== input.previousStatus)
                throw new AppError(
                    409,
                    'QC status changed. Refresh before preparing the decision.',
                );
            previousStatus = lot.qcStatus;
        }
        if (input.kind === 'Formula') {
            await lockFormulaDefinition(tx, input.itemId, input.components);
            const [last] = await tx
                .select({
                    number: sql<number>`coalesce(max(${formulaRevisions.revisionNumber}),0)::integer`,
                })
                .from(formulaRevisions)
                .where(eq(formulaRevisions.itemId, input.itemId));
            revisionNumber = last!.number + 1;
        }
        const [request] = await tx
            .insert(reviewRequests)
            .values({
                requestNumber: input.requestNumber,
                kind: input.kind,
                notes: input.notes,
                evidenceReference: input.evidenceReference,
                createdBy: actorId,
                updatedBy: actorId,
            })
            .returning();
        const id = request!.requestId;
        if (input.kind === 'Count') {
            await tx
                .insert(countSessions)
                .values({ requestId: id, locationId: input.locationId, reasonId: input.reasonId });
            await tx.insert(countObservations).values(
                input.lotIds.map((lotId) => ({
                    requestId: id,
                    lotId,
                    expectedQty: countExpected.get(lotId)!,
                })),
            );
        }
        if (input.kind === 'Scrap' || input.kind === 'Disposition')
            await tx.insert(inventoryDisposals).values({
                requestId: id,
                lotId: input.lotId,
                sourceLocationId: input.sourceLocationId,
                destinationLocationId:
                    input.kind === 'Disposition' ? input.destinationLocationId : null,
                reasonId: input.reasonId,
                quantity: input.quantity,
                expectedQty,
            });
        if (input.kind === 'QC')
            await tx.insert(qcDecisions).values({
                requestId: id,
                lotId: input.lotId,
                previousStatus,
                newStatus: input.newStatus,
            });
        if (input.kind === 'Formula') {
            await tx.insert(formulaRevisions).values({
                requestId: id,
                itemId: input.itemId,
                revisionNumber,
                effectiveDate: input.effectiveDate,
                changeType: input.changeType,
            });
            if (input.components.length)
                await tx
                    .insert(formulaRevisionMaterials)
                    .values(input.components.map((row) => ({ ...row, requestId: id })));
        }
        await event(tx, id, 'create', input.notes, actorId);
        return (await getControl(id, tx))!;
    });
}
function assertDisposition(
    locations: { locationId: number; locationType: string }[],
    qcStatus: string,
    sourceId: number,
    destinationId: number,
) {
    const source = locations.find((row) => row.locationId === sourceId)!;
    const destination = locations.find((row) => row.locationId === destinationId)!;
    if (
        destination.locationType !== 'Quarantine' &&
        destination.locationType !== 'Scrap' &&
        !(
            destination.locationType === 'Warehouse' &&
            ['Quarantine', 'Scrap'].includes(source.locationType) &&
            qcStatus === 'Approved'
        )
    )
        throw new AppError(
            400,
            'Move stock into Quarantine/Scrap, or return approved held stock to a warehouse.',
        );
}
export async function saveCountObservations(
    id: number,
    input: { observations: { observationId: number; countedQty: string }[] },
    actorId: number,
    database: typeof db = db,
) {
    assertActiveControlKind('Count');
    return database.transaction(async (tx) => {
        const [request] = await tx
            .select()
            .from(reviewRequests)
            .where(eq(reviewRequests.requestId, id))
            .for('update');
        if (!request) return null;
        if (request.kind !== 'Count' || request.status !== 'Draft' || request.createdBy !== actorId)
            throw new AppError(409, 'Only the preparer can record observations on a draft count.');
        const lines = await tx
            .select()
            .from(countObservations)
            .where(eq(countObservations.requestId, id));
        for (const observation of input.observations) {
            if (!lines.some((row) => row.observationId === observation.observationId))
                throw new AppError(400, 'Observation does not belong to this count.');
            await tx
                .update(countObservations)
                .set({
                    countedQty: observation.countedQty,
                    observedBy: actorId,
                    observedAt: new Date(),
                })
                .where(eq(countObservations.observationId, observation.observationId));
        }
        await event(tx, id, 'observe', 'Count observations saved', actorId, {
            observations: input.observations,
        });
        await tx
            .update(reviewRequests)
            .set({ updatedBy: actorId, updatedAt: new Date() })
            .where(eq(reviewRequests.requestId, id));
        return getControl(id, tx);
    });
}
export async function actOnControl(
    id: number,
    input: ControlAction,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        const [request] = await tx
            .select()
            .from(reviewRequests)
            .where(eq(reviewRequests.requestId, id))
            .for('update');
        if (!request) return null;
        assertActiveControlKind(request.kind);
        const detail = (await getControl(id, tx))!;
        const review = input.action === 'approve' || input.action === 'reject';
        if (review) assertReview(request.status, request.createdBy, request.submittedBy, actorId);
        else if (request.createdBy !== actorId)
            throw new AppError(403, 'Only the preparer can submit, cancel or reopen this request.');
        let status: string = request.status;
        if (input.action === 'submit') {
            if (request.status !== 'Draft')
                throw new AppError(409, 'Only drafts can be submitted.');
            if (
                request.kind === 'Count' &&
                detail.observations.some((row) => row.countedQty === null)
            )
                throw new AppError(
                    400,
                    'Record every count observation, including unchanged counts.',
                );
            status = 'Submitted';
        }
        if (input.action === 'cancel') {
            if (!['Draft', 'Submitted', 'Rejected'].includes(request.status))
                throw new AppError(409, 'This request cannot be cancelled.');
            status = 'Cancelled';
        }
        if (input.action === 'reject') status = 'Rejected';
        if (input.action === 'reopen') {
            if (request.status !== 'Rejected')
                throw new AppError(409, 'Only rejected requests can be reopened.');
            if (request.kind === 'Count') {
                const stock = await lockControlStock(
                    tx,
                    detail.observations.map((row) => row.lotId),
                    [detail.count!.locationId],
                );
                for (const line of detail.observations)
                    await tx
                        .update(countObservations)
                        .set({
                            expectedQty: stock.balance(line.lotId, detail.count!.locationId),
                            countedQty: null,
                            observedBy: null,
                            observedAt: null,
                        })
                        .where(eq(countObservations.observationId, line.observationId));
            }
            if (detail.disposal) {
                const stock = await lockControlStock(
                    tx,
                    [detail.disposal.lotId],
                    [detail.disposal.sourceLocationId],
                );
                await tx
                    .update(inventoryDisposals)
                    .set({
                        expectedQty: stock.balance(
                            detail.disposal.lotId,
                            detail.disposal.sourceLocationId,
                        ),
                    })
                    .where(eq(inventoryDisposals.requestId, id));
            }
            if (detail.qc) {
                const [lot] = await tx
                    .select()
                    .from(lots)
                    .where(eq(lots.lotId, detail.qc.lotId))
                    .for('update');
                if (lot!.qcStatus === detail.qc.newStatus)
                    throw new AppError(409, 'The requested QC status is already current.');
                await tx
                    .update(qcDecisions)
                    .set({ previousStatus: lot!.qcStatus })
                    .where(eq(qcDecisions.requestId, id));
            }
            status = 'Draft';
        }
        if (input.action === 'approve') {
            if (request.kind === 'Count') {
                const session = detail.count!;
                const stock = await lockControlStock(
                    tx,
                    detail.observations.map((row) => row.lotId),
                    [session.locationId],
                );
                await requireReason(tx, session.reasonId, true);
                for (const line of detail.observations) {
                    if (line.countedQty === null || line.observedBy === actorId)
                        throw new AppError(
                            403,
                            'Every observation requires an independent counter.',
                        );
                    const current = stock.balance(line.lotId, session.locationId);
                    assertExpected(current, line.expectedQty);
                    const change = quantityUnits(line.countedQty) - quantityUnits(current);
                    checkedBalance(
                        current,
                        stock.reserved(line.lotId, session.locationId),
                        quantityString(change),
                    );
                    if (change !== 0n)
                        await postControlDelta(tx, {
                            requestId: id,
                            observationId: line.observationId,
                            itemId: line.itemId,
                            lotId: line.lotId,
                            locationId: session.locationId,
                            current,
                            reserved: stock.reserved(line.lotId, session.locationId),
                            change: quantityString(change),
                            type: 'Adjustment',
                            reasonId: session.reasonId,
                            reference: request.requestNumber,
                            actorId,
                        });
                }
            }
            if (request.kind === 'Scrap' || request.kind === 'Disposition') {
                const disposal = detail.disposal!;
                const stock = await lockControlStock(
                    tx,
                    [disposal.lotId],
                    disposal.destinationLocationId
                        ? [disposal.sourceLocationId, disposal.destinationLocationId]
                        : [disposal.sourceLocationId],
                );
                await requireReason(tx, disposal.reasonId, false);
                const lot = stock.lots[0]!;
                const current = stock.balance(lot.lotId, disposal.sourceLocationId);
                assertExpected(current, disposal.expectedQty);
                if (
                    request.kind === 'Disposition' &&
                    stock.locations.find((l) => l.locationId === disposal.destinationLocationId)
                        ?.locationType === 'Warehouse' &&
                    lot.expirationDate !== null &&
                    lot.expirationDate <= today()
                )
                    throw new AppError(409, 'Expired held stock cannot return to usable storage.');
                if (request.kind === 'Disposition')
                    assertDisposition(
                        stock.locations,
                        lot.qcStatus,
                        disposal.sourceLocationId,
                        disposal.destinationLocationId!,
                    );
                const common = {
                    requestId: id,
                    itemId: lot.itemId,
                    lotId: lot.lotId,
                    reasonId: disposal.reasonId,
                    reference: request.requestNumber,
                    actorId,
                };
                await postControlDelta(tx, {
                    ...common,
                    locationId: disposal.sourceLocationId,
                    current,
                    reserved: stock.reserved(lot.lotId, disposal.sourceLocationId),
                    change: quantityString(-quantityUnits(disposal.quantity)),
                    type: request.kind === 'Scrap' ? 'Scrap' : 'Transfer',
                });
                if (request.kind === 'Disposition')
                    await postControlDelta(tx, {
                        ...common,
                        locationId: disposal.destinationLocationId!,
                        current: stock.balance(lot.lotId, disposal.destinationLocationId!),
                        reserved: stock.reserved(lot.lotId, disposal.destinationLocationId!),
                        change: disposal.quantity,
                        type: 'Transfer',
                    });
            }
            if (request.kind === 'QC') {
                const decision = detail.qc!;
                const [lot] = await tx
                    .select()
                    .from(lots)
                    .where(eq(lots.lotId, decision.lotId))
                    .for('update');
                if (lot!.qcStatus !== decision.previousStatus)
                    throw new AppError(
                        409,
                        'QC status changed after preparation. Reject and reopen the decision.',
                    );
                const reservations = await tx
                    .select()
                    .from(inventoryReservations)
                    .where(eq(inventoryReservations.lotId, lot!.lotId))
                    .orderBy(asc(inventoryReservations.reservationId))
                    .for('update');
                assertLotMetadataChange(
                    lot!,
                    { ...lot!, qcStatus: decision.newStatus },
                    quantityUnits(outstandingReservations(reservations)),
                );
                if (
                    decision.newStatus === 'Approved' &&
                    lot!.expirationDate !== null &&
                    lot!.expirationDate <= today()
                )
                    throw new AppError(409, 'An expired lot cannot be approved for use.');
                await tx
                    .update(lots)
                    .set({
                        qcStatus: decision.newStatus,
                        updatedBy: actorId,
                        updatedAt: new Date(),
                    })
                    .where(eq(lots.lotId, lot!.lotId));
            }
            if (request.kind === 'Formula') {
                const revision = detail.formula!;
                if (revision.effectiveDate > today())
                    throw new AppError(
                        409,
                        'This revision cannot be released before its effective date.',
                    );
                await lockFormulaDefinition(tx, revision.itemId, detail.materials);
                const [newer] = await tx
                    .select({ id: formulaRevisions.requestId })
                    .from(formulaRevisions)
                    .innerJoin(
                        reviewRequests,
                        eq(reviewRequests.requestId, formulaRevisions.requestId),
                    )
                    .where(
                        and(
                            eq(formulaRevisions.itemId, revision.itemId),
                            eq(reviewRequests.status, 'Approved'),
                            sql`${formulaRevisions.revisionNumber}>${revision.revisionNumber}`,
                        ),
                    );
                if (newer) throw new AppError(409, 'A newer revision has already been released.');
                await tx
                    .delete(billOfMaterials)
                    .where(eq(billOfMaterials.parentItemId, revision.itemId));
                if (revision.changeType === 'Replace')
                    await tx.insert(billOfMaterials).values(
                        detail.materials.map((row) => ({
                            parentItemId: revision.itemId,
                            componentItemId: row.componentItemId,
                            quantity: row.quantity,
                            uomId: row.uomId,
                            revisionId: id,
                            createdBy: actorId,
                            updatedBy: actorId,
                        })),
                    );
            }
            status = 'Approved';
        }
        await tx
            .update(reviewRequests)
            .set({
                status,
                updatedBy: actorId,
                updatedAt: new Date(),
                ...(input.action === 'submit'
                    ? { submittedBy: actorId, submittedAt: new Date() }
                    : {}),
                ...(review
                    ? { reviewedBy: actorId, reviewedAt: new Date(), reviewNote: input.reviewNote }
                    : {}),
                ...(input.action === 'reopen'
                    ? {
                          submittedBy: null,
                          submittedAt: null,
                          reviewedBy: null,
                          reviewedAt: null,
                          reviewNote: null,
                      }
                    : {}),
            })
            .where(eq(reviewRequests.requestId, id));
        await event(
            tx,
            id,
            input.action,
            input.reviewNote,
            actorId,
            input.action === 'reopen'
                ? {
                      previousObservations: detail.observations,
                      previousSnapshot: detail.disposal ?? detail.qc ?? {},
                  }
                : {},
        );
        return getControl(id, tx);
    });
}
