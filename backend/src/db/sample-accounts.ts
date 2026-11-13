import type { RoleSettings } from './schema.ts';

export const SAMPLE_ADMIN_EMAIL = 'demo@spice.local';

export const sampleRoles = [
    {
        name: 'Sample Administrator',
        description: 'Full access to all implemented modules.',
        settings: {
            canManageInventory: true,
            canManagePurchasing: true,
            canManagePacking: true,
            canManageTransfers: true,
            canManageUsers: true,
        },
    },
    {
        name: 'Sample Warehouse Manager',
        description: 'Inventory, packing, transfers, sales orders and customer deliveries.',
        settings: {
            canManageInventory: true,
            canManagePacking: true,
            canManageTransfers: true,
        },
    },
    {
        name: 'Sample Purchasing',
        description: 'Supplier and purchase-order management.',
        settings: { canManagePurchasing: true },
    },
    {
        name: 'Sample Sales',
        description: 'Sales orders and inventory management through the Inventory permission.',
        settings: { canManageInventory: true },
    },
    {
        name: 'Sample Delivery',
        description: 'Customer deliveries and stock transfers through the Transfers permission.',
        settings: { canManageTransfers: true },
    },
    { name: 'Sample Viewer', description: 'Read-only access.', settings: {} },
] as const satisfies readonly { name: string; description: string; settings: RoleSettings }[];

export const sampleAccounts = [
    {
        firstName: 'Demo',
        lastName: 'Administrator',
        email: SAMPLE_ADMIN_EMAIL,
        roleName: 'Sample Administrator',
    },
    {
        firstName: 'Maria',
        lastName: 'Warehouse',
        email: 'warehouse@spice.local',
        roleName: 'Sample Warehouse Manager',
    },
    {
        firstName: 'Carlo',
        lastName: 'Purchasing',
        email: 'purchasing@spice.local',
        roleName: 'Sample Purchasing',
    },
    {
        firstName: 'Sofia',
        lastName: 'Sales',
        email: 'sales@spice.local',
        roleName: 'Sample Sales',
    },
    {
        firstName: 'Diego',
        lastName: 'Delivery',
        email: 'delivery@spice.local',
        roleName: 'Sample Delivery',
    },
    {
        firstName: 'Ana',
        lastName: 'Viewer',
        email: 'viewer@spice.local',
        roleName: 'Sample Viewer',
    },
] as const satisfies readonly {
    firstName: string;
    lastName: string;
    email: string;
    roleName: (typeof sampleRoles)[number]['name'];
}[];
