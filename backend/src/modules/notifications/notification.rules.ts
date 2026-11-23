import type { RoleSettings } from '../../db/schema.ts';

export type PermissionKey = keyof RoleSettings;

export const NOTIFICATION_TAG_KEYS = [
    'notifyInventory',
    'notifyPurchasing',
    'notifyPacking',
    'notifyTransfers',
    'notifySales',
    'notifyAccounting',
    'notifyUsers',
] as const;

export type NotificationTagKey = (typeof NOTIFICATION_TAG_KEYS)[number];

export type RoleSummary = {
    roleId: number;
    name: string;
    description: string | null;
    settings: RoleSettings;
};

type RouteSyncSpec = {
    prefix: string;
    module: string;
    label: string;
    route: string;
    queryKeys: string[];
    recommendedPermissions: PermissionKey[];
    notificationTag: NotificationTagKey;
};

const ROUTE_SYNC_SPECS: RouteSyncSpec[] = [
    {
        prefix: '/api/purchase-orders',
        module: 'purchase-orders',
        label: 'Purchase Order',
        route: '/purchase-orders',
        queryKeys: [
            'purchase-orders',
            'purchase-order-detail',
            'purchase-order-options',
            'dashboard',
            'accounting',
            'operational-reports',
        ],
        recommendedPermissions: ['canManagePurchasing', 'canManageInventory', 'canManageAccounting'],
        notificationTag: 'notifyPurchasing',
    },
    {
        prefix: '/api/receiving',
        module: 'receiving',
        label: 'Goods Receiving',
        route: '/receiving',
        queryKeys: [
            'receiving',
            'receiving-options',
            'purchase-orders',
            'purchase-order-detail',
            'purchase-order-options',
            'inventory-stocks',
            'inventory-stock-options',
            'lots',
            'lot-detail',
            'inventory-movements',
            'inventory-reports',
            'operational-reports',
            'dashboard',
            'accounting',
        ],
        recommendedPermissions: ['canManagePurchasing', 'canManageInventory', 'canManageAccounting'],
        notificationTag: 'notifyPurchasing',
    },
    {
        prefix: '/api/packing-orders',
        module: 'packing-orders',
        label: 'Packing Order',
        route: '/packing-orders',
        queryKeys: [
            'packing-orders',
            'packing-reservations',
            'packing-options',
            'packing-detail',
            'packing-preview',
            'inventory-stocks',
            'inventory-stock-options',
            'lots',
            'lot-detail',
            'inventory-movements',
            'inventory-reports',
            'operational-reports',
            'dashboard',
            'accounting',
        ],
        recommendedPermissions: ['canManagePacking', 'canManageInventory', 'canManageAccounting'],
        notificationTag: 'notifyPacking',
    },
    {
        prefix: '/api/packing-formulas',
        module: 'packing-formulas',
        label: 'Packing Formula',
        route: '/bom',
        queryKeys: [
            'packing-formulas',
            'packing-formula-options',
            'packing-options',
            'packing-preview',
            'sales-order-options',
            'sales-order-material-plan',
            'items',
            'inventory-controls',
        ],
        recommendedPermissions: ['canManagePacking', 'canManageInventory'],
        notificationTag: 'notifyPacking',
    },
    {
        prefix: '/api/transfers',
        module: 'transfers',
        label: 'Stock Transfer',
        route: '/transfers',
        queryKeys: [
            'transfers',
            'transfer-options',
            'transfer-detail',
            'inventory-stocks',
            'inventory-stock-options',
            'lots',
            'lot-detail',
            'inventory-movements',
            'inventory-reports',
            'operational-reports',
            'dashboard',
            'accounting',
        ],
        recommendedPermissions: ['canManageTransfers', 'canManageInventory', 'canManageAccounting'],
        notificationTag: 'notifyTransfers',
    },
    {
        prefix: '/api/sales-orders',
        module: 'sales-orders',
        label: 'Sales Order',
        route: '/sales-orders',
        queryKeys: [
            'sales-orders',
            'sales-order-options',
            'sales-order-detail',
            'delivery-orders',
            'delivery-order-options',
            'packing-orders',
            'dashboard',
            'accounting',
            'operational-reports',
        ],
        recommendedPermissions: [
            'canManageInventory',
            'canManageTransfers',
            'canManagePacking',
            'canManageAccounting',
        ],
        notificationTag: 'notifySales',
    },
    {
        prefix: '/api/delivery-orders',
        module: 'delivery-orders',
        label: 'Delivery Order',
        route: '/delivery-orders',
        queryKeys: [
            'delivery-orders',
            'delivery-order-options',
            'delivery-order-detail',
            'sales-orders',
            'sales-order-options',
            'sales-order-detail',
            'inventory-stocks',
            'inventory-stock-options',
            'lots',
            'lot-detail',
            'inventory-movements',
            'inventory-reports',
            'operational-reports',
            'dashboard',
            'accounting',
        ],
        recommendedPermissions: ['canManageTransfers', 'canManageInventory', 'canManageAccounting'],
        notificationTag: 'notifyTransfers',
    },
    {
        prefix: '/api/inventory/stocks',
        module: 'inventory-stocks',
        label: 'Inventory Stock',
        route: '/inventory',
        queryKeys: [
            'inventory-stocks',
            'inventory-stock-options',
            'lots',
            'lot-detail',
            'inventory-movements',
            'inventory-reports',
            'operational-reports',
            'dashboard',
            'accounting',
        ],
        recommendedPermissions: ['canManageInventory', 'canManageAccounting'],
        notificationTag: 'notifyInventory',
    },
    {
        prefix: '/api/inventory-controls',
        module: 'inventory-controls',
        label: 'Inventory Control',
        route: '/inventory/scrap',
        queryKeys: [
            'inventory-controls',
            'inventory-control-options',
            'inventory-control-detail',
            'inventory-stocks',
            'inventory-stock-options',
            'lots',
            'lot-detail',
            'inventory-movements',
            'inventory-reports',
            'operational-reports',
            'dashboard',
            'accounting',
            'packing-formulas',
        ],
        recommendedPermissions: ['canManageInventory', 'canManagePacking', 'canManageAccounting'],
        notificationTag: 'notifyInventory',
    },
    {
        prefix: '/api/lots',
        module: 'lots',
        label: 'Lot / Batch',
        route: '/inventory/lots',
        queryKeys: [
            'lots',
            'lot-detail',
            'inventory-stocks',
            'inventory-movements',
            'inventory-reports',
            'dashboard',
            'accounting',
        ],
        recommendedPermissions: ['canManageInventory', 'canManageAccounting'],
        notificationTag: 'notifyInventory',
    },
    {
        prefix: '/api/items',
        module: 'items',
        label: 'Item Catalog',
        route: '/items',
        queryKeys: [
            'items',
            'item-uoms',
            'item-supplier-links',
            'item-supplier-options',
            'purchase-order-options',
            'packing-options',
            'sales-order-options',
            'dashboard',
            'accounting',
        ],
        recommendedPermissions: ['canManageInventory', 'canManagePurchasing', 'canManagePacking'],
        notificationTag: 'notifyInventory',
    },
    {
        prefix: '/api/item-packaging',
        module: 'item-packaging',
        label: 'Item Packaging',
        route: '/item-packaging',
        queryKeys: ['item-packaging-options', 'items', 'packing-formulas'],
        recommendedPermissions: ['canManageInventory', 'canManagePacking'],
        notificationTag: 'notifyInventory',
    },
    {
        prefix: '/api/suppliers',
        module: 'suppliers',
        label: 'Supplier',
        route: '/suppliers',
        queryKeys: [
            'suppliers',
            'supplier-items',
            'supplier-options',
            'item-supplier-links',
            'item-supplier-options',
            'purchase-order-options',
        ],
        recommendedPermissions: ['canManagePurchasing'],
        notificationTag: 'notifyPurchasing',
    },
    {
        prefix: '/api/customers',
        module: 'customers',
        label: 'Customer',
        route: '/customers',
        queryKeys: ['customers', 'sales-order-options', 'delivery-order-options'],
        recommendedPermissions: ['canManageInventory', 'canManageTransfers'],
        notificationTag: 'notifySales',
    },
    {
        prefix: '/api/locations',
        module: 'locations',
        label: 'Location',
        route: '/locations',
        queryKeys: [
            'locations',
            'inventory-stocks',
            'inventory-stock-options',
            'transfer-options',
            'packing-options',
            'receiving-options',
        ],
        recommendedPermissions: ['canManageInventory', 'canManageTransfers'],
        notificationTag: 'notifyInventory',
    },
    {
        prefix: '/api/uoms',
        module: 'uoms',
        label: 'Unit of Measure',
        route: '/uom',
        queryKeys: ['uoms', 'items', 'item-uoms'],
        recommendedPermissions: ['canManageInventory'],
        notificationTag: 'notifyInventory',
    },
    {
        prefix: '/api/reason-codes',
        module: 'reason-codes',
        label: 'Reason Code',
        route: '/reason-codes',
        queryKeys: ['reason-codes', 'inventory-control-options'],
        recommendedPermissions: ['canManageInventory'],
        notificationTag: 'notifyInventory',
    },
    {
        prefix: '/api/reorder-policies',
        module: 'reorder-policies',
        label: 'Reorder Policy',
        route: '/reorder-policies',
        queryKeys: [
            'reorder-policies',
            'reorder-policies-options',
            'dashboard',
            'inventory-reports',
        ],
        recommendedPermissions: ['canManageInventory', 'canManagePurchasing'],
        notificationTag: 'notifyInventory',
    },
    {
        prefix: '/api/company-settings',
        module: 'company-settings',
        label: 'Company Settings',
        route: '/settings',
        queryKeys: ['company-settings', 'dashboard', 'accounting'],
        recommendedPermissions: ['canManageUsers', 'canManageAccounting'],
        notificationTag: 'notifyAccounting',
    },
    {
        prefix: '/api/roles',
        module: 'roles',
        label: 'Role & Permission',
        route: '/roles',
        queryKeys: ['roles', 'users', 'user-role-options', 'notification-roles', 'session'],
        recommendedPermissions: ['canManageUsers'],
        notificationTag: 'notifyUsers',
    },
    {
        prefix: '/api/user',
        module: 'users',
        label: 'User Account',
        route: '/users',
        queryKeys: ['users', 'roles', 'user-role-options', 'notification-roles', 'session'],
        recommendedPermissions: ['canManageUsers'],
        notificationTag: 'notifyUsers',
    },
];

