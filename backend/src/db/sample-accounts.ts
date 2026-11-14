import type { RoleSettings } from './schema.ts';

export const SAMPLE_ADMIN_EMAIL = 'demo@spice.local';

export const sampleRoles = [
    {
        name: 'Administrator',
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
        name: 'Warehouse Manager',
        description: 'Inventory, packing, transfers, sales orders and customer deliveries.',
        settings: {
            canManageInventory: true,
            canManagePacking: true,
            canManageTransfers: true,
        },
    },
    {
        name: 'Purchasing',
        description: 'Supplier and purchase-order management.',
        settings: { canManagePurchasing: true },
    },
    {
        name: 'Sales',
        description: 'Sales orders and inventory management through the Inventory permission.',
        settings: { canManageInventory: true },
    },
    {
        name: 'Delivery',
        description: 'Customer deliveries and stock transfers through the Transfers permission.',
        settings: { canManageTransfers: true },
    },
    { name: 'Viewer', description: 'Read-only access.', settings: {} },
] as const satisfies readonly { name: string; description: string; settings: RoleSettings }[];

export const sampleAccounts = [
    {
        firstName: 'Elena',
        lastName: 'Reyes',
        email: SAMPLE_ADMIN_EMAIL,
        roleName: 'Administrator',
    },
    {
        firstName: 'Maria',
        lastName: 'Santos',
        email: 'warehouse@spice.local',
        roleName: 'Warehouse Manager',
    },
    {
        firstName: 'Carlo',
        lastName: 'Mendoza',
        email: 'purchasing@spice.local',
        roleName: 'Purchasing',
    },
    {
        firstName: 'Sofia',
        lastName: 'Garcia',
        email: 'sales@spice.local',
        roleName: 'Sales',
    },
    {
        firstName: 'Diego',
        lastName: 'Ramos',
        email: 'delivery@spice.local',
        roleName: 'Delivery',
    },
    {
        firstName: 'Ana',
        lastName: 'Cruz',
        email: 'viewer@spice.local',
        roleName: 'Viewer',
    },
] as const satisfies readonly {
    firstName: string;
    lastName: string;
    email: string;
    roleName: (typeof sampleRoles)[number]['name'];
}[];
