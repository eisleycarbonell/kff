import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import postgres from 'postgres';
import { exportApplicationSchema } from '../src/db/test-database.ts';

const testUrl = process.env.TEST_DATABASE_URL;

test(
    'all module APIs and customer PO to purchase, partial receipt, packing, transfer and sale',
    { skip: !testUrl, timeout: 240000 },
    async () => {
        const schema = 'system_flow_' + randomBytes(8).toString('hex');
        const scoped = new URL(testUrl!);
        scoped.searchParams.set('search_path', schema);
        const admin = postgres(testUrl!, { max: 1, onnotice: () => {} });
        const client = postgres(scoped.toString(), { max: 1, onnotice: () => {} });
        // Each Node test file has its own process. Every real service, including
        // default-client list reads and authentication, stays in this test schema.
        process.env.DATABASE_URL = scoped.toString();
        process.env.DIRECT_URL = scoped.toString();
        process.env.JWT_SECRET = 'isolated-system-flow-test-signing-secret';
        process.env.LOG_LEVEL = 'silent';
        process.env.NODE_ENV = 'test';
        let server: import('node:http').Server | undefined;
        let database: typeof import('../src/db/index.ts').db | undefined;
        try {
            await admin.unsafe(`create schema "${schema}"`);
            await client.unsafe(await exportApplicationSchema());
            ({ db: database } = await import('../src/db/index.ts'));
            const { seedSampleData } = await import('../src/db/sample-data.ts');
            await seedSampleData({
                schemaName: schema,
                environment: { KFF_ALLOW_TEST_DATA: 'true' },
            });
            const specs = {
                userService: ['users', 'user'],
                authService: ['auth', 'auth'],
                roleService: ['roles', 'role'],
                itemService: ['items', 'item'],
                stockService: ['inventory-stocks', 'inventory-stock'],
                inventoryMovementService: ['inventory-movements', 'inventory-movement'],
                uomService: ['uoms', 'uom'],
                locationService: ['locations', 'location'],
                supplierService: ['suppliers', 'supplier'],
                customerService: ['customers', 'customer'],
                purchaseOrderService: ['purchase-orders', 'purchase-order'],
                receivingService: ['receiving', 'receiving'],
                lotService: ['lots', 'lot'],
                packingOrderService: ['packing-orders', 'packing-order'],
                transferService: ['transfers', 'transfer'],
                dashboardService: ['dashboard', 'dashboard'],
                salesOrderService: ['sales-orders', 'sales-order'],
                deliveryOrderService: ['delivery-orders', 'delivery-order'],
                formulaService: ['packing-formulas', 'packing-formula'],
                inventoryReportService: ['inventory-reports', 'inventory-report'],
                settingsService: ['company-settings', 'company-setting'],
                reasonCodeService: ['reason-codes', 'reason-code'],
                itemPackageService: ['item-packaging', 'item-package'],
                reorderPolicyService: ['reorder-policies', 'reorder-policy'],
                controlService: ['inventory-controls', 'inventory-control'],
                operationalReportService: ['operational-reports', 'operational-report'],
            };
            const services = Object.fromEntries(
                await Promise.all(
                    Object.entries(specs).map(async ([key, [folder, file]]) => [
                        key,
                        await import(`../src/modules/${folder}/${file}.service.ts`),
                    ]),
                ),
            );
            const { createApp } = await import('../src/app.ts');
            server = createApp(services as Parameters<typeof createApp>[0]).listen(0, '127.0.0.1');
            await new Promise<void>((resolve) => server!.once('listening', resolve));
            const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
            const cookies = new Map<string, string>();
            const request = async (
                path: string,
                method = 'GET',
                body?: unknown,
                role = 'demo',
                status = 200,
            ) => {
                const response = await fetch(base + path, {
                    method,
                    headers: {
                        'content-type': 'application/json',
                        ...(cookies.has(role) ? { cookie: cookies.get(role)! } : {}),
                    },
                    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
                    signal: AbortSignal.timeout(20000),
                });
                const result = await response.json();
                assert.equal(
                    response.status,
                    status,
                    `${method} ${path}: ${JSON.stringify(result)}`,
                );
                assert.equal(result.success, status < 400, `${method} ${path}`);
                return result.data;
            };
            const login = async (role: string) => {
                const response = await fetch(base + '/auth/login', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        username: role + '@spice.local',
                        password: 'KffDemo123!',
                    }),
                });
                assert.equal(response.status, 200);
                cookies.set(
                    role,
                    response.headers
                        .getSetCookie()
                        .map((value) => value.split(';')[0])
                        .join('; '),
                );
            };
            for (const role of ['demo', 'warehouse', 'purchasing', 'viewer']) await login(role);
            const dto = async (file: string, name: string, value: unknown, array = false) => {
                const definition = (
                    await import(`../../frontend/src/components/modules/${file}.schema.ts`)
                )[name];
                (array ? definition.array() : definition).parse(value);
            };
            const reads: [string, string, string, boolean?][] = [
                ['/items', 'items/item', 'itemSchema', true],
                ['/uoms', 'uoms/uom', 'uomSchema', true],
                ['/uoms/classes', 'uoms/uom', 'uomClassSchema', true],
                ['/locations', 'locations/location', 'locationSchema', true],
                ['/suppliers', 'suppliers/supplier', 'supplierSchema', true],
                ['/customers', 'customers/customer', 'customerSchema', true],
                ['/user', 'users/user', 'userSchema', true],
                ['/roles', 'roles/role', 'roleSchema', true],
                ['/purchase-orders', 'purchase-orders/purchase-order', 'purchaseOrderSchema', true],
                [
                    '/purchase-orders/options',
                    'purchase-orders/purchase-order',
                    'purchaseOrderOptionsSchema',
                ],
                ['/receiving', 'receiving/receiving', 'receivingReceiptSchema', true],
                ['/receiving/options', 'receiving/receiving', 'receivingOptionsSchema'],
                ['/lots', 'lots/lot', 'lotSchema', true],
                ['/inventory/stocks', 'inventory-stocks/inventory-stock', 'stockSchema', true],
                [
                    '/inventory/stocks/options',
                    'inventory-stocks/inventory-stock',
                    'stockOptionsSchema',
                ],
                [
                    '/inventory/movements',
                    'inventory-movements/inventory-movement',
                    'inventoryMovementSchema',
                    true,
                ],
                ['/packing-orders', 'packing-orders/packing-order', 'packingOrderSchema', true],
                ['/packing-orders/options', 'packing-orders/packing-order', 'packingOptionsSchema'],
                [
                    '/packing-orders/reservations',
                    'packing-orders/packing-order',
                    'reservationSchema',
                    true,
                ],
                ['/transfers', 'transfers/transfer', 'transferSchema', true],
                ['/transfers/options', 'transfers/transfer', 'transferOptionsSchema'],
                ['/sales-orders', 'sales-orders/sales-order', 'salesOrderSchema', true],
                ['/sales-orders/options', 'sales-orders/sales-order', 'salesOrderOptionsSchema'],
                ['/delivery-orders', 'delivery-orders/delivery-order', 'deliveryOrderSchema', true],
                [
                    '/delivery-orders/options',
                    'delivery-orders/delivery-order',
                    'deliveryOrderOptionsSchema',
                ],
                ['/packing-formulas', 'packing-formulas/packing-formula', 'formulaSchema', true],
                [
                    '/packing-formulas/options',
                    'packing-formulas/packing-formula',
                    'formulaOptionsSchema',
                ],
                ['/company-settings', 'company-settings/company-setting', 'settingsSchema'],
                ['/item-packaging', 'item-packaging/item-package', 'recordSchema', true],
                ['/reorder-policies', 'reorder-policies/reorder-policy', 'recordSchema', true],
                ['/reason-codes', 'reason-codes/reason-code', 'recordSchema', true],
                [
                    '/inventory-controls',
                    'inventory-controls/inventory-control',
                    'controlSchema',
                    true,
                ],
                [
                    '/inventory-controls/options',
                    'inventory-controls/inventory-control',
                    'controlOptionsSchema',
                ],
                [
                    '/reports/inventory?report=low-stock',
                    'inventory-reports/inventory-report',
                    'reportSchema',
                ],
                [
                    '/reports/inventory/options',
                    'inventory-reports/inventory-report',
                    'reportOptionsSchema',
                ],
                ['/dashboard', 'dashboard/dashboard', 'dashboardDataSchema'],
                ...['packing', 'purchasing', 'transfers', 'genealogy'].map(
                    (report) =>
                        [
                            `/reports/operations?report=${report}`,
                            'operational-reports/operational-report',
                            'reportSchema',
                        ] as [string, string, string],
                ),
            ];
            for (const [path, file, name, array] of reads)
                await dto(file, name, await request(path), array);
            for (const [path] of reads) await request(path, 'GET', undefined, 'anonymous', 401);
            for (const path of [
                '/sales-orders',
                '/delivery-orders',
                '/packing-orders',
                '/purchase-orders',
                '/items',
                '/inventory/stocks/adjustments',
            ])
                await request(path, 'POST', {}, 'viewer', 403);
            await request('/brands', 'GET', undefined, 'demo', 404);

            const today = new Date().toISOString().slice(0, 10);
            const future = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
            const units = await request('/uoms');
            const kg = units.find((row: { name: string }) => row.name === 'kg').uomId;
            const pc = units.find((row: { name: string }) => row.name === 'pc').uomId;
            const location = async (code: string, locationType: string) =>
                request('/locations', 'POST', { code, name: code, locationType }, 'warehouse', 201);
            const rawStore = await location('AUD-WH-RM', 'Warehouse');
            const finishedStore = await location('AUD-WH-FG', 'Warehouse');
            const branch = await location('AUD-BRANCH', 'Branch');
            const transit = (await request('/locations')).find(
                (row: { code: string }) => row.code === 'TRANSIT',
            );
            const item = async (
                sku: string,
                itemType: string,
                primaryUomId: number,
                unitCost: string,
                labelItemId?: number,
            ) =>
                request(
                    '/items',
                    'POST',
                    {
                        sku,
                        name: sku,
                        itemType,
                        primaryUomId,
                        unitCost,
                        ...(labelItemId ? { labelItemId } : {}),
                    },
                    'warehouse',
                    201,
                );
            const raw = await item('AUD-RM-GARLIC', 'Raw Material - Bulk', kg, '110');
            const pouch = await item('AUD-PKG-100', 'Packaging - Hardware', pc, '1.25');
            const label = await item('AUD-LBL-GARLIC', 'Packaging - Label', pc, '0.35');
            const seal = await item('AUD-SEAL', 'Packaging - Hardware', pc, '0.15');
            const finished = await item(
                'AUD-FG-GARLIC-100',
                'Finished Good',
                pc,
                '12.75',
                label.itemId,
            );
            const customer = await request(
                '/customers',
                'POST',
                { name: 'Audit Restaurant', email: 'audit@kff-demo.example' },
                'warehouse',
                201,
            );
            const revision = await request(
                '/inventory-controls',
                'POST',
                {
                    requestNumber: 'AUD-FORMULA',
                    kind: 'Formula',
                    itemId: finished.itemId,
                    changeType: 'Replace',
                    effectiveDate: today,
                    notes: 'Released garlic formula for isolated system-flow verification.',
                    components: [
                        { componentItemId: raw.itemId, uomId: kg, quantity: '0.1' },
                        ...[pouch, label, seal].map((component) => ({
                            componentItemId: component.itemId,
                            uomId: pc,
                            quantity: '1',
                        })),
                    ],
                },
                'warehouse',
                201,
            );
            await request(
                `/inventory-controls/${revision.requestId}/actions`,
                'POST',
                { action: 'submit', reviewNote: 'Ready for review.' },
                'warehouse',
            );
            await request(`/inventory-controls/${revision.requestId}/actions`, 'POST', {
                action: 'approve',
                reviewNote: 'Independent release.',
            });
            const sale = await request(
                '/sales-orders',
                'POST',
                {
                    salesOrderNumber: 'AUD-SO-001',
                    customerPoNumber: 'CUSTOMER-PO-001',
                    customerId: customer.customerId,
                    orderDate: today,
                    lines: [
                        { itemId: finished.itemId, uomId: pc, qtyOrdered: '500', unitPrice: '35' },
                    ],
                },
                'warehouse',
                201,
            );
            const planPath = `/sales-orders/${sale.salesOrderId}/material-plan?sourceLocationId=${rawStore.locationId}`;
            const shortage = await request(planPath);
            await dto('sales-orders/sales-order', 'salesMaterialPlanSchema', shortage);
            assert.equal(shortage.products[0].qtyToPack, '500.0000');
            assert.equal(
                shortage.materials.find((row: { itemId: number }) => row.itemId === raw.itemId)
                    .qtyShortage,
                '50.0000',
            );
            assert.equal(shortage.canPack, false);
            await request(`/sales-orders/${sale.salesOrderId}/confirm`, 'POST', {}, 'warehouse');
            for (const [suffix, materials] of [
                ['RAW', [raw]],
                ['PACK', [pouch, label, seal]],
            ] as const) {
                const supplier = await request(
                    '/suppliers',
                    'POST',
                    { name: 'Audit Supplier ' + suffix },
                    'purchasing',
                    201,
                );
                for (const material of materials)
                    await request(
                        `/suppliers/${supplier.supplierId}/items`,
                        'POST',
                        { itemId: material.itemId },
                        'purchasing',
                        201,
                    );
                const number = await request(
                    '/purchase-orders/next-number',
                    'POST',
                    {},
                    'purchasing',
                );
                const order = await request(
                    '/purchase-orders',
                    'POST',
                    {
                        poNumber: number.poNumber,
                        supplierId: supplier.supplierId,
                        orderDate: today + 'T00:00:00.000Z',
                        lines: materials.map((material) => ({
                            itemId: material.itemId,
                            uomId: material.primaryUomId,
                            qtyOrdered: suffix === 'RAW' ? '50' : '500',
                            unitPrice: material.unitCost,
                        })),
                    },
                    'purchasing',
                    201,
                );
                await request(`/purchase-orders/${order.poId}/send`, 'POST', {}, 'purchasing');
                const detail = await request(`/purchase-orders/${order.poId}`);
                const receive = async (quantity: string, expected: string, batch: number) =>
                    request(
                        '/receiving',
                        'POST',
                        {
                            poId: order.poId,
                            lines: detail.lines.map(
                                (line: { poLineId: number; itemId: number }) => ({
                                    poLineId: line.poLineId,
                                    qtyReceived: quantity,
                                    expectedQtyReceived: expected,
                                    lotNumber: `AUD-${suffix}-${line.itemId}-${batch}`,
                                    locationId: rawStore.locationId,
                                }),
                            ),
                        },
                        'warehouse',
                        201,
                    );
                if (suffix === 'RAW') {
                    await receive('30', '0', 1);
                    assert.equal(
                        (await request(`/purchase-orders/${order.poId}`)).status,
                        'Partially Received',
                    );
                    await receive('20', '30', 2);
                } else await receive('500', '0', 1);
                assert.equal((await request(`/purchase-orders/${order.poId}`)).status, 'Completed');
            }
            assert.equal((await request(planPath)).canPack, true);
            const packing = await request(
                '/packing-orders',
                'POST',
                {
                    packingOrderNumber: 'AUD-PK-001',
                    itemId: finished.itemId,
                    targetQty: '500',
                    sourceLocationId: rawStore.locationId,
                    destinationLocationId: finishedStore.locationId,
                },
                'warehouse',
                201,
            );
            await request(
                `/packing-orders/${packing.packingOrderId}/plan`,
                'POST',
                {},
                'warehouse',
            );
            const ledgerCount = async () =>
                (await client`select count(*)::int as n from inventory_transactions`)[0]!.n;
            const plannedCount = await ledgerCount();
            await request(
                `/packing-orders/${packing.packingOrderId}/start`,
                'POST',
                {},
                'warehouse',
            );
            assert.equal(
                await ledgerCount(),
                plannedCount,
                'starting packing does not consume stock',
            );
            await request(
                `/packing-orders/${packing.packingOrderId}/complete`,
                'POST',
                {
                    actualQty: '500',
                    lotNumber: 'AUD-FG-LOT',
                    manufactureDate: today,
                    expirationDate: future,
                },
                'warehouse',
            );
            const [packedLot] =
                await client`select lot_id,packing_order_id from lots where lot_number='AUD-FG-LOT'`;
            assert.equal(packedLot!.packing_order_id, packing.packingOrderId);
            const transfer = await request(
                '/transfers',
                'POST',
                {
                    transferNumber: 'AUD-TR-001',
                    sourceLocationId: finishedStore.locationId,
                    destinationLocationId: branch.locationId,
                    lines: [
                        { itemId: finished.itemId, lotId: packedLot!.lot_id, qtyRequested: '200' },
                    ],
                },
                'warehouse',
                201,
            );
            const transferLineId = transfer.lines[0].transferLineId;
            await request(
                `/transfers/${transfer.transferId}/dispatch`,
                'POST',
                {
                    transitLocationId: transit.locationId,
                    lines: [{ transferLineId, qtyShipped: '200' }],
                },
                'warehouse',
            );
            await request(
                `/transfers/${transfer.transferId}/receive`,
                'POST',
                { lines: [{ transferLineId, qtyReceived: '120' }] },
                'warehouse',
            );
            assert.equal((await request(`/transfers/${transfer.transferId}`)).status, 'In Transit');
            await request(
                `/transfers/${transfer.transferId}/receive`,
                'POST',
                { lines: [{ transferLineId, qtyReceived: '80' }] },
                'warehouse',
            );
            assert.equal((await request(`/transfers/${transfer.transferId}`)).status, 'Completed');
            for (const [index, sourceLocationId, quantity] of [
                [1, branch.locationId, '150'],
                [2, finishedStore.locationId, '300'],
                [3, branch.locationId, '50'],
            ] as const) {
                const delivery = await request(
                    '/delivery-orders',
                    'POST',
                    {
                        deliveryOrderNumber: 'AUD-DO-' + index,
                        salesOrderId: sale.salesOrderId,
                        sourceLocationId,
                        deliveryDate: today,
                        lines: [
                            {
                                salesOrderLineId: sale.lines[0].salesOrderLineId,
                                lotId: packedLot!.lot_id,
                                qtyDelivered: quantity,
                            },
                        ],
                    },
                    'warehouse',
                    201,
                );
                await request(
                    `/delivery-orders/${delivery.deliveryOrderId}/dispatch`,
                    'POST',
                    { transitLocationId: transit.locationId },
                    'warehouse',
                );
                const [protectedStock] =
                    await client`select qty_reserved::text from inventory_reservations where delivery_order_line_id=${delivery.lines[0].deliveryOrderLineId} and released_at is null`;
                assert.equal(protectedStock!.qty_reserved, quantity + '.0000');
                await request(
                    `/delivery-orders/${delivery.deliveryOrderId}/complete`,
                    'POST',
                    {},
                    'warehouse',
                );
                await request(
                    `/delivery-orders/${delivery.deliveryOrderId}/complete`,
                    'POST',
                    {},
                    'warehouse',
                    409,
                );
                assert.equal(
                    (await request(`/sales-orders/${sale.salesOrderId}`)).status,
                    index === 3 ? 'Completed' : 'Partially Delivered',
                );
            }
            const [balances] =
                await client`with ledger as (select item_id,lot_id,location_id,sum(qty_change) quantity from inventory_transactions group by item_id,lot_id,location_id)
            select count(*)::int as mismatches from inventory_stock s full join ledger l using(item_id,lot_id,location_id) where coalesce(s.qty_on_hand,0)<>coalesce(l.quantity,0)`;
            assert.equal(balances!.mismatches, 0);
            const [auditLedger] =
                await client`select count(*)::int as n from inventory_transactions where item_id in (${raw.itemId},${pouch.itemId},${label.itemId},${seal.itemId},${finished.itemId})`;
            assert.equal(auditLedger!.n, 26);
            const [remaining] =
                await client`select coalesce(sum(qty_on_hand),0)::text as qty from inventory_stock where item_id=${finished.itemId}`;
            assert.equal(Number(remaining!.qty), 0);
            const beforeReads = await ledgerCount();
            for (const [path, file, name, array] of reads)
                await dto(file, name, await request(path), array);
            assert.equal(
                await ledgerCount(),
                beforeReads,
                'reporting and inspection never post movements',
            );
        } finally {
            if (server)
                await new Promise<void>((resolve, reject) =>
                    server!.close((error) => (error ? reject(error) : resolve())),
                );
            await database?.$client.end({ timeout: 5 });
            await client.end({ timeout: 5 });
            assert.match(schema, /^system_flow_[0-9a-f]+$/);
            await admin.unsafe(`drop schema if exists "${schema}" cascade`);
            await admin.end({ timeout: 5 });
        }
    },
);