export function resolveMutationContext(method: string, rawPath: string): {
    module: string;
    label: string;
    route: string | null;
    action: string;
    entityId: string | null;
    queryKeys: string[];
    recommendedPermissions: PermissionKey[];
    notificationTag: NotificationTagKey;
} {
    const cleanPath = rawPath.split('?')[0] ?? rawPath;
    const spec = ROUTE_SYNC_SPECS.find(
        (candidate) =>
            cleanPath === candidate.prefix || cleanPath.startsWith(`${candidate.prefix}/`),
    );

    const segments = cleanPath.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    const tail = segments[segments.length - 1] ?? '';
    const idSegment = segments.find((seg) => /^\d+$/.test(seg)) ?? null;

    let action =
        method === 'POST'
            ? 'created'
            : method === 'DELETE'
                ? 'deleted'
                : 'updated';
    if (
        method === 'POST' &&
        [
            'receive',
            'complete',
            'start',
            'cancel',
            'confirm',
            'dispatch',
            'deliver',
            'approve',
            'reject',
            'reserve',
        ].includes(tail)
    ) {
        action = tail;
    }

    if (!spec) {
        return {
            module: segments[0] ?? 'system',
            label: segments[0] ? segments[0].replace(/-/g, ' ') : 'System',
            route: null,
            action,
            entityId: idSegment,
            queryKeys: ['dashboard'],
            recommendedPermissions: ['canManageUsers'],
            notificationTag: 'notifyUsers',
        };
    }

    return {
        module: spec.module,
        label: spec.label,
        route: spec.route,
        action,
        entityId: idSegment,
        queryKeys: spec.queryKeys,
        recommendedPermissions: spec.recommendedPermissions,
        notificationTag: spec.notificationTag,
    };
}

