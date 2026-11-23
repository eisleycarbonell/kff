import { downloadCsv } from "@/lib/csv"
import {
    getCsvValue,
    hasCsvValue,
    optionalCsvString,
    parseCsvBoolean,
    requiredCsvString,
} from "@/lib/csv-import"
import {
    ITEM_TYPES,
    type CreateItemInput,
    type UpdateItemInput,
} from "@/components/modules/items/item.schema"
import { LOCATION_TYPES } from "@/components/modules/locations/location.schema"
import { CATEGORIES as REASON_CATEGORIES } from "@/components/modules/reason-codes/reason-code.schema"
import {
    EMPTY_SETTINGS,
    NOTIFICATION_TAGS,
    PERMISSIONS,
    type RoleInput,
    type RoleUpdateInput,
} from "@/components/modules/roles/role.schema"
import { settingsInputSchema } from "@/components/modules/company-settings/company-setting.schema"
import { QC_STATUSES, type UpdateLotInput } from "@/components/modules/lots/lot.schema"
import {
    canEditPurchaseOrder,
    type CreatePurchaseOrderInput,
} from "@/components/modules/purchase-orders/purchase-order.schema"
import { getSettings, saveSettings } from "@/hooks/modules/company-settings/use-company-settings"
import {
    createCustomer,
    getCustomers,
    updateCustomer,
} from "@/hooks/modules/customers/use-customers"
import {
    createDeliveryOrder,
    getDeliveryOrderOptions,
    getDeliveryOrders,
    updateDeliveryOrder,
} from "@/hooks/modules/delivery-orders/use-delivery-orders"
import {
    createControl,
    getControlOptions,
    getControls,
} from "@/hooks/modules/inventory-controls/use-inventory-controls"
import {
    getInventoryStocks,
    getStockOptions,
    recordStockAdjustment,
} from "@/hooks/modules/inventory-stocks/use-inventory-stocks"
import {
    getOptions as getPackagingOptions,
    getRecords as getPackagingRecords,
    saveRecord as savePackagingRecord,
} from "@/hooks/modules/item-packaging/use-item-packaging"
import {
    createItem,
    getItems,
    getItemUoms,
    updateItem,
} from "@/hooks/modules/items/use-items"
import {
    createLocation,
    getLocations,
    updateLocation,
} from "@/hooks/modules/locations/use-locations"
import { getLots, updateLot } from "@/hooks/modules/lots/use-lots"
import {
    createPackingOrder,
    getPackingOptions,
    getPackingOrders,
    updatePackingOrder,
} from "@/hooks/modules/packing-orders/use-packing-orders"
import {
    createFormula,
    getFormulaOptions,
    getFormulas,
    updateFormula,
} from "@/hooks/modules/packing-formulas/use-packing-formulas"
import {
    createPurchaseOrder,
    getPurchaseOrderOptions,
    getPurchaseOrders,
    updatePurchaseOrder,
} from "@/hooks/modules/purchase-orders/use-purchase-orders"
import {
    getRecords as getReasonCodeRecords,
    saveRecord as saveReasonCodeRecord,
} from "@/hooks/modules/reason-codes/use-reason-codes"
import { getReceivingOptions, recordReceipt } from "@/hooks/modules/receiving/use-receiving"
import {
    getOptions as getReorderOptions,
    getRecords as getReorderRecords,
    saveRecord as saveReorderRecord,
} from "@/hooks/modules/reorder-policies/use-reorder-policies"
import { createRole, getRoles, updateRole } from "@/hooks/modules/roles/use-roles"
import {
    createSalesOrder,
    getSalesOrderOptions,
    getSalesOrders,
    updateSalesOrder,
} from "@/hooks/modules/sales-orders/use-sales-orders"
import {
    createSupplier,
    getSuppliers,
    updateSupplier,
} from "@/hooks/modules/suppliers/use-suppliers"
import {
    createTransfer,
    getTransferOptions,
    getTransfers,
    updateTransfer,
} from "@/hooks/modules/transfers/use-transfers"
import {
    createUom,
    createUomClass,
    getUomClasses,
    getUoms,
    updateUom,
} from "@/hooks/modules/uoms/use-uoms"
import {
    createUser,
    getUserRoleOptions,
    getUsers,
    updateUser,
} from "@/hooks/modules/users/use-users"

export type BulkImportModuleKey =
    | "items"
    | "item-packaging"
    | "reorder-policies"
    | "reason-codes"
    | "suppliers"
    | "customers"
    | "locations"
    | "uoms"
    | "users"
    | "roles"
    | "company-settings"
    | "lots"
    | "inventory-adjustments"
    | "scrap"
    | "packing-formulas"
    | "purchase-orders"
    | "receiving"
    | "packing-orders"
    | "transfers"
    | "sales-orders"
    | "delivery-orders"

export type BulkImportColumn = {
    key: string
    label: string
    required?: boolean
    description: string
}

export type BulkImportError = {
    row: number
    key: string
    message: string
}

export type BulkImportResult = {
    created: number
    updated: number
    errors: BulkImportError[]
}

export type BulkImportConfig = {
    key: BulkImportModuleKey
    title: string
    description: string
    templateFilename: string
    supportsUpdate: boolean
    columns: BulkImportColumn[]
    sampleRows: string[][]
    queryKeys: string[]
    runImport: (
        rows: Record<string, string>[],
        onProgress?: (done: number, total: number) => void,
    ) => Promise<BulkImportResult>
}

type IndexedRow = { rowNumber: number; row: Record<string, string> }

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unexpected import error."
}

function matchEnum<const T extends readonly string[]>(
    allowed: T,
    value: string,
    label: string,
): T[number] {
    const target = value.trim().toLowerCase()
    const match = allowed.find((candidate) => candidate.toLowerCase() === target)
    if (!match) {
        throw new Error(`${label} "${value}" must be one of: ${allowed.join(", ")}.`)
    }
    return match
}

function parsePositiveInteger(value: string, label: string): number {
    if (!/^\d+$/.test(value.trim())) throw new Error(`${label} must be a positive whole number.`)
    const num = Number(value.trim())
    if (!Number.isSafeInteger(num) || num <= 0 || num > 2_147_483_647) {
        throw new Error(`${label} is out of range.`)
    }
    return num
}

function parseNonNegativeInteger(value: string, label: string): number {
    if (!/^\d+$/.test(value.trim())) throw new Error(`${label} must be a whole number (0 or greater).`)
    const num = Number(value.trim())
    if (!Number.isSafeInteger(num) || num < 0) throw new Error(`${label} is out of range.`)
    return num
}

