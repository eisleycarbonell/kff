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
import { errorHandler } from './middleware/error-handler.ts';
import httpLogger from './middleware/httpLogger.ts';
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

function parseCorsOrigins(rawOrigin = process.env.CORS_ORIGIN) {
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
}) {
    const app = express();

    app.set('trust proxy', 1);
    app.use(httpLogger);
    app.use(
        cors({
            origin: parseCorsOrigins(),
            credentials: true,
            methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
        }),
    );
    app.use(express.json());

    app.get('/api/health', (_request, response) => {
        sendSuccessResponse(response, {
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        });
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
    app.use((_request, _response, next) => {
        next(new AppError(HttpStatusCode.NOT_FOUND, 'Route not found.'));
    });
    app.use(errorHandler);

    return app;
}