export function resolveTargetRoleIds(
    allRoles: RoleSummary[],
    selection: { mode: 'auto' | 'custom' | 'none'; roleIds: number[] },
    recommendedPermissions: PermissionKey[],
    notificationTag?: NotificationTagKey,
): RoleSummary[] {
    if (selection.mode === 'none') {
        return [];
    }

    if (selection.mode === 'custom' && selection.roleIds.length > 0) {
        const wanted = new Set(selection.roleIds);
        return allRoles.filter((role) => wanted.has(role.roleId));
    }

    const matched = allRoles.filter((role) => {
        const hasExplicitTags = NOTIFICATION_TAG_KEYS.some(
            (key) => role.settings?.[key] === true,
        );
        if (hasExplicitTags) {
            return notificationTag ? role.settings?.[notificationTag] === true : false;
        }
        return recommendedPermissions.some((permission) => role.settings?.[permission] === true);
    });
    return matched.length > 0 ? matched : allRoles;
}

export function formatActionSentence(
    actorName: string,
    label: string,
    action: string,
    entityId: string | null,
    note: string | null,
): { title: string; message: string } {
    const pastAction =
        action === 'confirm'
            ? 'confirmed'
            : action === 'cancel'
                ? 'cancelled'
                : action === 'dispatch'
                    ? 'dispatched'
                    : action === 'complete'
                        ? 'completed'
                        : action === 'start'
                            ? 'started'
                            : action === 'receive'
                                ? 'received'
                                : action === 'approve'
                                    ? 'approved'
                                    : action === 'reject'
                                        ? 'rejected'
                                        : action === 'reserve'
                                            ? 'reserved stock for'
                                            : action;

    const targetRef = entityId ? `${label} #${entityId}` : label;
    const title = `${targetRef} ${pastAction}`;
    const baseMessage = `${actorName} ${pastAction} ${targetRef.toLowerCase()}.`;
    return {
        title,
        message: note ? `${baseMessage} Note: ${note}` : baseMessage,
    };
}