function toOrderIsoTimestamp(value: string, label: string): string {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T00:00:00.000Z`
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.valueOf())) throw new Error(`${label} must be YYYY-MM-DD or ISO date.`)
    return parsed.toISOString()
}

function groupRowsByKey(
    rows: Record<string, string>[],
    keyField: string,
    keyLabel: string,
): { groups: Array<{ groupKey: string; entries: IndexedRow[] }>; errors: BulkImportError[] } {
    const map = new Map<string, { groupKey: string; entries: IndexedRow[] }>()
    const errors: BulkImportError[] = []

    rows.forEach((row, index) => {
        const rowNumber = index + 2
        const rawKey = getCsvValue(row, keyField)
        if (!rawKey) {
            errors.push({ row: rowNumber, key: "", message: `${keyLabel} is required.` })
            return
        }
        const normalizedKey = rawKey.trim().toUpperCase()
        const existing = map.get(normalizedKey)
        if (existing) {
            existing.entries.push({ rowNumber, row })
        } else {
            map.set(normalizedKey, {
                groupKey: rawKey.trim().toUpperCase(),
                entries: [{ rowNumber, row }],
            })
        }
    })

    return { groups: [...map.values()], errors }
}

async function runSingleRowImport(
    rows: Record<string, string>[],
    keyColumn: string,
    handler: (
        row: Record<string, string>,
        rowNumber: number,
    ) => Promise<"created" | "updated">,
    onProgress?: (done: number, total: number) => void,
): Promise<BulkImportResult> {
    let created = 0
    let updated = 0
    const errors: BulkImportError[] = []

    for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2
        const row = rows[i]
        const key = keyColumn ? getCsvValue(row, keyColumn) : `Row ${rowNumber}`
        try {
            const outcome = await handler(row, rowNumber)
            if (outcome === "created") created++
            else updated++
        } catch (error) {
            errors.push({ row: rowNumber, key, message: toErrorMessage(error) })
        }
        onProgress?.(i + 1, rows.length)
    }

    return { created, updated, errors }
}

function sameHeaderValue<T>(
    entries: IndexedRow[],
    column: string,
    resolver: (row: Record<string, string>) => T,
    label: string,
    equals: (a: T, b: T) => boolean = (a, b) => a === b,
): T {
    const first = resolver(entries[0].row)
    for (let i = 1; i < entries.length; i++) {
        if (hasCsvValue(entries[i].row, column)) {
            const next = resolver(entries[i].row)
            if (!equals(first, next)) {
                throw new Error(`${label} differs across lines for the same document.`)
            }
        }
    }
    return first
}

export const MODULE_BULK_IMPORTS: Record<BulkImportModuleKey, BulkImportConfig> = {
    items: {
        key: "items",
        title: "Items / Products",
        description:
            "Matches existing items by SKU to update them, or creates new items when the SKU does not exist yet.",
        templateFilename: "items-import-template.csv",
        supportsUpdate: true,
        columns: [
            { key: "sku", label: "SKU", required: true, description: "Unique item code (matched for updates)." },
            { key: "name", label: "Name", required: true, description: "Item display name." },
            {
                key: "itemType",
                label: "Item Type",
                required: true,
                description:
                    "Raw Material - Bulk, Packaging - Hardware, Packaging - Label, or Finished Good.",
            },
            { key: "primaryUom", label: "Primary UOM", required: true, description: "Existing unit name (e.g. kg, pcs)." },
            { key: "unitCost", label: "Unit Cost", required: true, description: "Non-negative decimal (up to 4 decimals)." },
            { key: "labelItemSku", label: "Label Item SKU", description: "Optional Packaging - Label SKU for Finished Goods." },
            { key: "netWeightG", label: "Net Weight (g)", description: "Optional positive net weight in grams." },
            { key: "shelfLifeDays", label: "Shelf Life Days", description: "Optional integer days." },
            { key: "requiresQc", label: "Requires QC", description: "true/false (default false)." },
            { key: "isVatable", label: "VATable", description: "true/false (default true; false for VAT-exempt)." },
            { key: "isActive", label: "Active", description: "true/false (default true)." },
        ],
        sampleRows: [
            ["LBL-GARLIC-100G", "Garlic Powder 100g Label", "Packaging - Label", "pcs", "0.50", "", "", "", "false", "true", "true"],
            ["FG-GARLIC-100G", "Garlic Powder 100g Pack", "Finished Good", "pack", "45.00", "LBL-GARLIC-100G", "100", "365", "false", "true", "true"],
        ],
        queryKeys: [
            "items",
            "item-supplier-links",
            "supplier-options",
            "supplier-items",
            "purchase-order-options",
            "dashboard",
            "sales-order-options",
            "sales-order-material-plan",
            "inventory-reports",
            "inventory-control-options",
            "item-packaging-options",
            "reorder-policies-options",
            "operational-reports",
            "inventory-report-options",
            "packing-formulas",
            "packing-formula-options",
            "packing-options",
            "packing-preview",
            "delivery-order-options",
            "sales-orders",
            "delivery-orders",
        ],
        async runImport(rows, onProgress) {
            const [existingItems, uoms] = await Promise.all([getItems(), getItemUoms()])
            const itemsBySku = new Map(existingItems.map((item) => [item.sku.trim().toUpperCase(), item]))
            const uomsByName = new Map(uoms.map((u) => [u.name.trim().toLowerCase(), u]))

            // Process non-finished goods (e.g. Labels) before Finished Goods so labelItemSku created in the same CSV resolves cleanly.
            const indexed: IndexedRow[] = rows.map((row, index) => ({ rowNumber: index + 2, row }))
            indexed.sort((a, b) => {
                const aFg = getCsvValue(a.row, "itemType").toLowerCase() === "finished good" ? 1 : 0
                const bFg = getCsvValue(b.row, "itemType").toLowerCase() === "finished good" ? 1 : 0
                return aFg - bFg || a.rowNumber - b.rowNumber
            })

            let created = 0
            let updated = 0
            const errors: BulkImportError[] = []

            for (let i = 0; i < indexed.length; i++) {
                const { rowNumber, row } = indexed[i]
                const skuRaw = getCsvValue(row, "sku")
                try {
                    const sku = requiredCsvString(row, "sku", "SKU").toUpperCase()
                    const existing = itemsBySku.get(sku)

                    const resolveUomId = (val: string) => {
                        const found = uomsByName.get(val.trim().toLowerCase())
                        if (!found) throw new Error(`Unknown UOM "${val}".`)
                        return found.uomId
                    }
                    const resolveLabelId = (labelSku: string | null) => {
                        if (!labelSku) return null
                        const found = itemsBySku.get(labelSku.trim().toUpperCase())
                        if (!found) throw new Error(`Unknown label item SKU "${labelSku}".`)
                        return found.itemId
                    }

                    if (existing) {
                        const patch: UpdateItemInput = {}
                        if (hasCsvValue(row, "name") && getCsvValue(row, "name")) {
                            patch.name = getCsvValue(row, "name")
                        }
                        if (hasCsvValue(row, "itemType") && getCsvValue(row, "itemType")) {
                            patch.itemType = matchEnum(ITEM_TYPES, getCsvValue(row, "itemType"), "Item Type")
                        }
                        if (hasCsvValue(row, "primaryUom") && getCsvValue(row, "primaryUom")) {
                            patch.primaryUomId = resolveUomId(getCsvValue(row, "primaryUom"))
                        }
                        if (hasCsvValue(row, "unitCost") && getCsvValue(row, "unitCost")) {
                            patch.unitCost = getCsvValue(row, "unitCost")
                        }
                        if (hasCsvValue(row, "labelItemSku")) {
                            patch.labelItemId = resolveLabelId(optionalCsvString(row, "labelItemSku"))
                        }
                        if (hasCsvValue(row, "netWeightG")) {
                            patch.netWeightG = optionalCsvString(row, "netWeightG")
                        }
                        if (hasCsvValue(row, "shelfLifeDays")) {
                            const days = optionalCsvString(row, "shelfLifeDays")
                            patch.shelfLifeDays = days ? parsePositiveInteger(days, "Shelf life days") : null
                        }
                        if (hasCsvValue(row, "requiresQc") && getCsvValue(row, "requiresQc")) {
                            patch.requiresQc = parseCsvBoolean(getCsvValue(row, "requiresQc"), existing.requiresQc)
                        }
                        if (hasCsvValue(row, "isVatable") && getCsvValue(row, "isVatable")) {
                            patch.isVatable = parseCsvBoolean(getCsvValue(row, "isVatable"), existing.isVatable ?? true)
                        }
                        if (hasCsvValue(row, "isActive") && getCsvValue(row, "isActive")) {
                            patch.isActive = parseCsvBoolean(getCsvValue(row, "isActive"), existing.isActive)
                        }
                        const saved = await updateItem(existing.itemId, patch)
                        itemsBySku.set(saved.sku.toUpperCase(), saved)
                        updated++
                    } else {
                        const input: CreateItemInput = {
                            sku,
                            name: requiredCsvString(row, "name", "Name"),
                            itemType: matchEnum(ITEM_TYPES, requiredCsvString(row, "itemType", "Item Type"), "Item Type"),
                            primaryUomId: resolveUomId(requiredCsvString(row, "primaryUom", "Primary UOM")),
                            unitCost: requiredCsvString(row, "unitCost", "Unit Cost"),
                            labelItemId: resolveLabelId(optionalCsvString(row, "labelItemSku")),
                            netWeightG: optionalCsvString(row, "netWeightG"),
                            shelfLifeDays: optionalCsvString(row, "shelfLifeDays")
                                ? parsePositiveInteger(getCsvValue(row, "shelfLifeDays"), "Shelf life days")
                                : null,
                            requiresQc: parseCsvBoolean(getCsvValue(row, "requiresQc"), false),
                            isVatable: parseCsvBoolean(getCsvValue(row, "isVatable"), true),
                            isActive: parseCsvBoolean(getCsvValue(row, "isActive"), true),
                        }
                        const saved = await createItem(input)
                        itemsBySku.set(saved.sku.toUpperCase(), saved)
                        created++
                    }
                } catch (error) {
                    errors.push({ row: rowNumber, key: skuRaw, message: toErrorMessage(error) })
                }
                onProgress?.(i + 1, indexed.length)
            }
            return { created, updated, errors }
        },
    },

    "item-packaging": {
        key: "item-packaging",
        title: "Item Packaging",
        description:
            "Matches existing packaging definitions by (Item SKU + UOM Name) to update them, or creates new records.",
        templateFilename: "item-packaging-import-template.csv",
        supportsUpdate: true,
        columns: [
            { key: "sku", label: "Item SKU", required: true, description: "Existing item SKU." },
            { key: "uomName", label: "Packaging UOM", required: true, description: "Compatible unit name (e.g. case, box)." },
            { key: "baseQty", label: "Base Qty", required: true, description: "Positive decimal quantity in primary UOM." },
            { key: "barcode", label: "Barcode", description: "Optional barcode string." },
            { key: "grossWeightG", label: "Gross Weight (g)", description: "Optional weight in grams." },
        ],
        sampleRows: [["FG-GARLIC-100G", "box", "12", "4800012345678", "1350"]],
        queryKeys: [
            "item-packaging",
            "item-packaging-options",
            "inventory-control-options",
            "inventory-reports",
            "dashboard",
            "receiving-options",
            "packing-options",
            "packing-preview",
        ],
        async runImport(rows, onProgress) {
            const [records, options] = await Promise.all([getPackagingRecords(), getPackagingOptions()])
            const itemBySku = new Map(options.items.map((it) => [it.sku.trim().toUpperCase(), it]))
            const uomByName = new Map(options.uoms.map((u) => [u.name.trim().toLowerCase(), u]))
            const existingMap = new Map(
                records.map((r) => [`${r.itemId}:${r.uomId}`, r]),
            )

            return runSingleRowImport(
                rows,
                "sku",
                async (row) => {
                    const sku = requiredCsvString(row, "sku", "Item SKU").toUpperCase()
                    const uomName = requiredCsvString(row, "uomName", "Packaging UOM")
                    const item = itemBySku.get(sku)
                    if (!item) throw new Error(`Unknown item SKU "${sku}".`)
                    const uom = uomByName.get(uomName.trim().toLowerCase())
                    if (!uom) throw new Error(`Unknown UOM "${uomName}".`)

                    const existing = existingMap.get(`${item.itemId}:${uom.uomId}`) ?? null
                    const baseQty = requiredCsvString(row, "baseQty", "Base Qty")
                    const barcode = hasCsvValue(row, "barcode")
                        ? optionalCsvString(row, "barcode")
                        : (existing?.barcode ?? null)
                    const grossWeightG = hasCsvValue(row, "grossWeightG")
                        ? optionalCsvString(row, "grossWeightG")
                        : (existing?.grossWeightG ?? null)

                    const saved = await savePackagingRecord(
                        {
                            itemId: item.itemId,
                            uomId: uom.uomId,
                            baseQty,
                            barcode,
                            grossWeightG,
                        },
                        existing,
                    )
                    existingMap.set(`${saved.itemId}:${saved.uomId}`, saved)
                    return existing ? "updated" : "created"
                },
                onProgress,
            )
        },
    },

    "reorder-policies": {
        key: "reorder-policies",
        title: "Reorder Levels",
        description:
            "Matches existing reorder levels by Item SKU to update thresholds, or creates new reorder policies.",
        templateFilename: "reorder-policies-import-template.csv",
        supportsUpdate: true,
        columns: [
            { key: "sku", label: "Item SKU", required: true, description: "Existing item SKU." },
            { key: "reorderLevel", label: "Reorder Level", required: true, description: "Non-negative decimal threshold." },
        ],
        sampleRows: [["RM-GARLIC", "25"]],
        queryKeys: [
            "reorder-policies",
            "reorder-policies-options",
            "inventory-control-options",
            "inventory-reports",
            "dashboard",
            "receiving-options",
            "packing-options",
            "packing-preview",
        ],
        async runImport(rows, onProgress) {
            const [records, options] = await Promise.all([getReorderRecords(), getReorderOptions()])
            const itemBySku = new Map(options.items.map((it) => [it.sku.trim().toUpperCase(), it]))
            const existingMap = new Map(records.map((r) => [r.itemId, r]))

            return runSingleRowImport(
                rows,
                "sku",
                async (row) => {
                    const sku = requiredCsvString(row, "sku", "Item SKU").toUpperCase()
                    const item = itemBySku.get(sku)
                    if (!item) throw new Error(`Unknown item SKU "${sku}".`)
                    const reorderLevel = requiredCsvString(row, "reorderLevel", "Reorder Level")
                    const existing = existingMap.get(item.itemId) ?? null
                    const saved = await saveReorderRecord({ itemId: item.itemId, reorderLevel }, existing)
                    existingMap.set(saved.itemId, saved)
                    return existing ? "updated" : "created"
                },
                onProgress,
            )
        },
    },

    "reason-codes": {
        key: "reason-codes",
        title: "Reason Codes",
        description:
            "Matches existing reason codes by Code Name to update category/description/status, or creates new reason codes.",
        templateFilename: "reason-codes-import-template.csv",
        supportsUpdate: true,
        columns: [
            { key: "codeName", label: "Code Name", required: true, description: "Unique reason code name (max 50 chars)." },
            {
                key: "category",
                label: "Category",
                required: true,
                description:
                    "Material Defect, Packing Damage, Spoilage, Expired, Inventory Adjustment, or Other.",
            },
            { key: "description", label: "Description", description: "Optional explanation." },
            { key: "isActive", label: "Active", description: "true/false (default true)." },
        ],
        sampleRows: [["CYCLE_COUNT", "Inventory Adjustment", "Cycle count variance correction", "true"]],
        queryKeys: [
            "reason-codes",
            "inventory-stock-options",
            "inventory-control-options",
            "inventory-controls",
            "inventory-movements",
            "inventory-reports",
            "inventory-report-options",
            "dashboard",
        ],
        async runImport(rows, onProgress) {
            const existingRecords = await getReasonCodeRecords()
            const byCode = new Map(
                existingRecords.map((r) => [r.codeName.trim().toLowerCase(), r]),
            )

            return runSingleRowImport(
                rows,
                "codeName",
                async (row) => {
                    const codeName = requiredCsvString(row, "codeName", "Code Name")
                    const existing = byCode.get(codeName.trim().toLowerCase()) ?? null
                    const category = hasCsvValue(row, "category") && getCsvValue(row, "category")
                        ? matchEnum(REASON_CATEGORIES, getCsvValue(row, "category"), "Category")
                        : existing
                            ? existing.category
                            : matchEnum(REASON_CATEGORIES, requiredCsvString(row, "category", "Category"), "Category")
                    const description = hasCsvValue(row, "description")
                        ? optionalCsvString(row, "description")
                        : (existing?.description ?? null)
                    const isActive = hasCsvValue(row, "isActive") && getCsvValue(row, "isActive")
                        ? parseCsvBoolean(getCsvValue(row, "isActive"), true)
                        : (existing?.isActive ?? true)

                    const saved = await saveReasonCodeRecord(
                        { codeName, category, description, isActive },
                        existing,
                    )
                    byCode.set(saved.codeName.trim().toLowerCase(), saved)
                    return existing ? "updated" : "created"
                },
                onProgress,
            )
        },
    },

    suppliers: {
        key: "suppliers",
        title: "Suppliers",
        description:
            "Matches existing suppliers by Name to update email/active status, or creates new suppliers.",
        templateFilename: "suppliers-import-template.csv",
        supportsUpdate: true,
        columns: [
            { key: "name", label: "Supplier Name", required: true, description: "Unique supplier name." },
            { key: "email", label: "Email", description: "Optional contact email address." },
            { key: "isActive", label: "Active", description: "true/false (default true)." },
        ],
        sampleRows: [["Manila Spice Traders", "orders@manilaspices.example", "true"]],
        queryKeys: [
            "suppliers",
            "supplier-items",
            "supplier-options",
            "purchase-order-options",
            "purchase-orders",
            "receiving-options",
            "dashboard",
            "operational-reports",
        ],
        async runImport(rows, onProgress) {
            const suppliers = await getSuppliers()
            const byName = new Map(suppliers.map((s) => [s.name.trim().toLowerCase(), s]))

            return runSingleRowImport(
                rows,
                "name",
                async (row) => {
                    const name = requiredCsvString(row, "name", "Supplier Name")
                    const existing = byName.get(name.trim().toLowerCase())
                    if (existing) {
                        const saved = await updateSupplier(existing.supplierId, {
                            name,
                            ...(hasCsvValue(row, "email")
                                ? { email: optionalCsvString(row, "email")?.toLowerCase() ?? null }
                                : {}),
                            ...(hasCsvValue(row, "isActive") && getCsvValue(row, "isActive")
                                ? { isActive: parseCsvBoolean(getCsvValue(row, "isActive"), existing.isActive) }
                                : {}),
                        })
                        byName.set(saved.name.trim().toLowerCase(), saved)
                        return "updated"
                    }
                    const saved = await createSupplier({
                        name,
                        email: optionalCsvString(row, "email")?.toLowerCase() ?? null,
                        isActive: parseCsvBoolean(getCsvValue(row, "isActive"), true),
                    })
                    byName.set(saved.name.trim().toLowerCase(), saved)
                    return "created"
                },
                onProgress,
            )
        },
    },

    customers: {
        key: "customers",
        title: "Customers",
        description:
            "Matches existing customers by Name to update contact details/status, or creates new customers.",
        templateFilename: "customers-import-template.csv",
        supportsUpdate: true,
        columns: [
            { key: "name", label: "Customer Name", required: true, description: "Unique customer name." },
            { key: "contactName", label: "Contact Name", description: "Optional primary contact person." },
            { key: "email", label: "Email", description: "Optional email address." },
            { key: "phone", label: "Phone", description: "Optional phone number." },
            { key: "address", label: "Address", description: "Optional billing/delivery address." },
            { key: "notes", label: "Notes", description: "Optional customer notes." },
            { key: "isActive", label: "Active", description: "true/false (default true)." },
        ],
        sampleRows: [["Golden Dragon Market", "Elena Reyes", "purchasing@goldendragon.example", "+63-2-555-0188", "Binondo, Manila", "Preferred delivery Tuesday", "true"]],
        queryKeys: [
            "customers",
            "sales-orders",
            "sales-order-options",
            "delivery-orders",
            "delivery-order-options",
            "dashboard",
            "operational-reports",
        ],
        async runImport(rows, onProgress) {
            const customers = await getCustomers()
            const byName = new Map(customers.map((c) => [c.name.trim().toLowerCase(), c]))

            return runSingleRowImport(
                rows,
                "name",
                async (row) => {
                    const name = requiredCsvString(row, "name", "Customer Name")
                    const existing = byName.get(name.trim().toLowerCase())
                    if (existing) {
                        const saved = await updateCustomer(existing.customerId, {
                            name,
                            ...(hasCsvValue(row, "contactName")
                                ? { contactName: optionalCsvString(row, "contactName") }
                                : {}),
                            ...(hasCsvValue(row, "email")
                                ? { email: optionalCsvString(row, "email")?.toLowerCase() ?? null }
                                : {}),
                            ...(hasCsvValue(row, "phone") ? { phone: optionalCsvString(row, "phone") } : {}),
                            ...(hasCsvValue(row, "address")
                                ? { address: optionalCsvString(row, "address") }
                                : {}),
                            ...(hasCsvValue(row, "notes") ? { notes: optionalCsvString(row, "notes") } : {}),
                            ...(hasCsvValue(row, "isActive") && getCsvValue(row, "isActive")
                                ? { isActive: parseCsvBoolean(getCsvValue(row, "isActive"), existing.isActive) }
                                : {}),
                        })
                        byName.set(saved.name.trim().toLowerCase(), saved)
                        return "updated"
                    }
                    const saved = await createCustomer({
                        name,
                        contactName: optionalCsvString(row, "contactName"),
                        email: optionalCsvString(row, "email")?.toLowerCase() ?? null,
                        phone: optionalCsvString(row, "phone"),
                        address: optionalCsvString(row, "address"),
                        notes: optionalCsvString(row, "notes"),
                        isActive: parseCsvBoolean(getCsvValue(row, "isActive"), true),
                    })
                    byName.set(saved.name.trim().toLowerCase(), saved)
                    return "created"
                },
                onProgress,
            )
        },
    },

    locations: {
        key: "locations",
        title: "Locations",
        description:
            "Matches existing locations by Code to update name/type/status, or creates new storage locations.",
        templateFilename: "locations-import-template.csv",
        supportsUpdate: true,
        columns: [
            { key: "code", label: "Code", required: true, description: "Unique uppercase location code (max 30 chars)." },
            { key: "name", label: "Name", required: true, description: "Location display name." },
            {
                key: "locationType",
                label: "Location Type",
                required: true,
                description: "Warehouse, Packing, Branch, Store, Quarantine, Scrap, or In Transit.",
            },
            { key: "isActive", label: "Active", description: "true/false (default true)." },
        ],
        sampleRows: [["WH-NORTH", "North Cold Warehouse", "Warehouse", "true"]],
        queryKeys: [
            "locations",
            "inventory-stocks",
            "inventory-stock-options",
            "inventory-control-options",
            "inventory-reports",
            "inventory-report-options",
            "receiving-options",
            "packing-options",
            "transfer-options",
            "delivery-order-options",
            "sales-order-options",
            "dashboard",
        ],
        async runImport(rows, onProgress) {
            const locations = await getLocations()
            const byCode = new Map(locations.map((loc) => [loc.code.trim().toUpperCase(), loc]))

            return runSingleRowImport(
                rows,
                "code",
                async (row) => {
                    const code = requiredCsvString(row, "code", "Code").toUpperCase()
                    const existing = byCode.get(code)
                    if (existing) {
                        const saved = await updateLocation(existing.locationId, {
                            code,
                            ...(hasCsvValue(row, "name") && getCsvValue(row, "name")
                                ? { name: getCsvValue(row, "name") }
                                : {}),
                            ...(hasCsvValue(row, "locationType") && getCsvValue(row, "locationType")
                                ? {
                                    locationType: matchEnum(
                                        LOCATION_TYPES,
                                        getCsvValue(row, "locationType"),
                                        "Location Type",
                                    ),
                                }
                                : {}),
                            ...(hasCsvValue(row, "isActive") && getCsvValue(row, "isActive")
                                ? { isActive: parseCsvBoolean(getCsvValue(row, "isActive"), existing.isActive) }
                                : {}),
                        })
                        byCode.set(saved.code.toUpperCase(), saved)
                        return "updated"
                    }
                    const saved = await createLocation({
                        code,
                        name: requiredCsvString(row, "name", "Name"),
                        locationType: matchEnum(
                            LOCATION_TYPES,
                            requiredCsvString(row, "locationType", "Location Type"),
                            "Location Type",
                        ),
                        isActive: parseCsvBoolean(getCsvValue(row, "isActive"), true),
                    })
                    byCode.set(saved.code.toUpperCase(), saved)
                    return "created"
                },
                onProgress,
            )
        },
    },

    uoms: {
        key: "uoms",
        title: "Units of Measure",
        description:
            "Matches existing units by Name to update conversion factors, or creates new UOM classes and units (base units imported first).",
        templateFilename: "uoms-import-template.csv",
        supportsUpdate: true,
        columns: [
            { key: "name", label: "Unit Name", required: true, description: "Unique unit symbol/name (max 20 chars)." },
            { key: "uomClassName", label: "UOM Class", required: true, description: "Class name (auto-created if missing)." },
            { key: "factorToBase", label: "Factor To Base", required: true, description: "Numeric conversion factor (1 for base units)." },
            { key: "isBase", label: "Is Base Unit", description: "true/false (default false; base unit required before derived units)." },
        ],
        sampleRows: [
            ["mL", "Volume", "1", "true"],
            ["L", "Volume", "1000", "false"],
        ],
        queryKeys: [
            "uoms",
            "uom-classes",
            "items",
            "item-uoms",
            "item-packaging",
            "item-packaging-options",
            "supplier-options",
            "purchase-order-options",
            "sales-order-options",
            "inventory-control-options",
        ],
        async runImport(rows, onProgress) {
            const [uoms, classes] = await Promise.all([getUoms(), getUomClasses()])
            const uomsByName = new Map(uoms.map((u) => [u.name.trim().toLowerCase(), u]))
            const classByName = new Map(classes.map((c) => [c.name.trim().toLowerCase(), c]))

            // Base units must be processed before derived units in the same class.
            const indexed: IndexedRow[] = rows.map((row, index) => ({ rowNumber: index + 2, row }))
            indexed.sort((a, b) => {
                let aBase = 0
                let bBase = 0
                try {
                    aBase = parseCsvBoolean(getCsvValue(a.row, "isBase"), false) ? 1 : 0
                } catch {
                    aBase = 0
                }
                try {
                    bBase = parseCsvBoolean(getCsvValue(b.row, "isBase"), false) ? 1 : 0
                } catch {
                    bBase = 0
                }
                return bBase - aBase || a.rowNumber - b.rowNumber
            })

            let created = 0
            let updated = 0
            const errors: BulkImportError[] = []

            for (let i = 0; i < indexed.length; i++) {
                const { rowNumber, row } = indexed[i]
                const rawName = getCsvValue(row, "name")
                try {
                    const name = requiredCsvString(row, "name", "Unit Name")
                    const existing = uomsByName.get(name.trim().toLowerCase())

                    const ensureClassId = async (className: string) => {
                        const key = className.trim().toLowerCase()
                        let uomClass = classByName.get(key)
                        if (!uomClass) {
                            uomClass = await createUomClass({ name: className.trim() })
                            classByName.set(key, uomClass)
                        }
                        return uomClass.uomClassId
                    }

                    if (existing) {
                        const nextClassId =
                            hasCsvValue(row, "uomClassName") && getCsvValue(row, "uomClassName")
                                ? await ensureClassId(getCsvValue(row, "uomClassName"))
                                : existing.uomClassId
                        const nextIsBase =
                            hasCsvValue(row, "isBase") && getCsvValue(row, "isBase")
                                ? parseCsvBoolean(getCsvValue(row, "isBase"), existing.isBase)
                                : existing.isBase
                        const nextFactor =
                            hasCsvValue(row, "factorToBase") && getCsvValue(row, "factorToBase")
                                ? getCsvValue(row, "factorToBase")
                                : existing.factorToBase

                        const saved = await updateUom(existing.uomId, {
                            name,
                            factorToBase: nextFactor,
                            ...(nextClassId !== existing.uomClassId ? { uomClassId: nextClassId } : {}),
                            ...(nextIsBase !== existing.isBase ? { isBase: nextIsBase } : {}),
                        })
                        uomsByName.set(saved.name.trim().toLowerCase(), saved)
                        updated++
                    } else {
                        const className = requiredCsvString(row, "uomClassName", "UOM Class")
                        const uomClassId = await ensureClassId(className)
                        const isBase = parseCsvBoolean(getCsvValue(row, "isBase"), false)
                        const factorToBase = isBase
                            ? optionalCsvString(row, "factorToBase") ?? "1"
                            : requiredCsvString(row, "factorToBase", "Factor To Base")
                        const saved = await createUom({ name, uomClassId, factorToBase, isBase })
                        uomsByName.set(saved.name.trim().toLowerCase(), saved)
                        created++
                    }
                } catch (error) {
                    errors.push({ row: rowNumber, key: rawName, message: toErrorMessage(error) })
                }
                onProgress?.(i + 1, indexed.length)
            }
            return { created, updated, errors }
        },
    },

    users: {
        key: "users",
        title: "Users",
        description:
            "Matches existing users by Email to update profile/role details, or creates new users (password required when creating).",
        templateFilename: "users-import-template.csv",
        supportsUpdate: true,
        columns: [
            { key: "email", label: "Email", required: true, description: "Unique user email (matched for updates)." },
            { key: "firstName", label: "First Name", required: true, description: "User first name." },
            { key: "lastName", label: "Last Name", required: true, description: "User last name." },
            { key: "roleName", label: "Role Name", required: true, description: "Existing role name (e.g. Admin, Staff)." },
            { key: "password", label: "Password", description: "Required when creating a new user (min 8 chars); ignored on update." },
            { key: "mobileNumber", label: "Mobile Number", description: "Optional phone number." },
            { key: "isEmailVerified", label: "Email Verified", description: "true/false (default false)." },
        ],
        sampleRows: [["operator@kff.example", "Marco", "Cruz", "Packing Operator", "TempPass123!", "+63-917-555-0101", "true"]],
        queryKeys: ["users", "user-role-options", "roles"],
        async runImport(rows, onProgress) {
            const [users, roles] = await Promise.all([getUsers(), getUserRoleOptions()])
            const usersByEmail = new Map(users.map((u) => [u.email.trim().toLowerCase(), u]))
            const rolesByName = new Map(roles.map((r) => [r.name.trim().toLowerCase(), r]))

            return runSingleRowImport(
                rows,
                "email",
                async (row) => {
                    const email = requiredCsvString(row, "email", "Email").toLowerCase()
                    const existing = usersByEmail.get(email)

                    const resolveRoleId = (roleName: string) => {
                        const role = rolesByName.get(roleName.trim().toLowerCase())
                        if (!role) throw new Error(`Unknown role "${roleName}".`)
                        return role.roleId
                    }

                    if (existing) {
                        const saved = await updateUser(existing.userId, {
                            email,
                            ...(hasCsvValue(row, "firstName") && getCsvValue(row, "firstName")
                                ? { firstName: getCsvValue(row, "firstName") }
                                : {}),
                            ...(hasCsvValue(row, "lastName") && getCsvValue(row, "lastName")
                                ? { lastName: getCsvValue(row, "lastName") }
                                : {}),
                            ...(hasCsvValue(row, "roleName") && getCsvValue(row, "roleName")
                                ? { roleId: resolveRoleId(getCsvValue(row, "roleName")) }
                                : {}),
                            ...(hasCsvValue(row, "mobileNumber")
                                ? { mobileNumber: optionalCsvString(row, "mobileNumber") }
                                : {}),
                            ...(hasCsvValue(row, "isEmailVerified") && getCsvValue(row, "isEmailVerified")
                                ? {
                                    isEmailVerified: parseCsvBoolean(
                                        getCsvValue(row, "isEmailVerified"),
                                        existing.isEmailVerified,
                                    ),
                                }
                                : {}),
                        })
                        usersByEmail.set(saved.email.trim().toLowerCase(), saved)
                        return "updated"
                    }

                    const password = getCsvValue(row, "password")
                    if (password.length < 8) {
                        throw new Error("Password (at least 8 characters) is required to create a new user.")
                    }
                    const saved = await createUser({
                        email,
                        firstName: requiredCsvString(row, "firstName", "First Name"),
                        lastName: requiredCsvString(row, "lastName", "Last Name"),
                        roleId: resolveRoleId(requiredCsvString(row, "roleName", "Role Name")),
                        password,
                        mobileNumber: optionalCsvString(row, "mobileNumber"),
                        isEmailVerified: parseCsvBoolean(getCsvValue(row, "isEmailVerified"), false),
                    })
                    usersByEmail.set(saved.email.trim().toLowerCase(), saved)
                    return "created"
                },
                onProgress,
            )
        },
    },

    roles: {
        key: "roles",
        title: "Roles & Permissions",
        description:
            "Matches existing roles by Name to update permissions/notification routing, or creates new roles.",
        templateFilename: "roles-import-template.csv",
        supportsUpdate: true,
        columns: [
            { key: "name", label: "Role Name", required: true, description: "Unique role name." },
            { key: "description", label: "Description", description: "Optional role summary." },
            ...PERMISSIONS.map((p) => ({
                key: p.key,
                label: p.label,
                description: `true/false (${p.key}).`,
            })),
            ...NOTIFICATION_TAGS.map((n) => ({
                key: n.key,
                label: n.label,
                description: `true/false (${n.key}).`,
            })),
        ],
        sampleRows: [
            [
                "Warehouse Coordinator",
                "Manages stock adjustments and branch transfers",
                "true",
                "false",
                "false",
                "true",
                "false",
                "false",
                "true",
                "false",
                "false",
                "true",
                "false",
                "false",
                "false",
            ],
        ],
        queryKeys: ["roles", "user-role-options", "users", "session"],
        async runImport(rows, onProgress) {
            const roles = await getRoles()
            const byName = new Map(roles.map((r) => [r.name.trim().toLowerCase(), r]))
            const allKeys = [...PERMISSIONS, ...NOTIFICATION_TAGS].map((entry) => entry.key)

            return runSingleRowImport(
                rows,
                "name",
                async (row) => {
                    const name = requiredCsvString(row, "name", "Role Name")
                    const existing = byName.get(name.trim().toLowerCase())

                    if (existing) {
                        const patch: RoleUpdateInput = { name }
                        if (hasCsvValue(row, "description")) {
                            patch.description = optionalCsvString(row, "description")
                        }
                        const settingsPatch: Partial<RoleInput["settings"]> = {}
                        for (const key of allKeys) {
                            if (hasCsvValue(row, key) && getCsvValue(row, key)) {
                                settingsPatch[key] = parseCsvBoolean(getCsvValue(row, key), existing.settings[key])
                            }
                        }
                        if (Object.keys(settingsPatch).length > 0) {
                            patch.settings = settingsPatch
                        }
                        const saved = await updateRole(existing.roleId, patch)
                        byName.set(saved.name.trim().toLowerCase(), saved)
                        return "updated"
                    }

                    const settings = { ...EMPTY_SETTINGS }
                    for (const key of allKeys) {
                        if (hasCsvValue(row, key) && getCsvValue(row, key)) {
                            settings[key] = parseCsvBoolean(getCsvValue(row, key), false)
                        }
                    }
                    const saved = await createRole({
                        name,
                        description: optionalCsvString(row, "description"),
                        settings,
                    })
                    byName.set(saved.name.trim().toLowerCase(), saved)
                    return "created"
                },
                onProgress,
            )
        },
    },

    "company-settings": {
        key: "company-settings",
        title: "Company Settings",
        description:
            "Updates company identity, currency, and alert thresholds from a single configuration CSV row.",
        templateFilename: "company-settings-import-template.csv",
        supportsUpdate: true,
        columns: [
            { key: "companyName", label: "Company Name", required: true, description: "Official company name." },
            { key: "address", label: "Address", description: "Company headquarters address." },
            { key: "email", label: "Email", description: "Primary contact email." },
            { key: "phone", label: "Phone", description: "Primary phone number." },
            { key: "currencyCode", label: "Currency Code", required: true, description: "3-letter ISO currency code (e.g. PHP, USD)." },
            { key: "defaultReorderLevel", label: "Default Reorder Level", required: true, description: "Default reorder decimal threshold." },
            { key: "expiryWarningDays", label: "Expiry Warning Days", required: true, description: "Whole days (0-3650) before expiry alert." },
            { key: "vatRatePercent", label: "Default VAT %", description: "Optional default VAT rate 0-100 (e.g. 12.00)." },
        ],
        sampleRows: [["KFF Spice Packing Co.", "Quezon City, Metro Manila", "ops@kff.example", "+63-2-555-0100", "PHP", "10", "30", "12.00"]],
        queryKeys: ["company-settings", "dashboard", "inventory-reports", "operational-reports"],
        async runImport(rows, onProgress) {
            if (rows.length > 1) {
                return {
                    created: 0,
                    updated: 0,
                    errors: [
                        {
                            row: 2,
                            key: getCsvValue(rows[0], "companyName"),
                            message:
                                "Company Settings is a single configuration record; include only 1 data row.",
                        },
                    ],
                }
            }
            const current = await getSettings()
            const row = rows[0]
            try {
                const payload = settingsInputSchema.parse({
                    expectedVersion: current.version,
                    companyName:
                        hasCsvValue(row, "companyName") && getCsvValue(row, "companyName")
                            ? getCsvValue(row, "companyName")
                            : current.companyName,
                    address: hasCsvValue(row, "address")
                        ? optionalCsvString(row, "address")
                        : current.address,
                    email: hasCsvValue(row, "email")
                        ? optionalCsvString(row, "email")?.toLowerCase() ?? null
                        : current.email,
                    phone: hasCsvValue(row, "phone")
                        ? optionalCsvString(row, "phone")
                        : current.phone,
                    currencyCode:
                        hasCsvValue(row, "currencyCode") && getCsvValue(row, "currencyCode")
                            ? getCsvValue(row, "currencyCode").toUpperCase()
                            : current.currencyCode,
                    defaultReorderLevel:
                        hasCsvValue(row, "defaultReorderLevel") && getCsvValue(row, "defaultReorderLevel")
                            ? getCsvValue(row, "defaultReorderLevel")
                            : current.defaultReorderLevel,
                    expiryWarningDays:
                        hasCsvValue(row, "expiryWarningDays") && getCsvValue(row, "expiryWarningDays")
                            ? parseNonNegativeInteger(getCsvValue(row, "expiryWarningDays"), "Expiry warning days")
                            : current.expiryWarningDays,
                    vatRatePercent:
                        hasCsvValue(row, "vatRatePercent") && getCsvValue(row, "vatRatePercent")
                            ? getCsvValue(row, "vatRatePercent")
                            : (current.vatRatePercent ?? "12.00"),
                })
                await saveSettings(payload)
                onProgress?.(1, 1)
                return { created: 0, updated: 1, errors: [] }
            } catch (error) {
                onProgress?.(1, 1)
                return {
                    created: 0,
                    updated: 0,
                    errors: [
                        {
                            row: 2,
                            key: getCsvValue(row, "companyName") || "Settings",
                            message: toErrorMessage(error),
                        },
                    ],
                }
            }
        },
    },

    lots: {
        key: "lots",
        title: "Lots / Batches",
        description:
            "Updates supplier lot references, manufacture/expiration dates, or QC status by matching existing Lot Number.",
        templateFilename: "lots-import-template.csv",
        supportsUpdate: true,
        columns: [
            { key: "lotNumber", label: "Lot Number", required: true, description: "Existing lot number to update." },
            { key: "supplierLotNumber", label: "Supplier Lot Number", description: "Optional supplier reference lot." },
            { key: "manufactureDate", label: "Manufacture Date", description: "YYYY-MM-DD (leave empty to clear)." },
            { key: "expirationDate", label: "Expiration Date", description: "YYYY-MM-DD (leave empty to clear)." },
            { key: "qcStatus", label: "QC Status", description: "Quarantine, Approved, Rejected, or Expired." },
        ],
        sampleRows: [["LOT-2026-0001", "SUP-BATCH-99", "2026-01-15", "2027-01-15", "Approved"]],
        queryKeys: [
            "lots",
            "lot-detail",
            "inventory-stocks",
            "inventory-stock-options",
            "inventory-control-options",
            "inventory-reports",
            "transfer-options",
            "delivery-order-options",
            "dashboard",
        ],
        async runImport(rows, onProgress) {
            const lots = await getLots()
            const byLotNumber = new Map(lots.map((l) => [l.lotNumber.trim().toUpperCase(), l]))

            return runSingleRowImport(
                rows,
                "lotNumber",
                async (row) => {
                    const lotNumber = requiredCsvString(row, "lotNumber", "Lot Number").toUpperCase()
                    const existing = byLotNumber.get(lotNumber)
                    if (!existing) throw new Error(`Lot "${lotNumber}" was not found.`)

                    const input: UpdateLotInput = {}
                    if (hasCsvValue(row, "supplierLotNumber")) {
                        input.supplierLotNumber = optionalCsvString(row, "supplierLotNumber")
                    }
                    if (hasCsvValue(row, "manufactureDate")) {
                        input.manufactureDate = optionalCsvString(row, "manufactureDate")
                    }
                    if (hasCsvValue(row, "expirationDate")) {
                        input.expirationDate = optionalCsvString(row, "expirationDate")
                    }
                    if (hasCsvValue(row, "qcStatus") && getCsvValue(row, "qcStatus")) {
                        input.qcStatus = matchEnum(QC_STATUSES, getCsvValue(row, "qcStatus"), "QC Status")
                    }
                    if (Object.keys(input).length === 0) {
                        throw new Error("Provide at least one updatable column for this lot.")
                    }
                    await updateLot(existing.lotId, input)
                    return "updated"
                },
                onProgress,
            )
        },
    },

    "inventory-adjustments": {
        key: "inventory-adjustments",
        title: "Stock Adjustments",
        description:
            "Records physical count adjustments against existing lots and storage locations using active Inventory Adjustment reason codes.",
        templateFilename: "stock-adjustments-import-template.csv",
        supportsUpdate: false,
        columns: [
            { key: "lotNumber", label: "Lot Number", required: true, description: "Existing lot number." },
            { key: "locationCode", label: "Location Code", required: true, description: "Location code (or location name)." },
            { key: "reasonCode", label: "Reason Code", required: true, description: "Active Inventory Adjustment reason code." },
            { key: "qtyOnHand", label: "New Qty On Hand", required: true, description: "Counted on-hand balance in primary UOM." },
            { key: "referenceId", label: "Reference ID", description: "Optional count sheet or reference number." },
        ],
        sampleRows: [["LOT-2026-0001", "WH-MAIN", "CYCLE_COUNT", "48.5", "CC-2026-11"]],
        queryKeys: [
            "inventory-stocks",
            "inventory-stock-options",
            "inventory-movements",
            "inventory-control-options",
            "inventory-reports",
            "lots",
            "lot-detail",
            "packing-options",
            "packing-preview",
            "transfer-options",
            "delivery-order-options",
            "dashboard",
            "accounting",
        ],
        async runImport(rows, onProgress) {
            const [stocks, options] = await Promise.all([getInventoryStocks(), getStockOptions()])
            const lotByNum = new Map(options.lots.map((l) => [l.lotNumber.trim().toUpperCase(), l]))
            const locByKey = new Map<string, number>()
            for (const loc of options.locations) {
                locByKey.set(loc.code.trim().toUpperCase(), loc.locationId)
                locByKey.set(loc.name.trim().toUpperCase(), loc.locationId)
            }
            const reasonByCode = new Map(
                options.reasons.map((r) => [r.codeName.trim().toUpperCase(), r]),
            )
            const stockBalance = new Map<string, string>()
            for (const s of stocks) {
                stockBalance.set(`${s.lotId}:${s.locationId}`, s.qtyOnHand)
            }

            return runSingleRowImport(
                rows,
                "lotNumber",
                async (row) => {
                    const lotNum = requiredCsvString(row, "lotNumber", "Lot Number").toUpperCase()
                    const lot = lotByNum.get(lotNum)
                    if (!lot) throw new Error(`Unknown lot "${lotNum}".`)

                    const locRaw = requiredCsvString(row, "locationCode", "Location Code").toUpperCase()
                    const locationId = locByKey.get(locRaw)
                    if (!locationId) throw new Error(`Unknown location "${locRaw}".`)

                    const reasonRaw = requiredCsvString(row, "reasonCode", "Reason Code").toUpperCase()
                    const reason = reasonByCode.get(reasonRaw)
                    if (!reason) throw new Error(`Unknown adjustment reason "${reasonRaw}".`)

                    const qtyOnHand = requiredCsvString(row, "qtyOnHand", "New Qty On Hand")
                    const expectedQtyOnHand = stockBalance.get(`${lot.lotId}:${locationId}`) ?? "0"
                    if (Number(qtyOnHand) === Number(expectedQtyOnHand)) {
                        throw new Error(`New quantity (${qtyOnHand}) matches current balance (${expectedQtyOnHand}).`)
                    }

                    const result = await recordStockAdjustment({
                        lotId: lot.lotId,
                        locationId,
                        reasonId: reason.reasonId,
                        expectedQtyOnHand,
                        qtyOnHand,
                        referenceId: optionalCsvString(row, "referenceId"),
                    })
                    stockBalance.set(`${lot.lotId}:${locationId}`, result.stock.qtyOnHand)
                    return "created"
                },
                onProgress,
            )
        },
    },

    scrap: {
        key: "scrap",
        title: "Scrap & Disposal",
        description:
            "Creates Draft scrap and disposal requests ready for review and approval.",
        templateFilename: "scrap-requests-import-template.csv",
        supportsUpdate: false,
        columns: [
            { key: "requestNumber", label: "Request Number", required: true, description: "Unique request code (e.g. SCR-2026-001)." },
            { key: "lotNumber", label: "Lot Number", required: true, description: "Source lot number." },
            { key: "sourceLocation", label: "Source Location", required: true, description: "Source location code or name." },
            { key: "reasonCode", label: "Reason Code", required: true, description: "Active non-adjustment reason code." },
            { key: "quantity", label: "Quantity", required: true, description: "Positive quantity to scrap." },
            { key: "notes", label: "Notes", required: true, description: "At least 3 characters describing the scrap cause." },
            { key: "evidenceReference", label: "Evidence Reference", description: "Optional photo/document reference." },
        ],
        sampleRows: [["SCR-2026-001", "LOT-2026-0001", "WH-MAIN", "SPOILAGE", "2.5", "Moisture damage on outer sacks", "PHOTO-104"]],
        queryKeys: ["inventory-controls", "inventory-control-options", "inventory-stocks", "lots", "dashboard"],
        async runImport(rows, onProgress) {
            const [existing, options, locations] = await Promise.all([
                getControls("Scrap"),
                getControlOptions(),
                getLocations(),
            ])
            const usedNumbers = new Set(existing.map((c) => c.requestNumber.trim().toUpperCase()))
            const lotByNum = new Map(options.lots.map((l) => [l.lotNumber.trim().toUpperCase(), l]))
            const locByKey = new Map<string, number>()
            for (const loc of locations) {
                locByKey.set(loc.code.trim().toUpperCase(), loc.locationId)
                locByKey.set(loc.name.trim().toUpperCase(), loc.locationId)
            }
            for (const loc of options.locations) {
                locByKey.set(loc.name.trim().toUpperCase(), loc.locationId)
            }
            const reasonByCode = new Map(options.reasons.map((r) => [r.codeName.trim().toUpperCase(), r]))
            const stockQty = new Map(options.stocks.map((s) => [`${s.lotId}:${s.locationId}`, s.qtyOnHand]))

            return runSingleRowImport(
                rows,
                "requestNumber",
                async (row) => {
                    const requestNumber = requiredCsvString(row, "requestNumber", "Request Number").toUpperCase()
                    if (usedNumbers.has(requestNumber)) {
                        throw new Error(`Scrap request "${requestNumber}" already exists.`)
                    }
                    const lotNum = requiredCsvString(row, "lotNumber", "Lot Number").toUpperCase()
                    const lot = lotByNum.get(lotNum)
                    if (!lot) throw new Error(`Unknown lot "${lotNum}".`)

                    const locKey = requiredCsvString(row, "sourceLocation", "Source Location").toUpperCase()
                    const sourceLocationId = locByKey.get(locKey)
                    if (!sourceLocationId) throw new Error(`Unknown location "${locKey}".`)

                    const reasonCode = requiredCsvString(row, "reasonCode", "Reason Code").toUpperCase()
                    const reason = reasonByCode.get(reasonCode)
                    if (!reason) throw new Error(`Unknown reason code "${reasonCode}".`)

                    const expectedQty = stockQty.get(`${lot.lotId}:${sourceLocationId}`) ?? "0"
                    await createControl({
                        kind: "Scrap",
                        requestNumber,
                        lotId: lot.lotId,
                        sourceLocationId,
                        reasonId: reason.reasonId,
                        quantity: requiredCsvString(row, "quantity", "Quantity"),
                        expectedQty,
                        notes: requiredCsvString(row, "notes", "Notes"),
                        evidenceReference: optionalCsvString(row, "evidenceReference"),
                    })
                    usedNumbers.add(requestNumber)
                    return "created"
                },
                onProgress,
            )
        },
    },

    "packing-formulas": {
        key: "packing-formulas",
        title: "Packing Formulas",
        description:
            "Groups rows by Finished Item SKU to create or update packing formulas directly (multiple rows = multiple BOM components).",
        templateFilename: "packing-formulas-import-template.csv",
        supportsUpdate: true,
        columns: [
            { key: "itemSku", label: "Finished Item SKU", required: true, description: "Active Finished Good SKU." },
            { key: "componentSku", label: "Component SKU", required: true, description: "Raw material, hardware, or label SKU." },
            { key: "quantity", label: "Component Qty", required: true, description: "Quantity per 1 finished unit (up to 6 decimals)." },
            { key: "uomName", label: "Component UOM", description: "Optional unit name (defaults to component primary UOM)." },
        ],
        sampleRows: [
            ["FG-GARLIC-100G", "RM-GARLIC", "0.10", "kg"],
            ["FG-GARLIC-100G", "LBL-GARLIC-100G", "1", "pc"],
        ],
        queryKeys: [
            "packing-formulas",
            "packing-formula-options",
            "packing-options",
            "packing-preview",
            "sales-order-options",
            "sales-order-material-plan",
            "items",
            "dashboard",
        ],
        async runImport(rows, onProgress) {
            const [existing, options] = await Promise.all([
                getFormulas(),
                getFormulaOptions(),
            ])
            const existingByItemId = new Map(existing.map((f) => [f.itemId, f]))
            const productBySku = new Map(options.products.map((p) => [p.sku.trim().toUpperCase(), p]))
            const compBySku = new Map(options.components.map((c) => [c.sku.trim().toUpperCase(), c]))
            const uomByName = new Map(options.uoms.map((u) => [u.name.trim().toLowerCase(), u]))

            const { groups, errors } = groupRowsByKey(rows, "itemSku", "Finished Item SKU")
            let created = 0
            let updated = 0

            for (let i = 0; i < groups.length; i++) {
                const { groupKey, entries } = groups[i]
                try {
                    const product = productBySku.get(groupKey)
                    if (!product) throw new Error(`Unknown or inactive Finished Good SKU "${groupKey}".`)

                    const components = entries.map(({ row }) => {
                        const compSku = requiredCsvString(row, "componentSku", "Component SKU").toUpperCase()
                        const comp = compBySku.get(compSku)
                        if (!comp) throw new Error(`Unknown or inactive component SKU "${compSku}".`)
                        const uomName = getCsvValue(row, "uomName")
                        const uomId = uomName
                            ? uomByName.get(uomName.toLowerCase())?.uomId
                            : comp.primaryUomId
                        if (!uomId) throw new Error(`Unknown component UOM "${uomName}".`)
                        return {
                            componentItemId: comp.itemId,
                            quantity: requiredCsvString(row, "quantity", "Component Qty"),
                            uomId,
                        }
                    })

                    if (existingByItemId.has(product.itemId)) {
                        const saved = await updateFormula(product.itemId, { components })
                        existingByItemId.set(saved.itemId, saved)
                        updated++
                    } else {
                        const saved = await createFormula({ itemId: product.itemId, components })
                        existingByItemId.set(saved.itemId, saved)
                        created++
                    }
                } catch (error) {
                    errors.push({
                        row: entries[0].rowNumber,
                        key: groupKey,
                        message: toErrorMessage(error),
                    })
                }
                onProgress?.(i + 1, groups.length)
            }

            return { created, updated, errors }
        },
    },

    "purchase-orders": {
        key: "purchase-orders",
        title: "Purchase Orders",
        description:
            "Groups rows by PO Number. Updates existing Draft POs matching the PO Number, or creates new Draft purchase orders.",
        templateFilename: "purchase-orders-import-template.csv",
        supportsUpdate: true,
        columns: [
            { key: "poNumber", label: "PO Number", required: true, description: "Unique PO number (repeat per item line)." },
            { key: "supplierName", label: "Supplier Name", required: true, description: "Active supplier linked to the items." },
            { key: "orderDate", label: "Order Date", required: true, description: "YYYY-MM-DD (or ISO datetime)." },
            { key: "expectedDeliveryDate", label: "Expected Delivery", description: "Optional YYYY-MM-DD." },
            { key: "itemSku", label: "Item SKU", required: true, description: "Supplied item SKU." },
            { key: "uomName", label: "UOM", description: "Optional UOM name (defaults to item primary UOM)." },
            { key: "qtyOrdered", label: "Qty Ordered", required: true, description: "Positive decimal quantity." },
            { key: "unitPrice", label: "Unit Price", description: "Decimal price (falls back to supplier default price if blank)." },
            { key: "vatRatePercent", label: "VAT %", description: "Optional VAT rate 0-100 (defaults from item VAT setting)." },
            { key: "notes", label: "Notes", description: "Optional order notes." },
        ],
        sampleRows: [
            ["PO-2026-1001", "Manila Spice Traders", "2026-11-18", "2026-11-25", "RM-GARLIC", "kg", "100", "95.00", "0.00", "Q4 restock"],
            ["PO-2026-1001", "Manila Spice Traders", "2026-11-18", "2026-11-25", "LBL-GARLIC-100G", "pcs", "500", "0.50", "12.00", "Q4 restock"],
        ],
        queryKeys: [
            "purchase-orders",
            "purchase-order-detail",
            "purchase-order-options",
            "receiving-options",
            "dashboard",
            "operational-reports",
        ],
        async runImport(rows, onProgress) {
            const [orders, options] = await Promise.all([
                getPurchaseOrders(),
                getPurchaseOrderOptions(),
            ])
            const existingByNum = new Map(orders.map((o) => [o.poNumber.trim().toUpperCase(), o]))
            const supplierByName = new Map(options.suppliers.map((s) => [s.name.trim().toLowerCase(), s]))
            const itemBySku = new Map(options.items.map((it) => [it.sku.trim().toUpperCase(), it]))
            const uomByName = new Map(options.uoms.map((u) => [u.name.trim().toLowerCase(), u]))
            const offerMap = new Map(
                options.supplierItems.map((si) => [`${si.supplierId}:${si.itemId}`, si]),
            )

            const { groups, errors } = groupRowsByKey(rows, "poNumber", "PO Number")
            let created = 0
            let updated = 0

            for (let i = 0; i < groups.length; i++) {
                const { groupKey, entries } = groups[i]
                const firstRow = entries[0].row
                try {
                    const supplierName = sameHeaderValue(
                        entries,
                        "supplierName",
                        (r) => requiredCsvString(r, "supplierName", "Supplier Name"),
                        "Supplier Name",
                        (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase(),
                    )
                    const supplier = supplierByName.get(supplierName.trim().toLowerCase())
                    if (!supplier) throw new Error(`Unknown supplier "${supplierName}".`)

                    const orderDateRaw = sameHeaderValue(
                        entries,
                        "orderDate",
                        (r) => requiredCsvString(r, "orderDate", "Order Date"),
                        "Order Date",
                    )
                    const orderDate = toOrderIsoTimestamp(orderDateRaw, "Order Date")
                    const expectedDeliveryDate = optionalCsvString(firstRow, "expectedDeliveryDate")
                    const notes = optionalCsvString(firstRow, "notes")

                    const lines: CreatePurchaseOrderInput["lines"] = entries.map(({ row }) => {
                        const sku = requiredCsvString(row, "itemSku", "Item SKU").toUpperCase()
                        const item = itemBySku.get(sku)
                        if (!item) throw new Error(`Unknown item SKU "${sku}".`)
                        const offer = offerMap.get(`${supplier.supplierId}:${item.itemId}`)
                        const uomName = getCsvValue(row, "uomName")
                        const uomId = uomName
                            ? uomByName.get(uomName.toLowerCase())?.uomId
                            : (offer?.defaultUomId ?? item.primaryUomId)
                        if (!uomId) throw new Error(`Unknown UOM "${uomName}".`)

                        const price = getCsvValue(row, "unitPrice") || offer?.defaultPrice || ""
                        if (!price) {
                            throw new Error(`Unit price is required for SKU "${sku}" (no supplier default price).`)
                        }
                        const vatRatePercent = optionalCsvString(row, "vatRatePercent")
                        return {
                            itemId: item.itemId,
                            uomId,
                            qtyOrdered: requiredCsvString(row, "qtyOrdered", "Qty Ordered"),
                            unitPrice: price,
                            ...(vatRatePercent ? { vatRatePercent } : {}),
                        }
                    })

                    const existing = existingByNum.get(groupKey)
                    if (existing) {
                        if (!canEditPurchaseOrder(existing)) {
                            throw new Error(`PO "${groupKey}" is ${existing.status} and cannot be edited.`)
                        }
                        await updatePurchaseOrder(existing.poId, {
                            supplierId: supplier.supplierId,
                            orderDate,
                            expectedDeliveryDate,
                            notes,
                            lines,
                        })
                        updated++
                    } else {
                        const saved = await createPurchaseOrder({
                            poNumber: groupKey,
                            supplierId: supplier.supplierId,
                            orderDate,
                            expectedDeliveryDate,
                            notes,
                            lines,
                        })
                        existingByNum.set(saved.poNumber.toUpperCase(), saved)
                        created++
                    }
                } catch (error) {
                    errors.push({
                        row: entries[0].rowNumber,
                        key: groupKey,
                        message: toErrorMessage(error),
                    })
                }
                onProgress?.(i + 1, groups.length)
            }

            return { created, updated, errors }
        },
    },

    receiving: {
        key: "receiving",
        title: "Receiving",
        description:
            "Groups receipt lots by PO Number to record incoming stock against Sent or Partially Received purchase orders.",
        templateFilename: "receiving-import-template.csv",
        supportsUpdate: false,
        columns: [
            { key: "poNumber", label: "PO Number", required: true, description: "Open Sent / Partially Received PO number." },
            { key: "itemSku", label: "Item SKU", required: true, description: "SKU on the PO line." },
            { key: "uomName", label: "UOM", description: "Optional UOM name if item appears multiple times on PO." },
            { key: "qtyReceived", label: "Qty Received", required: true, description: "Positive quantity received into this lot." },
            { key: "lotNumber", label: "Lot Number", required: true, description: "Unique new lot number." },
            { key: "locationCode", label: "Location Code", required: true, description: "Destination storage location code or name." },
            { key: "supplierLotNumber", label: "Supplier Lot Number", description: "Optional vendor lot code." },
            { key: "manufactureDate", label: "Manufacture Date", description: "Optional YYYY-MM-DD." },
            { key: "expirationDate", label: "Expiration Date", description: "Optional YYYY-MM-DD." },
        ],
        sampleRows: [["PO-2026-0001", "RM-GARLIC", "kg", "50", "LOT-2026-101", "WH-MAIN", "SUP-881", "2026-10-01", "2027-10-01"]],
        queryKeys: [
            "receiving",
            "receiving-options",
            "purchase-orders",
            "purchase-order-detail",
            "lots",
            "inventory-stocks",
            "inventory-stock-options",
            "inventory-movements",
            "inventory-reports",
            "packing-options",
            "packing-preview",
            "transfer-options",
            "delivery-order-options",
            "dashboard",
            "operational-reports",
            "accounting",
        ],
        async runImport(rows, onProgress) {
            const options = await getReceivingOptions()
            const orderByNum = new Map(options.orders.map((o) => [o.poNumber.trim().toUpperCase(), o]))
            const locByKey = new Map<string, number>()
            for (const loc of options.locations) {
                locByKey.set(loc.code.trim().toUpperCase(), loc.locationId)
                locByKey.set(loc.name.trim().toUpperCase(), loc.locationId)
            }

            const { groups, errors } = groupRowsByKey(rows, "poNumber", "PO Number")
            let created = 0

            for (let i = 0; i < groups.length; i++) {
                const { groupKey, entries } = groups[i]
                try {
                    const order = orderByNum.get(groupKey)
                    if (!order) {
                        throw new Error(`Open purchase order "${groupKey}" was not found for receiving.`)
                    }

                    const lines = entries.map(({ row }) => {
                        const sku = requiredCsvString(row, "itemSku", "Item SKU").toUpperCase()
                        const uomName = getCsvValue(row, "uomName").toLowerCase()
                        const candidates = order.lines.filter(
                            (l) => l.itemSku.trim().toUpperCase() === sku,
                        )
                        const poLine = uomName
                            ? candidates.find((l) => l.uomName.trim().toLowerCase() === uomName)
                            : candidates[0]
                        if (!poLine) {
                            throw new Error(`PO "${groupKey}" has no open line for SKU "${sku}".`)
                        }

                        const locKey = requiredCsvString(row, "locationCode", "Location Code").toUpperCase()
                        const locationId = locByKey.get(locKey)
                        if (!locationId) throw new Error(`Unknown receiving location "${locKey}".`)

                        return {
                            poLineId: poLine.poLineId,
                            qtyReceived: requiredCsvString(row, "qtyReceived", "Qty Received"),
                            expectedQtyReceived: poLine.qtyReceived,
                            lotNumber: requiredCsvString(row, "lotNumber", "Lot Number").toUpperCase(),
                            supplierLotNumber: optionalCsvString(row, "supplierLotNumber"),
                            locationId,
                            manufactureDate: optionalCsvString(row, "manufactureDate"),
                            expirationDate: optionalCsvString(row, "expirationDate"),
                        }
                    })

                    const result = await recordReceipt({ poId: order.poId, lines })
                    created += result.receipts.length
                } catch (error) {
                    errors.push({
                        row: entries[0].rowNumber,
                        key: groupKey,
                        message: toErrorMessage(error),
                    })
                }
                onProgress?.(i + 1, groups.length)
            }

            return { created, updated: 0, errors }
        },
    },

    "packing-orders": {
        key: "packing-orders",
        title: "Packing Orders",
        description:
            "Matches existing Draft packing orders by Packing Order Number to update metadata, or creates new Draft packing orders.",
        templateFilename: "packing-orders-import-template.csv",
        supportsUpdate: true,
        columns: [
            { key: "packingOrderNumber", label: "Packing Order #", required: true, description: "Unique packing order number." },
            { key: "itemSku", label: "Finished Item SKU", required: true, description: "Finished Good SKU with published formula." },
            { key: "targetQty", label: "Target Qty", required: true, description: "Positive target quantity to pack." },
            { key: "sourceLocationCode", label: "Source Location", required: true, description: "Material Warehouse/Packing location code." },
            { key: "destinationLocationCode", label: "Destination Location", required: true, description: "Finished goods destination location code." },
            { key: "scheduledDate", label: "Scheduled Date", description: "Optional YYYY-MM-DD." },
            { key: "notes", label: "Notes", description: "Optional packing instructions." },
        ],
        sampleRows: [["PKO-2026-1001", "FG-GARLIC-100G", "100", "WH-MAIN", "PK-AREA-1", "2026-11-20", "Batch packing run"]],
        queryKeys: [
            "packing-orders",
            "packing-detail",
            "packing-reservations",
            "packing-preview",
            "packing-options",
            "inventory-stocks",
            "inventory-stock-options",
            "dashboard",
            "operational-reports",
        ],
        async runImport(rows, onProgress) {
            const [orders, options] = await Promise.all([getPackingOrders(), getPackingOptions()])
            const existingByNum = new Map(
                orders.map((o) => [o.packingOrderNumber.trim().toUpperCase(), o]),
            )
            const itemBySku = new Map(options.items.map((it) => [it.sku.trim().toUpperCase(), it]))
            const locByKey = new Map<string, number>()
            for (const loc of options.locations) {
                locByKey.set(loc.code.trim().toUpperCase(), loc.locationId)
                locByKey.set(loc.name.trim().toUpperCase(), loc.locationId)
            }

            return runSingleRowImport(
                rows,
                "packingOrderNumber",
                async (row) => {
                    const packingOrderNumber = requiredCsvString(
                        row,
                        "packingOrderNumber",
                        "Packing Order #",
                    ).toUpperCase()
                    const existing = existingByNum.get(packingOrderNumber)

                    const resolveLoc = (col: string, label: string) => {
                        const key = requiredCsvString(row, col, label).toUpperCase()
                        const id = locByKey.get(key)
                        if (!id) throw new Error(`Unknown ${label} "${key}".`)
                        return id
                    }

                    if (existing) {
                        if (existing.status !== "Draft") {
                            throw new Error(`Packing order "${packingOrderNumber}" is ${existing.status}; only Draft orders can be updated.`)
                        }
                        const destinationLocationId =
                            hasCsvValue(row, "destinationLocationCode") &&
                                getCsvValue(row, "destinationLocationCode")
                                ? resolveLoc("destinationLocationCode", "Destination Location")
                                : existing.destinationLocationId
                        const saved = await updatePackingOrder(existing.packingOrderId, {
                            packingOrderNumber,
                            destinationLocationId,
                            scheduledDate: hasCsvValue(row, "scheduledDate")
                                ? optionalCsvString(row, "scheduledDate")
                                : existing.scheduledDate,
                            notes: hasCsvValue(row, "notes")
                                ? optionalCsvString(row, "notes")
                                : existing.notes,
                        })
                        existingByNum.set(saved.packingOrderNumber.toUpperCase(), saved)
                        return "updated"
                    }

                    const sku = requiredCsvString(row, "itemSku", "Finished Item SKU").toUpperCase()
                    const item = itemBySku.get(sku)
                    if (!item) throw new Error(`Unknown finished item SKU "${sku}".`)
                    if (!item.hasBom) throw new Error(`Item "${sku}" does not have a published packing formula.`)

                    const saved = await createPackingOrder({
                        packingOrderNumber,
                        itemId: item.itemId,
                        targetQty: requiredCsvString(row, "targetQty", "Target Qty"),
                        sourceLocationId: resolveLoc("sourceLocationCode", "Source Location"),
                        destinationLocationId: resolveLoc("destinationLocationCode", "Destination Location"),
                        scheduledDate: optionalCsvString(row, "scheduledDate"),
                        notes: optionalCsvString(row, "notes"),
                    })
                    existingByNum.set(saved.packingOrderNumber.toUpperCase(), saved)
                    return "created"
                },
                onProgress,
            )
        },
    },

    transfers: {
        key: "transfers",
        title: "Stock Transfers",
        description:
            "Groups rows by Transfer Number. Updates existing Draft transfers or creates new Draft stock transfers.",
        templateFilename: "transfers-import-template.csv",
        supportsUpdate: true,
        columns: [
            { key: "transferNumber", label: "Transfer Number", required: true, description: "Unique transfer number (repeat per lot line)." },
            { key: "sourceLocationCode", label: "Source Location", required: true, description: "Source Warehouse code or name." },
            { key: "destinationLocationCode", label: "Destination Location", required: true, description: "Destination Warehouse, Branch, or Store." },
            { key: "itemSku", label: "Item SKU", required: true, description: "Finished Good SKU." },
            { key: "lotNumber", label: "Lot Number", required: true, description: "Available lot at the source location." },
            { key: "qtyRequested", label: "Qty Requested", required: true, description: "Positive decimal quantity to transfer." },
            { key: "notes", label: "Notes", description: "Optional transfer notes." },
        ],
        sampleRows: [["TRF-2026-1001", "WH-MAIN", "BR-MAKATI", "FG-GARLIC-100G", "LOT-FG-001", "25", "Weekly branch replenishment"]],
        queryKeys: [
            "transfers",
            "transfer-detail",
            "transfer-options",
            "inventory-stocks",
            "inventory-stock-options",
            "delivery-order-options",
            "dashboard",
        ],
        async runImport(rows, onProgress) {
            const [transfers, options] = await Promise.all([getTransfers(), getTransferOptions()])
            const existingByNum = new Map(transfers.map((t) => [t.transferNumber.trim().toUpperCase(), t]))
            const locByKey = new Map<string, number>()
            for (const loc of options.locations) {
                locByKey.set(loc.code.trim().toUpperCase(), loc.locationId)
                locByKey.set(loc.name.trim().toUpperCase(), loc.locationId)
            }
            const stockByKey = new Map(
                options.stock.map((s) => [
                    `${s.locationId}:${s.itemSku.trim().toUpperCase()}:${s.lotNumber.trim().toUpperCase()}`,
                    s,
                ]),
            )

            const { groups, errors } = groupRowsByKey(rows, "transferNumber", "Transfer Number")
            let created = 0
            let updated = 0

            for (let i = 0; i < groups.length; i++) {
                const { groupKey, entries } = groups[i]
                const firstRow = entries[0].row
                try {
                    const sourceKey = sameHeaderValue(
                        entries,
                        "sourceLocationCode",
                        (r) => requiredCsvString(r, "sourceLocationCode", "Source Location").toUpperCase(),
                        "Source Location",
                    )
                    const destKey = sameHeaderValue(
                        entries,
                        "destinationLocationCode",
                        (r) => requiredCsvString(r, "destinationLocationCode", "Destination Location").toUpperCase(),
                        "Destination Location",
                    )
                    const sourceLocationId = locByKey.get(sourceKey)
                    if (!sourceLocationId) throw new Error(`Unknown source location "${sourceKey}".`)
                    const destinationLocationId = locByKey.get(destKey)
                    if (!destinationLocationId) throw new Error(`Unknown destination location "${destKey}".`)

                    const lines = entries.map(({ row }) => {
                        const sku = requiredCsvString(row, "itemSku", "Item SKU").toUpperCase()
                        const lotNumber = requiredCsvString(row, "lotNumber", "Lot Number").toUpperCase()
                        const stock = stockByKey.get(`${sourceLocationId}:${sku}:${lotNumber}`)
                        if (!stock) {
                            throw new Error(`No eligible stock for "${sku}" lot "${lotNumber}" at "${sourceKey}".`)
                        }
                        return {
                            itemId: stock.itemId,
                            lotId: stock.lotId,
                            qtyRequested: requiredCsvString(row, "qtyRequested", "Qty Requested"),
                        }
                    })

                    const existing = existingByNum.get(groupKey)
                    if (existing) {
                        if (existing.status !== "Draft") {
                            throw new Error(`Transfer "${groupKey}" is ${existing.status}; only Draft transfers can be updated.`)
                        }
                        await updateTransfer(existing.transferId, {
                            transferNumber: groupKey,
                            sourceLocationId,
                            destinationLocationId,
                            notes: optionalCsvString(firstRow, "notes"),
                            lines,
                        })
                        updated++
                    } else {
                        const saved = await createTransfer({
                            transferNumber: groupKey,
                            sourceLocationId,
                            destinationLocationId,
                            notes: optionalCsvString(firstRow, "notes"),
                            lines,
                        })
                        existingByNum.set(saved.transferNumber.toUpperCase(), saved)
                        created++
                    }
                } catch (error) {
                    errors.push({
                        row: entries[0].rowNumber,
                        key: groupKey,
                        message: toErrorMessage(error),
                    })
                }
                onProgress?.(i + 1, groups.length)
            }

            return { created, updated, errors }
        },
    },

    "sales-orders": {
        key: "sales-orders",
        title: "Sales Orders",
        description:
            "Groups rows by Sales Order Number. Updates existing Draft sales orders or creates new Draft sales orders.",
        templateFilename: "sales-orders-import-template.csv",
        supportsUpdate: true,
        columns: [
            { key: "salesOrderNumber", label: "Sales Order #", required: true, description: "Unique sales order number (repeat per item line)." },
            { key: "customerName", label: "Customer Name", required: true, description: "Active customer name." },
            { key: "customerPoNumber", label: "Customer PO #", description: "Optional customer PO reference." },
            { key: "orderDate", label: "Order Date", required: true, description: "YYYY-MM-DD." },
            { key: "requestedDeliveryDate", label: "Requested Delivery", description: "Optional YYYY-MM-DD." },
            { key: "itemSku", label: "Item SKU", required: true, description: "Finished Good SKU." },
            { key: "uomName", label: "UOM", description: "Optional unit name (defaults to item primary UOM)." },
            { key: "qtyOrdered", label: "Qty Ordered", required: true, description: "Positive decimal quantity." },
            { key: "unitPrice", label: "Unit Price", required: true, description: "Selling unit price decimal." },
            { key: "vatRatePercent", label: "VAT %", description: "Optional VAT rate 0-100 (defaults from item VAT setting)." },
            { key: "notes", label: "Notes", description: "Optional order notes." },
        ],
        sampleRows: [["SO-2026-1001", "Golden Dragon Market", "CUST-PO-884", "2026-11-18", "2026-11-24", "FG-GARLIC-100G", "pack", "40", "68.00", "12.00", "Deliver before noon"]],
        queryKeys: [
            "sales-orders",
            "sales-order-detail",
            "sales-order-options",
            "sales-order-material-plan",
            "delivery-order-options",
            "dashboard",
            "operational-reports",
        ],
        async runImport(rows, onProgress) {
            const [orders, options, allUoms] = await Promise.all([
                getSalesOrders(),
                getSalesOrderOptions(),
                getUoms(),
            ])
            const existingByNum = new Map(
                orders.map((o) => [o.salesOrderNumber.trim().toUpperCase(), o]),
            )
            const customerByName = new Map(
                options.customers.map((c) => [c.name.trim().toLowerCase(), c]),
            )
            const itemBySku = new Map(options.items.map((it) => [it.sku.trim().toUpperCase(), it]))
            const uomByName = new Map(allUoms.map((u) => [u.name.trim().toLowerCase(), u]))

            const { groups, errors } = groupRowsByKey(rows, "salesOrderNumber", "Sales Order #")
            let created = 0
            let updated = 0

            for (let i = 0; i < groups.length; i++) {
                const { groupKey, entries } = groups[i]
                const firstRow = entries[0].row
                try {
                    const customerName = sameHeaderValue(
                        entries,
                        "customerName",
                        (r) => requiredCsvString(r, "customerName", "Customer Name"),
                        "Customer Name",
                        (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase(),
                    )
                    const customer = customerByName.get(customerName.trim().toLowerCase())
                    if (!customer) throw new Error(`Unknown customer "${customerName}".`)

                    const orderDate = sameHeaderValue(
                        entries,
                        "orderDate",
                        (r) => requiredCsvString(r, "orderDate", "Order Date"),
                        "Order Date",
                    )

                    const lines = entries.map(({ row }) => {
                        const sku = requiredCsvString(row, "itemSku", "Item SKU").toUpperCase()
                        const item = itemBySku.get(sku)
                        if (!item) throw new Error(`Unknown finished item SKU "${sku}".`)
                        const uomName = getCsvValue(row, "uomName")
                        const uomId = uomName
                            ? uomByName.get(uomName.toLowerCase())?.uomId
                            : item.primaryUomId
                        if (!uomId) throw new Error(`Unknown UOM "${uomName}".`)
                        const vatRatePercent = optionalCsvString(row, "vatRatePercent")
                        return {
                            itemId: item.itemId,
                            uomId,
                            qtyOrdered: requiredCsvString(row, "qtyOrdered", "Qty Ordered"),
                            unitPrice: requiredCsvString(row, "unitPrice", "Unit Price"),
                            ...(vatRatePercent ? { vatRatePercent } : {}),
                        }
                    })

                    const payload = {
                        salesOrderNumber: groupKey,
                        customerId: customer.customerId,
                        customerPoNumber: optionalCsvString(firstRow, "customerPoNumber"),
                        orderDate,
                        requestedDeliveryDate: optionalCsvString(firstRow, "requestedDeliveryDate"),
                        notes: optionalCsvString(firstRow, "notes"),
                        lines,
                    }

                    const existing = existingByNum.get(groupKey)
                    if (existing) {
                        if (existing.status !== "Draft") {
                            throw new Error(`Sales order "${groupKey}" is ${existing.status}; only Draft orders can be updated.`)
                        }
                        await updateSalesOrder(existing.salesOrderId, payload)
                        updated++
                    } else {
                        const saved = await createSalesOrder(payload)
                        existingByNum.set(saved.salesOrderNumber.toUpperCase(), saved)
                        created++
                    }
                } catch (error) {
                    errors.push({
                        row: entries[0].rowNumber,
                        key: groupKey,
                        message: toErrorMessage(error),
                    })
                }
                onProgress?.(i + 1, groups.length)
            }

            return { created, updated, errors }
        },
    },

    "delivery-orders": {
        key: "delivery-orders",
        title: "Delivery Orders",
        description:
            "Groups rows by Delivery Order Number. Updates existing Draft deliveries or creates new Draft delivery allocations.",
        templateFilename: "delivery-orders-import-template.csv",
        supportsUpdate: true,
        columns: [
            { key: "deliveryOrderNumber", label: "Delivery Order #", required: true, description: "Unique delivery number (repeat per lot line)." },
            { key: "salesOrderNumber", label: "Sales Order #", required: true, description: "Confirmed/Partially Delivered Sales Order number." },
            { key: "sourceLocationName", label: "Source Location", required: true, description: "Warehouse, Branch, or Store name (or code)." },
            { key: "deliveryDate", label: "Delivery Date", required: true, description: "YYYY-MM-DD." },
            { key: "itemSku", label: "Item SKU", required: true, description: "Finished Good SKU on the sales order." },
            { key: "lotNumber", label: "Lot Number", required: true, description: "Approved finished lot at the source location." },
            { key: "qtyDelivered", label: "Qty Delivered", required: true, description: "Positive decimal quantity allocated." },
            { key: "notes", label: "Notes", description: "Optional dispatch instructions." },
        ],
        sampleRows: [["DO-2026-1001", "SO-2026-1001", "Main Warehouse", "2026-11-24", "FG-GARLIC-100G", "LOT-FG-001", "40", "Cold truck dispatch"]],
        queryKeys: [
            "delivery-orders",
            "delivery-order-detail",
            "delivery-order-options",
            "sales-orders",
            "sales-order-options",
            "inventory-stocks",
            "inventory-stock-options",
            "transfer-options",
            "dashboard",
        ],
        async runImport(rows, onProgress) {
            const [orders, options, allLocations] = await Promise.all([
                getDeliveryOrders(),
                getDeliveryOrderOptions(),
                getLocations(),
            ])
            const existingByNum = new Map(
                orders.map((o) => [o.deliveryOrderNumber.trim().toUpperCase(), o]),
            )
            const soByNum = new Map(
                options.salesOrders.map((so) => [so.salesOrderNumber.trim().toUpperCase(), so]),
            )
            const locByKey = new Map<string, number>()
            for (const loc of allLocations) {
                locByKey.set(loc.code.trim().toUpperCase(), loc.locationId)
                locByKey.set(loc.name.trim().toUpperCase(), loc.locationId)
            }
            for (const loc of options.locations) {
                locByKey.set(loc.name.trim().toUpperCase(), loc.locationId)
            }
            const stockByKey = new Map(
                options.stock.map((s) => [
                    `${s.locationId}:${s.itemSku.trim().toUpperCase()}:${s.lotNumber.trim().toUpperCase()}`,
                    s,
                ]),
            )

            const { groups, errors } = groupRowsByKey(
                rows,
                "deliveryOrderNumber",
                "Delivery Order #",
            )
            let created = 0
            let updated = 0

            for (let i = 0; i < groups.length; i++) {
                const { groupKey, entries } = groups[i]
                const firstRow = entries[0].row
                try {
                    const soNum = sameHeaderValue(
                        entries,
                        "salesOrderNumber",
                        (r) => requiredCsvString(r, "salesOrderNumber", "Sales Order #").toUpperCase(),
                        "Sales Order #",
                    )
                    const salesOrder = soByNum.get(soNum)
                    if (!salesOrder) {
                        throw new Error(`Eligible sales order "${soNum}" was not found.`)
                    }

                    const locKey = sameHeaderValue(
                        entries,
                        "sourceLocationName",
                        (r) => requiredCsvString(r, "sourceLocationName", "Source Location").toUpperCase(),
                        "Source Location",
                    )
                    const sourceLocationId = locByKey.get(locKey)
                    if (!sourceLocationId) throw new Error(`Unknown source location "${locKey}".`)

                    const deliveryDate = sameHeaderValue(
                        entries,
                        "deliveryDate",
                        (r) => requiredCsvString(r, "deliveryDate", "Delivery Date"),
                        "Delivery Date",
                    )

                    const lines = entries.map(({ row }) => {
                        const sku = requiredCsvString(row, "itemSku", "Item SKU").toUpperCase()
                        const lotNumber = requiredCsvString(row, "lotNumber", "Lot Number").toUpperCase()
                        const soLine = salesOrder.lines.find(
                            (l) => l.itemSku.trim().toUpperCase() === sku,
                        )
                        if (!soLine) {
                            throw new Error(`Sales order "${soNum}" has no line for SKU "${sku}".`)
                        }
                        const stock = stockByKey.get(`${sourceLocationId}:${sku}:${lotNumber}`)
                        if (!stock) {
                            throw new Error(`No eligible stock for "${sku}" lot "${lotNumber}" at "${locKey}".`)
                        }
                        return {
                            salesOrderLineId: soLine.salesOrderLineId,
                            lotId: stock.lotId,
                            qtyDelivered: requiredCsvString(row, "qtyDelivered", "Qty Delivered"),
                        }
                    })

                    const payload = {
                        deliveryOrderNumber: groupKey,
                        salesOrderId: salesOrder.salesOrderId,
                        sourceLocationId,
                        deliveryDate,
                        notes: optionalCsvString(firstRow, "notes"),
                        lines,
                    }

                    const existing = existingByNum.get(groupKey)
                    if (existing) {
                        if (existing.status !== "Draft") {
                            throw new Error(`Delivery order "${groupKey}" is ${existing.status}; only Draft deliveries can be updated.`)
                        }
                        await updateDeliveryOrder(existing.deliveryOrderId, payload)
                        updated++
                    } else {
                        const saved = await createDeliveryOrder(payload)
                        existingByNum.set(saved.deliveryOrderNumber.toUpperCase(), saved)
                        created++
                    }
                } catch (error) {
                    errors.push({
                        row: entries[0].rowNumber,
                        key: groupKey,
                        message: toErrorMessage(error),
                    })
                }
                onProgress?.(i + 1, groups.length)
            }

            return { created, updated, errors }
        },
    },
}

/** Generate and download the CSV template for a writable module. */
export function downloadModuleTemplate(moduleKey: BulkImportModuleKey) {
    const config = MODULE_BULK_IMPORTS[moduleKey]
    const headerRow = config.columns.map((column) => column.key)
    downloadCsv(config.templateFilename, [headerRow, ...config.sampleRows])
}
