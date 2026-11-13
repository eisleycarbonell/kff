import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { ControlService } from '../src/modules/inventory-controls/inventory-control.controller.ts';
import type { SessionUser } from '../src/modules/auth/auth.schema.ts';
import { createControlSchema } from '../src/modules/inventory-controls/inventory-control.schema.ts';
import {
    assertActiveControlKind,
    assertReview,
    checkedBalance,
} from '../src/modules/inventory-controls/inventory-control.rules.ts';
process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-controls-key';
const { createApp } = await import('../src/app.ts'),
    { generateToken } = await import('../src/utils/jwtHandler.ts');
test('control API enforces operational and reviewer permissions and derives actor identity', async () => {
    let current: SessionUser = {
        userId: 9,
        firstName: 'Control',
        lastName: 'Tester',
        email: 'test@example.com',
        roleId: 1,
        permissions: {},
    };
    let writes = 0;
    const header = {
        requestId: 1,
        requestNumber: 'R1',
        kind: 'Scrap',
        status: 'Submitted',
        notes: 'Count evidence',
        evidenceReference: null,
        createdBy: 2,
        submittedBy: 2,
        submittedAt: new Date(),
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy: 2,
    };
    const detail = {
        ...header,
        count: null,
        disposal: null,
        qc: null,
        formula: null,
        observations: [],
        materials: [],
        events: [],
    };
    const service: ControlService = {
        listControls: async () => [header],
        getControl: async () => detail,
        getControlOptions: async () => ({
            items: [],
            lots: [],
            locations: [],
            uoms: [],
            reasons: [],
            stocks: [],
        }),
        createControl: async (_v, actor) => {
            assert.equal(actor, 9);
            writes++;
            return detail;
        },
        saveCountObservations: async () => {
            writes++;
            return detail;
        },
        actOnControl: async (_id, _v, actor) => {
            assert.equal(actor, 9);
            writes++;
            return detail;
        },
    };
    const server = createApp({
        userService: {
            listUsers: async () => [],
            getUserByID: async () => null,
            createUser: async () => {
                throw new Error('unused');
            },
            updateUser: async () => null,
            deleteUser: async () => null,
        },
        authService: { login: async () => current, getSessionUser: async () => current },
        controlService: service,
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}/api/inventory-controls`,
        cookie = 'jwt=' + (await generateToken({ id: '9' }, '5m'));
    const post = (path: string, body: unknown) =>
        fetch(base + path, {
            method: 'POST',
            headers: { cookie, 'content-type': 'application/json' },
            body: JSON.stringify(body),
        });
    try {
        assert.equal((await fetch(base)).status, 401);
        assert.equal((await fetch(base, { headers: { cookie } })).status, 200);
        const count = {
            kind: 'Scrap',
            requestNumber: 'COUNT-1',
            notes: 'Observed physical count',
            lotId: 1,
            sourceLocationId: 1,
            reasonId: 1,
            quantity: '1',
            expectedQty: '10',
        };
        assert.equal((await post('', count)).status, 403);
        current = { ...current, permissions: { canManageInventory: true } };
        assert.equal((await post('', count)).status, 201);
        assert.equal(
            (await post('/1/actions', { action: 'approve', reviewNote: 'Independent review' }))
                .status,
            403,
        );
        current = { ...current, permissions: { canManageUsers: true } };
        assert.equal(
            (await post('/1/actions', { action: 'approve', reviewNote: 'Independent review' }))
                .status,
            403,
        );
        current = { ...current, permissions: { canManageUsers: true, canManageInventory: true } };
        assert.equal(
            (await post('/1/actions', { action: 'approve', reviewNote: 'Independent review' }))
                .status,
            200,
        );
        const beforeRetired = writes;
        const retired = [
            { kind: 'Count', locationId: 1, reasonId: 1, lotIds: [1] },
            {
                kind: 'QC',
                lotId: 1,
                previousStatus: 'Quarantine',
                newStatus: 'Approved',
                evidenceReference: 'LAB-1',
            },
            {
                kind: 'Disposition',
                lotId: 1,
                sourceLocationId: 1,
                destinationLocationId: 2,
                reasonId: 1,
                quantity: '1',
                expectedQty: '10',
            },
        ];
        for (const body of retired) {
            assert.equal(
                (await post('', { requestNumber: 'OLD', notes: 'Retired workflow', ...body }))
                    .status,
                409,
            );
            header.kind = body.kind;
            detail.kind = body.kind;
            assert.equal((await fetch(base + '/1', { headers: { cookie } })).status, 200);
            for (const action of ['submit', 'approve', 'reject', 'cancel', 'reopen'])
                assert.equal(
                    (await post('/1/actions', { action, reviewNote: 'Retired workflow' })).status,
                    409,
                );
        }
        assert.equal(
            (
                await fetch(base + '/1/observations', {
                    method: 'PATCH',
                    headers: { cookie, 'content-type': 'application/json' },
                    body: JSON.stringify({
                        observations: [{ observationId: 1, countedQty: '10' }],
                    }),
                })
            ).status,
            409,
        );
        assert.equal(writes, beforeRetired);
        header.kind = 'Scrap';
        detail.kind = 'Scrap';
        const before = writes;
        for (const body of [
            { ...count, createdBy: 9 },
            { ...count, lotIds: [1, 1] },
            { ...count, lotIds: [] },
            { ...count, locationId: -1 },
        ])
            assert.equal((await post('', body)).status, 400);
        assert.equal(writes, before);
        const formula = {
            kind: 'Formula',
            requestNumber: 'F1',
            notes: 'Formula change',
            itemId: 1,
            effectiveDate: '2026-11-08',
            changeType: 'Replace',
            components: [{ componentItemId: 2, quantity: '1', uomId: 1 }],
        };
        assert.equal((await post('', formula)).status, 403);
        current = { ...current, permissions: { canManagePacking: true } };
        assert.equal((await post('', formula)).status, 201);
    } finally {
        await new Promise<void>((resolve) => {
            server.close(() => resolve());
            server.closeAllConnections();
        });
    }
});
test('control inputs reject fake approvals, invalid evidence and incompatible workflow shapes', () => {
    assert.equal(
        createControlSchema.safeParse({
            kind: 'QC',
            requestNumber: 'Q1',
            notes: 'Laboratory review',
            lotId: 1,
            previousStatus: 'Quarantine',
            newStatus: 'Approved',
        }).success,
        false,
    );
    assert.equal(
        createControlSchema.safeParse({
            kind: 'Formula',
            requestNumber: 'F1',
            notes: 'Remove formula',
            itemId: 1,
            effectiveDate: '2026-11-08',
            changeType: 'Retire',
            components: [{ componentItemId: 2, quantity: '1', uomId: 1 }],
        }).success,
        false,
    );
    assert.throws(() => assertReview('Submitted', 1, 2, 1), /different/);
    assert.throws(() => assertReview('Submitted', 1, 2, 2), /different/);
    assert.throws(() => assertReview('Approved', 1, 2, 3), /submitted/);
    assert.throws(() => checkedBalance('10', '8', '-3'), /reserved/);
    assert.equal(checkedBalance('10', '8', '-2'), '8.0000');
});

test('only scrap and formula review workflows accept writes', () => {
    for (const kind of ['Count', 'QC', 'Disposition'])
        assert.throws(() => assertActiveControlKind(kind), { status: 409 });
    assert.doesNotThrow(() => assertActiveControlKind('Scrap'));
    assert.doesNotThrow(() => assertActiveControlKind('Formula'));
});
