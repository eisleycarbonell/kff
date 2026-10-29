import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { UomService } from '../src/modules/uoms/uom.controller.ts';
import type { LocationService } from '../src/modules/locations/location.controller.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';
import type { SessionUser } from '../src/modules/auth/auth.schema.ts';
import { AppError } from '../src/errors/app-error.ts';
process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-master-data-signing-key-not-for-deployment';
const { createApp } = await import('../src/app.ts');
const { generateToken } = await import('../src/utils/jwtHandler.ts');
const manager: SessionUser = {
    userId: 7,
    firstName: 'Maria',
    lastName: 'Santos',
    email: 'manager@example.com',
    roleId: 2,
    permissions: { canManageInventory: true },
};
const audit = {
    createdBy: 7,
    updatedBy: 7,
    createdAt: new Date('2026-10-27T00:00:00Z'),
    updatedAt: new Date('2026-10-27T00:00:00Z'),
};
const unit = {
    uomId: 1,
    name: 'kg',
    uomClassId: 1,
    uomClassName: 'Mass',
    factorToBase: '1.00000000',
    isBase: true,
    isInUse: false,
    isClassAnchor: false,
    ...audit,
};
const group = { uomClassId: 1, name: 'Mass', unitCount: 1, baseUomName: 'kg', ...audit };
const location = {
    locationId: 1,
    code: 'WH-1',
    name: 'Main warehouse',
    locationType: 'Warehouse' as const,
    isActive: true,
    isInUse: false,
    hasOperationalActivity: false,
    ...audit,
};
const users: UserService = {
    listUsers: async () => [],
    getUserByID: async () => null,
    createUser: async () => {
        throw new Error('Unused');
    },
    updateUser: async () => null,
    deleteUser: async () => null,
};
function fakeUoms(overrides: Partial<UomService> = {}): UomService {
    return {
        listUoms: async () => [unit],
        getUom: async () => unit,
        listUomClasses: async () => [group],
        createUom: async (input, actor) => ({
            ...unit,
            ...input,
            createdBy: actor,
            updatedBy: actor,
        }),
        updateUom: async (_id, input, actor) => ({ ...unit, ...input, updatedBy: actor }),
        deleteUom: async () => ({ uomId: 1 }),
        createUomClass: async (input, actor) => ({
            ...group,
            ...input,
            unitCount: 0,
            baseUomName: null,
            createdBy: actor,
            updatedBy: actor,
        }),
        updateUomClass: async (_id, input, actor) => ({ ...group, ...input, updatedBy: actor }),
        deleteUomClass: async () => ({ uomClassId: 1 }),
        ...overrides,
    };
}
function fakeLocations(overrides: Partial<LocationService> = {}): LocationService {
    return {
        listLocations: async () => [location],
        getLocation: async () => location,
        createLocation: async (input, actor) => ({
            ...location,
            ...input,
            createdBy: actor,
            updatedBy: actor,
        }),
        updateLocation: async (_id, input, actor) => ({ ...location, ...input, updatedBy: actor }),
        ...overrides,
    };
}
const json = (method: string, body: unknown, token: string): RequestInit => ({
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});
async function withApi(
    run: (origin: string, token: string) => Promise<void>,
    options: { uoms?: UomService; locations?: LocationService; viewer?: boolean } = {},
) {
    const user = options.viewer
        ? { ...manager, permissions: { canManageInventory: false } }
        : manager;
    const server = createApp({
        userService: users,
        uomService: options.uoms ?? fakeUoms(),
        locationService: options.locations ?? fakeLocations(),
        authService: {
            login: async () => user,
            getSessionUser: async (id) => (id === 7 ? user : null),
        },
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    try {
        await run('http://127.0.0.1:' + address.port, await generateToken({ id: '7' }, '5m'));
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
        });
    }
}
const unitInput = { name: ' g ', uomClassId: 1, factorToBase: '0.00100000', isBase: false };
const locationInput = { code: ' branch-1 ', name: ' Main branch ', locationType: 'Branch' };
test('master data reads require a session and preserve complete public DTOs', async () =>
    withApi(async (origin, token) => {
        for (const [path, data] of [
            ['/uoms', [unit]],
            ['/uoms/classes', [group]],
            ['/locations', [location]],
        ] as const) {
            const anonymous = await fetch(origin + '/api' + path);
            assert.equal(anonymous.status, 401);
            await anonymous.json();
            const response = await fetch(origin + '/api' + path, {
                headers: { Authorization: 'Bearer ' + token },
            });
            assert.equal(response.status, 200);
            assert.deepEqual((await response.json()).data, JSON.parse(JSON.stringify(data)));
        }
    }));
