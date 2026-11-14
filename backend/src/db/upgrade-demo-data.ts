import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from 'dotenv';
import { createPostgresClient, resolveDirectDatabaseUrl } from './connection.ts';
import { sampleProducts, samplePackaging } from './sample-catalog.ts';
import { sampleAccounts, sampleRoles } from './sample-accounts.ts';
import { requireTestDataOptIn } from './test-database.ts';

type MetadataRow = Record<string, string | number | null>;
export type DemoMetadataChange = {
    table: string;
    key: string;
    id: string | number;
    field: string;
    before: string | null;
    after: string;
};
export type DemoMetadata = Record<string, MetadataRow[]>;

/** Only exact legacy fixture values change. Saved documents and ledger rows are never edited. */
export function planDemoMetadataUpgrade(data: DemoMetadata): DemoMetadataChange[] {
    const changes: DemoMetadataChange[] = [];
    const replace = (table: string, key: string, field: string, before: string, after: string) => {
        for (const row of data[table] ?? []) {
            if (row[field] === before && row[key] != null)
                changes.push({ table, key, id: row[key], field, before, after });
        }
    };
    for (const product of sampleProducts) {
        for (const sku of [
            `RM-${product.code}`,
            `LBL-${product.code}`,
            `FG-${product.code}-${product.grams}`,
        ])
            replace('items', 'item_id', 'sku', `SAMPLE-${sku}`, sku);
        replace(
            'item_packaging',
            'packaging_id',
            'barcode',
            `SAMPLE-${product.code}-BOX`,
            `${product.code}-BOX`,
        );
    }
    for (const packaging of samplePackaging)
        replace('items', 'item_id', 'sku', `SAMPLE-PKG-${packaging.code}`, `PKG-${packaging.code}`);
    replace('items', 'item_id', 'sku', 'SAMPLE-RM-REPORT-ZERO', 'RM-ONION');
    replace('items', 'item_id', 'name', 'Sample Unstocked Report Material', 'Onion Powder Bulk');
    replace(
        'company_settings',
        'settings_id',
        'company_name',
        'KFF Sample Trading & Packing',
        'Kusina Filipino Food Trading & Packing',
    );
    for (const [before, after] of [
        ['Sample Philippine Spice Trading', 'Davao Harvest Spice Trading'],
        ['Sample Pantry Ingredients', 'Laguna Pantry Ingredients'],
        ['Sample Food Packaging Supplies', 'Metro Manila Food Packaging'],
    ])
        replace('suppliers', 'supplier_id', 'name', before!, after!);
    for (const [before, after] of [
        ['Sample Kusina Restaurant', 'Lutong Bahay Restaurant'],
        ['Sample Neighborhood Grocery', 'Barangay Fresh Mart'],
    ])
        replace('customers', 'customer_id', 'name', before!, after!);
    for (const local of ['spices', 'pantry', 'packaging'])
        replace(
            'suppliers',
            'supplier_id',
            'email',
            `${local}@example.test`,
            `${local}@kff-demo.example`,
        );
    for (const local of ['kusina', 'grocery'])
        replace(
            'customers',
            'customer_id',
            'email',
            `${local}@example.test`,
            `${local}@kff-demo.example`,
        );
    for (const role of sampleRoles)
        replace('roles', 'role_id', 'name', `Sample ${role.name}`, role.name);
    for (const account of sampleAccounts) {
        for (const row of data.users ?? []) {
            if (row.email !== account.email) continue;
            const previousLastName =
                account.email === 'demo@spice.local'
                    ? 'Administrator'
                    : account.email === 'warehouse@spice.local'
                      ? 'Warehouse'
                      : account.email.split('@')[0] === 'viewer'
                        ? 'Viewer'
                        : account.email.split('@')[0]![0]!.toUpperCase() +
                          account.email.split('@')[0]!.slice(1);
            if (row.last_name === previousLastName)
                changes.push({
                    table: 'users',
                    key: 'user_id',
                    id: row.user_id!,
                    field: 'last_name',
                    before: previousLastName,
                    after: account.lastName,
                });
            if (account.email === 'demo@spice.local' && row.first_name === 'Demo')
                changes.push({
                    table: 'users',
                    key: 'user_id',
                    id: row.user_id!,
                    field: 'first_name',
                    before: 'Demo',
                    after: account.firstName,
                });
        }
    }
    for (const [before, after] of [
        ['Sample Physical Count', 'Physical Count Correction'],
        ['Sample Expired Stock', 'Expired Stock Disposal'],
    ])
        replace('scrap_reason_codes', 'reason_id', 'code_name', before!, after!);
    for (const [before, after] of [
        [
            'Test counted-stock correction',
            'Verified difference between physical count and recorded stock',
        ],
        ['Test expired-stock disposal', 'Permanent removal of expired goods'],
    ])
        replace('scrap_reason_codes', 'reason_id', 'description', before!, after!);
    for (const [index, suffix] of [
        'DRAFT',
        'CONFIRMED',
        'PARTIAL',
        'COMPLETED',
        'CANCELLED',
    ].entries()) {
        for (const row of data.sales_orders ?? []) {
            if (row.sales_order_number !== `SAMPLE-SO-${suffix}` || row.customer_po_number != null)
                continue;
            const customer = data.customers?.find(
                (customer) => customer.customer_id === row.customer_id,
            );
            const prefix = ['Sample Kusina Restaurant', 'Lutong Bahay Restaurant'].includes(
                String(customer?.name),
            )
                ? 'LB'
                : ['Sample Neighborhood Grocery', 'Barangay Fresh Mart'].includes(
                        String(customer?.name),
                    )
                  ? 'BFM'
                  : null;
            if (prefix)
                changes.push({
                    table: 'sales_orders',
                    key: 'sales_order_id',
                    id: row.sales_order_id!,
                    field: 'customer_po_number',
                    before: null,
                    after: `${prefix}-PO-2026-${String(index + 1).padStart(4, '0')}`,
                });
        }
    }
    return changes;
}

