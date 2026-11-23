import { randomUUID } from 'node:crypto';
import { createSettingsRouter } from './modules/company-settings/company-setting.routes.ts';
import type { SettingsService } from './modules/company-settings/company-setting.controller.ts';
import { createReasonCodeRouter } from './modules/reason-codes/reason-code.routes.ts';
import type { ReasonCodeService } from './modules/reason-codes/reason-code.controller.ts';
import { createItemPackageRouter } from './modules/item-packaging/item-package.routes.ts';
import type { ItemPackageService } from './modules/item-packaging/item-package.controller.ts';
import { createReorderPolicyRouter } from './modules/reorder-policies/reorder-policy.routes.ts';
import type { ReorderPolicyService } from './modules/reorder-policies/reorder-policy.controller.ts';
import { createControlRouter } from './modules/inventory-controls/inventory-control.routes.ts';
import type { ControlService } from './modules/inventory-controls/inventory-control.controller.ts';
import { createOperationalReportRouter } from './modules/operational-reports/operational-report.routes.ts';
import type { OperationalReportService } from './modules/operational-reports/operational-report.controller.ts';
import { createUomRouter } from './modules/uoms/uom.routes.ts';
import type { UomService } from './modules/uoms/uom.controller.ts';
import { createLocationRouter } from './modules/locations/location.routes.ts';
import type { LocationService } from './modules/locations/location.controller.ts';
import cors from 'cors';
import { createStockRouter } from './modules/inventory-stocks/inventory-stock.routes.ts';
import type { StockService } from './modules/inventory-stocks/inventory-stock.controller.ts';
import express from 'express';

import { AppError } from './errors/app-error.ts';
import { createCompressionMiddleware } from './middleware/compression.ts';
import { errorHandler } from './middleware/error-handler.ts';
import httpLogger from './middleware/httpLogger.ts';
import logger from './utils/logger.ts';
import type { UserService } from './modules/users/user.controller.ts';
import { createUserRouter } from './modules/users/user.routes.ts';
import HttpStatusCode from './utils/statusCodeHandler.ts';
import { sendSuccessResponse } from './utils/responseHandler.ts';
import type { ItemService } from './modules/items/item.controller.ts';
import type { AuthService } from './modules/auth/auth.controller.ts';
import { createItemRouter } from './modules/items/item.routes.ts';
import { createAuthRouter } from './modules/auth/auth.routes.ts';
import { createAuthMiddleware, requirePermission } from './middleware/auth.ts';
import { createSupplierRouter } from './modules/suppliers/supplier.routes.ts';
import type { SupplierService } from './modules/suppliers/supplier.controller.ts';
import { createPurchaseOrderRouter } from './modules/purchase-orders/purchase-order.routes.ts';
import type { PurchaseOrderService } from './modules/purchase-orders/purchase-order.controller.ts';
import { createReceivingRouter } from './modules/receiving/receiving.routes.ts';
import type { ReceivingService } from './modules/receiving/receiving.controller.ts';
import { createLotRouter } from './modules/lots/lot.routes.ts';
import type { LotService } from './modules/lots/lot.controller.ts';
import { createPackingOrderRouter } from './modules/packing-orders/packing-order.routes.ts';
import type { PackingOrderService } from './modules/packing-orders/packing-order.controller.ts';
import { createTransferRouter } from './modules/transfers/transfer.routes.ts';
import type { TransferService } from './modules/transfers/transfer.controller.ts';
import { createDashboardRouter } from './modules/dashboard/dashboard.routes.ts';
import type { DashboardService } from './modules/dashboard/dashboard.controller.ts';
import { createCustomerRouter } from './modules/customers/customer.routes.ts';
import type { CustomerService } from './modules/customers/customer.controller.ts';
import { createInventoryMovementRouter } from './modules/inventory-movements/inventory-movement.routes.ts';
import type { InventoryMovementService } from './modules/inventory-movements/inventory-movement.controller.ts';
import { createRoleRouter } from './modules/roles/role.routes.ts';
import type { RoleService } from './modules/roles/role.controller.ts';
import { createSalesOrderRouter } from './modules/sales-orders/sales-order.routes.ts';
import type { SalesOrderService } from './modules/sales-orders/sales-order.controller.ts';
import { createDeliveryOrderRouter } from './modules/delivery-orders/delivery-order.routes.ts';
import { createFormulaRouter } from './modules/packing-formulas/packing-formula.routes.ts';
import type { FormulaService } from './modules/packing-formulas/packing-formula.controller.ts';
import type { DeliveryOrderService } from './modules/delivery-orders/delivery-order.controller.ts';
import { createInventoryReportRouter } from './modules/inventory-reports/inventory-report.routes.ts';
import type { InventoryReportService } from './modules/inventory-reports/inventory-report.controller.ts';
import { createAccountingRouter } from './modules/accounting/accounting.routes.ts';
import type { AccountingService } from './modules/accounting/accounting.controller.ts';
import { createNotificationRouter } from './modules/notifications/notification.routes.ts';
import type { NotificationService } from './modules/notifications/notification.controller.ts';
import { parseNotifyHeaders } from './modules/notifications/notification.schema.ts';
import { resolveMutationContext } from './modules/notifications/notification.rules.ts';
import { emitDataSync, isRealtimeEnabled, normalizeSocketId } from './realtime/socket.ts';

