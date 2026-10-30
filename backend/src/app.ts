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

/** Build the HTTP app without opening a port or importing a live database client. */
export function createApp(modules: {
    userService: UserService;
    authService: AuthService;
    itemService?: ItemService;
    stockService?: StockService;
    uomService?: UomService;
    locationService?: LocationService;
    supplierService?: SupplierService;
    purchaseOrderService?: PurchaseOrderService;
    receivingService?: ReceivingService;
    lotService?: LotService;
    packingOrderService?: PackingOrderService;
    transferService?: TransferService;
    dashboardService?: DashboardService;
}) {
    const app = express();

    app.use(httpLogger);
    app.use(
        cors({
            origin: [process.env.CORS_ORIGIN || 'http://localhost:3000'],
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
    app.use('/api/auth', createAuthRouter(modules.authService, authenticate));
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
    if (modules.uomService) app.use('/api/uoms', createUomRouter(modules.uomService, authenticate));
    if (modules.locationService)
        app.use('/api/locations', createLocationRouter(modules.locationService, authenticate));
    if (modules.supplierService)
        app.use('/api/suppliers', createSupplierRouter(modules.supplierService, authenticate));
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