export async function upgradeDemoData(
    client: ReturnType<typeof createPostgresClient>,
    environment = process.env,
) {
    requireTestDataOptIn(environment);
    return client.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(1262896723, hashtext('public'))`;
        await tx`set local lock_timeout='10s'`;
        await tx`select set_config('search_path','public',true)`;
        await tx`lock table items, item_packaging, company_settings, suppliers, customers, roles, users, scrap_reason_codes, sales_orders in share row exclusive mode`;
        const [actor] =
            await tx`select user_id from users where email='demo@spice.local' and deleted_at is null`;
        const [fingerprint] =
            await tx`select exists(select 1 from items where sku like 'SAMPLE-%') or exists(select 1 from company_settings where company_name='KFF Sample Trading & Packing') as legacy`;
        if (!actor || !fingerprint!.legacy) return { status: 'skipped-no-legacy-demo', changes: 0 };
        const snapshot = async () => {
            const [row] = await tx`select
                (select md5(coalesce(string_agg(row_to_json(t)::text, '|' order by transaction_id),'')) from inventory_transactions t) as ledger,
                (select md5(coalesce(string_agg(row_to_json(s)::text, '|' order by stock_id),'')) from inventory_stock s) as stock`;
            return JSON.stringify(row);
        };
        const before = await snapshot();
        const metadata: DemoMetadata = {
            items: await tx`select item_id,sku,name from items`,
            item_packaging: await tx`select packaging_id,barcode from item_packaging`,
            company_settings: await tx`select settings_id,company_name from company_settings`,
            suppliers: await tx`select supplier_id,name,email from suppliers`,
            customers: await tx`select customer_id,name,email from customers`,
            roles: await tx`select role_id,name from roles`,
            users: await tx`select user_id,email,first_name,last_name from users where deleted_at is null`,
            scrap_reason_codes:
                await tx`select reason_id,code_name,description from scrap_reason_codes`,
            sales_orders:
                await tx`select sales_order_id,sales_order_number,customer_po_number,customer_id from sales_orders where created_by=${actor.user_id}`,
        };
        const changes = planDemoMetadataUpgrade(metadata);
        for (const change of changes) {
            const version = change.table === 'company_settings' ? tx`, version=version+1` : tx``;
            await tx`update ${tx(change.table)} set ${tx(change.field)}=${change.after}, updated_at=now(), updated_by=${actor.user_id} ${version}
                where ${tx(change.key)}=${change.id} and ${tx(change.field)} is not distinct from ${change.before}`;
        }
        if (before !== (await snapshot()))
            throw new Error('Demo metadata upgrade changed stock or ledger history.');
        return { status: 'upgraded', changes: changes.length };
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    if (process.argv.includes('--help')) {
        console.log(
            'Upgrade exact legacy demo catalog/contact names and SKUs. Preserves saved document numbers, stock, ledger, passwords and edited values. Requires KFF_ALLOW_TEST_DATA=true.',
        );
    } else {
        config({ path: '.env', quiet: true });
        requireTestDataOptIn();
        const client = createPostgresClient(resolveDirectDatabaseUrl(), {
            max: 1,
            onnotice: () => {},
        });
        try {
            console.log(JSON.stringify(await upgradeDemoData(client)));
        } catch {
            console.error(
                'Demo metadata upgrade failed and was rolled back; check schema readiness and duplicate names/SKUs.',
            );
            process.exitCode = 1;
        } finally {
            await client.end({ timeout: 5 });
        }
    }
}