export function parseCorsOrigins(rawOrigin = process.env.CORS_ORIGIN) {
    const origins = (rawOrigin ?? 'http://localhost:3000')
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean);
    return origins.length ? origins : ['http://localhost:3000'];
}

/** Build the HTTP app without opening a port or importing a live database client. */
export function createApp(modules: {
    userService: UserService;
    authService: AuthService;
    roleService?: RoleService;
    itemService?: ItemService;
    stockService?: StockService;
    inventoryMovementService?: InventoryMovementService;
    uomService?: UomService;
    locationService?: LocationService;
    supplierService?: SupplierService;
    purchaseOrderService?: PurchaseOrderService;
    receivingService?: ReceivingService;
    lotService?: LotService;
    packingOrderService?: PackingOrderService;
    transferService?: TransferService;
    dashboardService?: DashboardService;
    customerService?: CustomerService;
    salesOrderService?: SalesOrderService;
    deliveryOrderService?: DeliveryOrderService;
    formulaService?: FormulaService;
    inventoryReportService?: InventoryReportService;
    settingsService?: SettingsService;
    reasonCodeService?: ReasonCodeService;
    itemPackageService?: ItemPackageService;
    reorderPolicyService?: ReorderPolicyService;
    controlService?: ControlService;
    operationalReportService?: OperationalReportService;
    accountingService?: AccountingService;
    notificationService?: NotificationService;
}) {
    const app = express();

    app.set('trust proxy', 1);
    app.use(httpLogger);
    app.use(
        cors({
            origin: parseCorsOrigins(),
            credentials: true,
            methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'Accept',
                'X-Notify-Mode',
                'X-Notify-Role-Ids',
                'X-Notify-Message',
                'X-Socket-Id',
            ],
        }),
    );
    app.use(createCompressionMiddleware());
    app.use(express.json());

    app.get('/api/health', (_request, response) => {
        sendSuccessResponse(response, {
            status: 'ok',
            uptime: process.uptime(),
            realtime: isRealtimeEnabled(),
            timestamp: new Date().toISOString(),
        });
    });

    app.use('/api', (request, response, next) => {
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
            return next();
        }
        const path = request.originalUrl || request.url;
        if (path.startsWith('/api/auth/') || path.startsWith('/api/notifications')) {
            return next();
        }
        const notifySelection = parseNotifyHeaders(request.headers);
        const originSocketId = normalizeSocketId(request.headers['x-socket-id']);
        response.on('finish', () => {
            if (response.statusCode < 200 || response.statusCode >= 300) return;
            const session = response.locals.session as
                { userId: number; firstName: string; lastName: string; roleId: number } | undefined;
            if (!session) return;
            const actor = session;

            if (modules.notificationService) {
                void modules.notificationService
                    .recordMutationSyncAndNotification({
                        method: request.method,
                        path,
                        actor,
                        notifySelection,
                        originSocketId,
                    })
                    .catch((error) => {
                        logger.warn(
                            {
                                path,
                                reason: error instanceof Error ? error.message : String(error),
                            },
                            'Realtime mutation sync/notification failed',
                        );
                    });
                return;
            }

            const context = resolveMutationContext(request.method, path);
            emitDataSync(
                {
                    eventId: randomUUID(),
                    module: context.module,
                    action: context.action,
                    method: request.method,
                    path: path.split('?')[0] ?? path,
                    entityId: context.entityId,
                    queryKeys: context.queryKeys,
                    actorUserId: actor.userId,
                    actorName: `${actor.firstName} ${actor.lastName}`.trim() || 'User',
                    actorRoleId: actor.roleId,
                    timestamp: new Date().toISOString(),
                },
                { excludeSocketId: originSocketId },
            );
        });
        next();
    });

    const authenticate = createAuthMiddleware(modules.authService);
    if (modules.operationalReportService)
        app.use(
            '/api/reports/operations',
            createOperationalReportRouter(modules.operationalReportService, authenticate),
        );
    if (modules.settingsService)
        app.use(
            '/api/company-settings',
            createSettingsRouter(modules.settingsService, authenticate),
        );
    if (modules.reasonCodeService)
        app.use(
            '/api/reason-codes',
            createReasonCodeRouter(modules.reasonCodeService, authenticate),
        );
    if (modules.itemPackageService)
        app.use(
            '/api/item-packaging',
            createItemPackageRouter(modules.itemPackageService, authenticate),
        );
    if (modules.reorderPolicyService)
        app.use(
            '/api/reorder-policies',
            createReorderPolicyRouter(modules.reorderPolicyService, authenticate),
        );
    if (modules.controlService)
        app.use(
            '/api/inventory-controls',
            createControlRouter(modules.controlService, authenticate),
        );

    if (modules.inventoryReportService)
        app.use(
            '/api/reports/inventory',
            createInventoryReportRouter(modules.inventoryReportService, authenticate),
        );
    if (modules.formulaService)
        app.use('/api/packing-formulas', createFormulaRouter(modules.formulaService, authenticate));
    if (modules.salesOrderService)
        app.use(
            '/api/sales-orders',
            createSalesOrderRouter(modules.salesOrderService, authenticate),
        );
    if (modules.deliveryOrderService)
        app.use(
            '/api/delivery-orders',
            createDeliveryOrderRouter(modules.deliveryOrderService, authenticate),
        );
    app.use('/api/auth', createAuthRouter(modules.authService, authenticate));
    if (modules.roleService)
        app.use('/api/roles', createRoleRouter(modules.roleService, authenticate));
    app.use(
        '/api/user',
        authenticate,
        requirePermission('canManageUsers'),
        createUserRouter(modules.userService),
    );
    if (modules.itemService)
        app.use('/api/items', createItemRouter(modules.itemService, authenticate));
    if (modules.stockService)
        app.use('/api/inventory/stocks', createStockRouter(modules.stockService, authenticate));
    if (modules.inventoryMovementService)
        app.use(
            '/api/inventory/movements',
            createInventoryMovementRouter(modules.inventoryMovementService, authenticate),
        );
    if (modules.uomService) app.use('/api/uoms', createUomRouter(modules.uomService, authenticate));
    if (modules.locationService)
        app.use('/api/locations', createLocationRouter(modules.locationService, authenticate));
    if (modules.supplierService)
        app.use('/api/suppliers', createSupplierRouter(modules.supplierService, authenticate));
    if (modules.customerService)
        app.use('/api/customers', createCustomerRouter(modules.customerService, authenticate));
    if (modules.purchaseOrderService)
        app.use(
            '/api/purchase-orders',
            createPurchaseOrderRouter(modules.purchaseOrderService, authenticate),
        );
    if (modules.receivingService)
        app.use('/api/receiving', createReceivingRouter(modules.receivingService, authenticate));
    if (modules.lotService) app.use('/api/lots', createLotRouter(modules.lotService, authenticate));
    if (modules.packingOrderService)
        app.use(
            '/api/packing-orders',
            createPackingOrderRouter(modules.packingOrderService, authenticate),
        );
    if (modules.transferService)
        app.use('/api/transfers', createTransferRouter(modules.transferService, authenticate));
    if (modules.dashboardService)
        app.use('/api/dashboard', createDashboardRouter(modules.dashboardService, authenticate));
    if (modules.accountingService)
        app.use('/api/accounting', createAccountingRouter(modules.accountingService, authenticate));
    if (modules.notificationService)
        app.use(
            '/api/notifications',
            createNotificationRouter(modules.notificationService, authenticate),
        );
    app.use((_request, _response, next) => {
        next(new AppError(HttpStatusCode.NOT_FOUND, 'Route not found.'));
    });
    app.use(errorHandler);

    return app;
}
