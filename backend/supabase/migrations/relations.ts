import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
	billOfMaterials: {
		itemComponentItemId: r.one.items({
			from: r.billOfMaterials.componentItemId,
			to: r.items.itemId,
			alias: "billOfMaterials_componentItemId_items_itemId"
		}),
		itemParentItemId: r.one.items({
			from: r.billOfMaterials.parentItemId,
			to: r.items.itemId,
			alias: "billOfMaterials_parentItemId_items_itemId"
		}),
		uomClass: r.one.uomClasses({
			from: r.billOfMaterials.uomId,
			to: r.uomClasses.uomId
		}),
	},
	items: {
		billOfMaterialsComponentItemId: r.many.billOfMaterials({
			alias: "billOfMaterials_componentItemId_items_itemId"
		}),
		billOfMaterialsParentItemId: r.many.billOfMaterials({
			alias: "billOfMaterials_parentItemId_items_itemId"
		}),
		inventoryStocks: r.many.inventoryStock(),
		inventoryTransactions: r.many.inventoryTransactions(),
		uomClasses: r.many.uomClasses({
			from: r.items.itemId.through(r.itemPackaging.itemId),
			to: r.uomClasses.uomId.through(r.itemPackaging.uomId),
			alias: "items_itemId_uomClasses_uomId_via_itemPackaging"
		}),
		uomClass: r.one.uomClasses({
			from: r.items.primaryUomId,
			to: r.uomClasses.uomId,
			alias: "items_primaryUomId_uomClasses_uomId"
		}),
		lots: r.many.lots(),
		purchaseOrderLines: r.many.purchaseOrderLines(),
		locations: r.many.locations({
			from: r.items.itemId.through(r.workOrders.itemId),
			to: r.locations.locationId.through(r.workOrders.locationId)
		}),
	},
	uomClasses: {
		billOfMaterials: r.many.billOfMaterials(),
		itemsViaItemPackaging: r.many.items({
			alias: "items_itemId_uomClasses_uomId_via_itemPackaging"
		}),
		itemsPrimaryUomId: r.many.items({
			alias: "items_primaryUomId_uomClasses_uomId"
		}),
	},
	inventoryStock: {
		item: r.one.items({
			from: r.inventoryStock.itemId,
			to: r.items.itemId
		}),
		location: r.one.locations({
			from: r.inventoryStock.locationId,
			to: r.locations.locationId
		}),
		lot: r.one.lots({
			from: r.inventoryStock.lotId,
			to: r.lots.lotId
		}),
	},
	locations: {
		inventoryStocks: r.many.inventoryStock(),
		inventoryTransactions: r.many.inventoryTransactions(),
		items: r.many.items(),
	},
	lots: {
		inventoryStocks: r.many.inventoryStock(),
		inventoryTransactions: r.many.inventoryTransactions(),
		item: r.one.items({
			from: r.lots.itemId,
			to: r.items.itemId
		}),
		purchaseOrderLine: r.one.purchaseOrderLines({
			from: r.lots.poLineId,
			to: r.purchaseOrderLines.poLineId
		}),
		workOrder: r.one.workOrders({
			from: r.lots.workOrderId,
			to: r.workOrders.workOrderId
		}),
	},
	inventoryTransactions: {
		item: r.one.items({
			from: r.inventoryTransactions.itemId,
			to: r.items.itemId
		}),
		location: r.one.locations({
			from: r.inventoryTransactions.locationId,
			to: r.locations.locationId
		}),
		lot: r.one.lots({
			from: r.inventoryTransactions.lotId,
			to: r.lots.lotId
		}),
		purchaseOrderLine: r.one.purchaseOrderLines({
			from: r.inventoryTransactions.poLineId,
			to: r.purchaseOrderLines.poLineId
		}),
		scrapReasonCode: r.one.scrapReasonCodes({
			from: r.inventoryTransactions.reasonId,
			to: r.scrapReasonCodes.reasonId
		}),
		workOrder: r.one.workOrders({
			from: r.inventoryTransactions.workOrderId,
			to: r.workOrders.workOrderId
		}),
		user: r.one.users({
			from: r.inventoryTransactions.authorizedByUserId,
			to: r.users.id
		}),
	},
	purchaseOrderLines: {
		inventoryTransactions: r.many.inventoryTransactions(),
		lots: r.many.lots(),
		item: r.one.items({
			from: r.purchaseOrderLines.itemId,
			to: r.items.itemId
		}),
		itemPackaging: r.one.itemPackaging({
			from: r.purchaseOrderLines.packagingId,
			to: r.itemPackaging.packagingId
		}),
		purchaseOrder: r.one.purchaseOrders({
			from: r.purchaseOrderLines.poId,
			to: r.purchaseOrders.poId
		}),
	},
	scrapReasonCodes: {
		inventoryTransactions: r.many.inventoryTransactions(),
	},
	workOrders: {
		inventoryTransactions: r.many.inventoryTransactions(),
		lots: r.many.lots(),
	},
	users: {
		inventoryTransactions: r.many.inventoryTransactions(),
		role: r.one.roles({
			from: r.users.roleId,
			to: r.roles.id
		}),
	},
	itemPackaging: {
		purchaseOrderLines: r.many.purchaseOrderLines(),
	},
	purchaseOrders: {
		purchaseOrderLines: r.many.purchaseOrderLines(),
		supplier: r.one.suppliers({
			from: r.purchaseOrders.supplierId,
			to: r.suppliers.supplierId
		}),
	},
	suppliers: {
		purchaseOrders: r.many.purchaseOrders(),
	},
	roles: {
		users: r.many.users(),
	},
}))