test('view-only accounts can read master data but cannot write units, classes, or locations', async () =>
    withApi(
        async (origin, token) => {
            const read = await fetch(origin + '/api/locations', {
                headers: { Authorization: 'Bearer ' + token },
            });
            assert.equal(read.status, 200);
            await read.json();
            for (const [path, method, body] of [
                ['/uoms', 'POST', unitInput],
                ['/uoms/1', 'PATCH', { name: 'g' }],
                ['/uoms/1', 'DELETE', undefined],
                ['/uoms/classes', 'POST', { name: 'Mass' }],
                ['/uoms/classes/1', 'PATCH', { name: 'Weight' }],
                ['/uoms/classes/1', 'DELETE', undefined],
                ['/locations', 'POST', locationInput],
                ['/locations/1', 'PATCH', { isActive: false }],
            ] as const) {
                const response = await fetch(origin + '/api' + path, json(method, body, token));
                assert.equal(response.status, 403, path);
                await response.json();
            }
        },
        { viewer: true },
    ));
test('creation validates fields, preserves exact factors, normalizes metadata and assigns server audit users', async () =>
    withApi(async (origin, token) => {
        const uom = await fetch(origin + '/api/uoms', json('POST', unitInput, token));
        assert.equal(uom.status, 201);
        const saved = (await uom.json()).data;
        assert.equal(saved.name, 'g');
        assert.equal(saved.factorToBase, '0.00100000');
        assert.equal(saved.createdBy, 7);
        const loc = await fetch(origin + '/api/locations', json('POST', locationInput, token));
        assert.equal(loc.status, 201);
        const savedLoc = (await loc.json()).data;
        assert.equal(savedLoc.code, 'BRANCH-1');
        assert.equal(savedLoc.name, 'Main branch');
        assert.equal(savedLoc.isActive, true);
        assert.equal(savedLoc.createdBy, 7);
        const cls = await fetch(
            origin + '/api/uoms/classes',
            json('POST', { name: ' Volume ' }, token),
        );
        assert.equal(cls.status, 201);
        assert.equal((await cls.json()).data.name, 'Volume');
        for (const [path, body] of [
            ['/uoms', { ...unitInput, createdBy: 99 }],
            ['/locations', { ...locationInput, qtyOnHand: '10' }],
            ['/locations', { ...locationInput, updatedBy: 99 }],
            ['/uoms/classes', { name: 'Volume', unitCount: 2 }],
        ] as const) {
            const result = await fetch(origin + '/api' + path, json('POST', body, token));
            assert.equal(result.status, 400);
            await result.json();
        }
    }));
