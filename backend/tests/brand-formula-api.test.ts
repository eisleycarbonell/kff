import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { BrandService } from '../src/modules/brands/brand.controller.ts';
import type { FormulaService } from '../src/modules/packing-formulas/packing-formula.controller.ts';
import type { RoleSettings } from '../src/db/schema.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';
process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'brand-formula-test-secret';
const { createApp } = await import('../src/app.ts');
const { generateToken } = await import('../src/utils/jwtHandler.ts');
const userService: UserService = {
    listUsers: async () => [],
    getUserByID: async () => null,
    createUser: async () => {
        throw new Error('Unused');
    },
    updateUser: async () => null,
    deleteUser: async () => null,
};
const brand = {
    brandId: 1,
    code: 'KFF',
    name: 'KFF',
    description: null,
    isActive: true,
    itemCount: 0,
    createdBy: 7,
    updatedBy: 7,
    createdAt: new Date(),
    updatedAt: new Date(),
};
const formula = {
    itemId: 10,
    itemSku: 'FG',
    itemName: 'Finished',
    isActive: true,
    labelItemName: null,
    primaryUomId: 2,
    primaryUomName: 'pc',
    componentCount: 1,
    components: [
        {
            bomId: 1,
            componentItemId: 1,
            componentSku: 'RM',
            componentName: 'Raw',
            componentIsActive: true,
            quantity: '0.100000',
            uomId: 1,
            uomName: 'kg',
        },
    ],
    createdBy: 7,
    updatedBy: 7,
    createdAt: new Date(),
    updatedAt: new Date(),
};
function services() {
    return {
        brandService: {
            listBrands: async () => [brand],
            getBrand: async () => brand,
            createBrand: async (input, actor) => ({
                ...brand,
                ...input,
                description: input.description ?? null,
                createdBy: actor,
            }),
            updateBrand: async (_id, input, actor) => ({ ...brand, ...input, updatedBy: actor }),
        } satisfies BrandService,
        formulaService: {
            listFormulas: async () => [formula],
            getFormula: async () => formula,
            getFormulaOptions: async () => ({ products: [], components: [], uoms: [] }),
            createFormula: async () => formula,
            updateFormula: async () => formula,
            removeFormula: async () => true,
        } satisfies FormulaService,
    };
}
async function withApi(
    permissions: RoleSettings,
    run: (base: string, token: string) => Promise<void>,
    overrides: Partial<ReturnType<typeof services>> = {},
) {
    const server = createApp({
        userService,
        ...services(),
        ...overrides,
        authService: {
            login: async () => null,
            getSessionUser: async () => ({
                userId: 7,
                firstName: 'Test',
                lastName: 'Manager',
                email: 'test@example.test',
                roleId: 1,
                permissions,
            }),
        },
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    try {
        await run(`http://127.0.0.1:${address.port}/api`, await generateToken({ id: '7' }, '5m'));
    } finally {
        await new Promise<void>((resolve) => {
            server.close(() => resolve());
            server.closeAllConnections();
        });
    }
}
const request = (method: string, token: string, body?: unknown): RequestInit => ({
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
});
test('retired brands API is unavailable for reads and writes', async () => {
    await withApi({ canManageInventory: true }, async (base, token) => {
        for (const [path, method] of [
            ['/brands', 'GET'],
            ['/brands/1', 'GET'],
            ['/brands', 'POST'],
            ['/brands/1', 'PATCH'],
        ]) {
            const response = await fetch(
                base + path,
                request(method, token, method === 'GET' ? undefined : {}),
            );
            assert.equal(response.status, 404);
            await response.json();
        }
    });
});
test('formula reads authenticate and writes retain independent packing permissions', async () => {
    await withApi({}, async (base, token) => {
        for (const path of [
            '/packing-formulas',
            '/packing-formulas/options',
            '/packing-formulas/10',
        ]) {
            const anonymous = await fetch(base + path);
            assert.equal(anonymous.status, 401);
            await anonymous.json();
            const response = await fetch(base + path, request('GET', token));
            assert.equal(response.status, 200);
            await response.json();
        }
        const denied = await fetch(base + '/packing-formulas', request('POST', token, {}));
        assert.equal(denied.status, 403);
        await denied.json();
    });
});
test('formula inputs validate and use authenticated audit identities', async () => {
    let actor = 0;
    const provided = services();
    provided.formulaService.createFormula = async (_body, id) => {
        actor = id;
        return formula;
    };
    await withApi(
        { canManagePacking: true },
        async (base, token) => {
            const response = await fetch(
                base + '/packing-formulas',
                request('POST', token, {
                    itemId: 10,
                    components: [{ componentItemId: 1, uomId: 1, quantity: '0.1' }],
                }),
            );
            assert.equal(response.status, 201);
            await response.json();
            assert.equal(actor, 7);
            const invalid = await fetch(
                base + '/packing-formulas',
                request('POST', token, { itemId: 10, components: [], createdBy: 2 }),
            );
            assert.equal(invalid.status, 400);
            await invalid.json();
        },
        provided,
    );
});
