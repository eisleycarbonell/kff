import * as UomService from './modules/uoms/uom.service.ts';
import * as LocationService from './modules/locations/location.service.ts';
import 'dotenv/config';
import * as StockService from './modules/inventory-stocks/inventory-stock.service.ts';

import { createApp } from './app.ts';
import * as UserService from './modules/users/user.service.ts';
import logger from './utils/logger.ts';
import * as ItemService from './modules/items/item.service.ts';
import * as AuthService from './modules/auth/auth.service.ts';
import * as SupplierService from './modules/suppliers/supplier.service.ts';
import * as PurchaseOrderService from './modules/purchase-orders/purchase-order.service.ts';
import * as ReceivingService from './modules/receiving/receiving.service.ts';
import * as LotService from './modules/lots/lot.service.ts';

const app = createApp({
    userService: UserService,
    itemService: ItemService,
    authService: AuthService,
    stockService: StockService,
    uomService: UomService,
    locationService: LocationService,
    supplierService: SupplierService,
    purchaseOrderService: PurchaseOrderService,
    receivingService: ReceivingService,
    lotService: LotService,
});
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

app.listen(port, () => {
    logger.info({ port, env: process.env.NODE_ENV ?? 'development' }, 'Server started');
});