test('PATCH passes only supplied fields, including false, without create defaults', async () => {
    const changes: unknown[] = [];
    await withApi(
        async (origin, token) => {
            for (const [path, body] of [
                ['/uoms/1', { name: 'Gram' }],
                ['/uoms/1', { isBase: false }],
                ['/locations/1', { isActive: false }],
                ['/locations/1', { isActive: true }],
                ['/uoms/classes/1', { name: 'Weight' }],
            ] as const) {
                const response = await fetch(origin + '/api' + path, json('PATCH', body, token));
                assert.equal(response.status, 200);
                await response.json();
            }
            assert.deepEqual(changes, [
                { name: 'Gram' },
                { isBase: false },
                { isActive: false },
                { isActive: true },
                { name: 'Weight' },
            ]);
        },
        {
            uoms: fakeUoms({
                updateUom: async (_id, input, actor) => {
                    assert.equal(actor, 7);
                    changes.push(input);
                    return { ...unit, ...input };
                },
                updateUomClass: async (_id, input) => {
                    changes.push(input);
                    return { ...group, ...input };
                },
            }),
            locations: fakeLocations({
                updateLocation: async (_id, input, actor) => {
                    assert.equal(actor, 7);
                    changes.push(input);
                    return { ...location, ...input };
                },
            }),
        },
    );
});
test('invalid IDs, empty patches, and unknown fields stop before services; missing resources return 404', async () =>
    withApi(
        async (origin, token) => {
            for (const path of [
                '/uoms/0',
                '/uoms/2147483648',
                '/uoms/classes/1e2',
                '/locations/1.5',
            ]) {
                const result = await fetch(
                    origin + '/api' + path,
                    json('PATCH', { name: 'Changed' }, token),
                );
                assert.equal(result.status, 400, path);
                await result.json();
            }
            for (const path of ['/uoms/1', '/locations/1']) {
                const result = await fetch(origin + '/api' + path, json('PATCH', {}, token));
                assert.equal(result.status, 400);
                await result.json();
            }
            for (const path of ['/uoms/999', '/locations/999']) {
                const result = await fetch(origin + '/api' + path, {
                    headers: { Authorization: 'Bearer ' + token },
                });
                assert.equal(result.status, 404);
                await result.json();
                const patch = await fetch(
                    origin + '/api' + path,
                    json('PATCH', { name: 'Changed' }, token),
                );
                assert.equal(patch.status, 404);
                await patch.json();
            }
            const noDelete = await fetch(
                origin + '/api/locations/1',
                json('DELETE', undefined, token),
            );
            assert.equal(noDelete.status, 404);
            await noDelete.json();
        },
        {
            uoms: fakeUoms({ getUom: async () => null, updateUom: async () => null }),
            locations: fakeLocations({
                getLocation: async () => null,
                updateLocation: async () => null,
            }),
        },
    ));
test('unused units and empty classes delete with 204; missing deletes return 404', async () =>
    withApi(
        async (origin, token) => {
            for (const path of ['/uoms/1', '/uoms/classes/1']) {
                const result = await fetch(
                    origin + '/api' + path,
                    json('DELETE', undefined, token),
                );
                assert.equal(result.status, 204);
                assert.equal(await result.text(), '');
            }
            for (const path of ['/uoms/999', '/uoms/classes/999']) {
                const result = await fetch(
                    origin + '/api' + path,
                    json('DELETE', undefined, token),
                );
                assert.equal(result.status, 404);
                await result.json();
            }
        },
        {
            uoms: fakeUoms({
                deleteUom: async (id) => (id === 1 ? { uomId: id } : null),
                deleteUomClass: async (id) => (id === 1 ? { uomClassId: id } : null),
            }),
        },
    ));
test('protected changes keep safe conflict messages and shared database failures hide private details', async () =>
    withApi(
        async (origin, token) => {
            const busy = await fetch(
                origin + '/api/locations/1',
                json('PATCH', { isActive: false }, token),
            );
            assert.equal(busy.status, 409);
            assert.match((await busy.json()).error.message, /open work/);
            const locked = await fetch(
                origin + '/api/uoms/1',
                json('PATCH', { factorToBase: '2' }, token),
            );
            assert.equal(locked.status, 409);
            assert.match((await locked.json()).error.message, /referenced/);
            const duplicate = await fetch(
                origin + '/api/uoms/classes',
                json('POST', { name: 'Mass' }, token),
            );
            assert.equal(duplicate.status, 409);
            assert.doesNotMatch(JSON.stringify(await duplicate.json()), /private|SQL/);
        },
        {
            locations: fakeLocations({
                updateLocation: async () => {
                    throw new AppError(409, 'Finish open work first.');
                },
            }),
            uoms: fakeUoms({
                updateUom: async () => {
                    throw new AppError(409, 'Unit is referenced.');
                },
                createUomClass: async () => {
                    throw new Error('private SQL', {
                        cause: { code: '23505', detail: 'private class' },
                    });
                },
            }),
        },
    ));
