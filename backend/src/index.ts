import { createServer } from 'node:http';
import * as SettingsService from './modules/company-settings/company-setting.service.ts';
import * as ReasonCodeService from './modules/reason-codes/reason-code.service.ts';
import * as ItemPackageService from './modules/item-packaging/item-package.service.ts';
import * as ReorderPolicyService from './modules/reorder-policies/reorder-policy.service.ts';
import * as ControlService from './modules/inventory-controls/inventory-control.service.ts';
import * as OperationalReportService from './modules/operational-reports/operational-report.service.ts';
import * as UomService from './modules/uoms/uom.service.ts';
import * as LocationService from './modules/locations/location.service.ts';
import 'dotenv/config';
import * as StockService from './modules/inventory-stocks/inventory-stock.service.ts';

import { createApp } from './app.ts';
import * as UserService from './modules/users/user.service.ts';
import * as RoleService from './modules/roles/role.service.ts';
import logger from './utils/logger.ts';
import * as ItemService from './modules/items/item.service.ts';
import * as AuthService from './modules/auth/auth.service.ts';
import * as SupplierService from './modules/suppliers/supplier.service.ts';
import * as PurchaseOrderService from './modules/purchase-orders/purchase-order.service.ts';
import * as ReceivingService from './modules/receiving/receiving.service.ts';
import * as LotService from './modules/lots/lot.service.ts';
import * as PackingOrderService from './modules/packing-orders/packing-order.service.ts';
import * as TransferService from './modules/transfers/transfer.service.ts';
import * as DashboardService from './modules/dashboard/dashboard.service.ts';
import * as CustomerService from './modules/customers/customer.service.ts';
import * as InventoryMovementService from './modules/inventory-movements/inventory-movement.service.ts';
import * as SalesOrderService from './modules/sales-orders/sales-order.service.ts';
import * as DeliveryOrderService from './modules/delivery-orders/delivery-order.service.ts';
import * as FormulaService from './modules/packing-formulas/packing-formula.service.ts';
import * as InventoryReportService from './modules/inventory-reports/inventory-report.service.ts';
import * as AccountingService from './modules/accounting/accounting.service.ts';
import * as NotificationService from './modules/notifications/notification.service.ts';
import { parseCorsOrigins } from './app.ts';
import { attachSocketServer } from './realtime/socket.ts';

const app = createApp({
    settingsService: SettingsService,
    reasonCodeService: ReasonCodeService,
    itemPackageService: ItemPackageService,
    reorderPolicyService: ReorderPolicyService,
    controlService: ControlService,
    operationalReportService: OperationalReportService,
    userService: UserService,
    roleService: RoleService,
    itemService: ItemService,
    authService: AuthService,
    stockService: StockService,
    inventoryMovementService: InventoryMovementService,
    uomService: UomService,
    locationService: LocationService,
    supplierService: SupplierService,
    purchaseOrderService: PurchaseOrderService,
    receivingService: ReceivingService,
    lotService: LotService,
    packingOrderService: PackingOrderService,
    transferService: TransferService,
    dashboardService: DashboardService,
    customerService: CustomerService,
    salesOrderService: SalesOrderService,
    deliveryOrderService: DeliveryOrderService,
    formulaService: FormulaService,
    inventoryReportService: InventoryReportService,
    accountingService: AccountingService,
    notificationService: NotificationService,
});
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

if (process.env.KFF_SAMPLE_DATA_ON_START === 'true' && !process.env.VERCEL) {
    try {
        const { seedSampleData } = await import('./db/sample-data.ts');
        const result = await seedSampleData();
        logger.info({ sampleData: result.status }, 'Test sample data initialization finished');
    } catch (error) {
        logger.error(
            {
                reason: error instanceof Error ? error.message : String(error),
                code:
                    error && typeof error === 'object' && 'code' in error
                        ? (error as { code?: unknown }).code
                        : undefined,
            },
            'Test sample initialization failed. Enable KFF_ALLOW_TEST_DATA=true and initialize the empty test database schema before starting.',
        );
        process.exit(1);
    }
}

if (!process.env.VERCEL) {
    const httpServer = createServer(app);
    const io =
        process.env.REALTIME_ENABLED === 'false'
            ? null
            : attachSocketServer(httpServer, {
                  corsOrigins: parseCorsOrigins(),
                  getSessionUser: AuthService.getSessionUser,
              });
    httpServer.listen(port, '0.0.0.0', () => {
        logger.info(
            { port, env: process.env.NODE_ENV ?? 'development', realtime: Boolean(io) },
            'Server started',
        );
    });

    let shuttingDown = false;
    const shutdown = (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.info({ signal }, 'Shutting down');
        const forceExit = setTimeout(() => process.exit(0), 10_000);
        forceExit.unref();
        // io.close() disconnects every socket and closes the HTTP server.
        httpServer.closeIdleConnections();
        if (io) io.close(() => process.exit(0));
        else httpServer.close(() => process.exit(0));
    };
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
}

export default app;
