"use client";
import { createDialogStore } from "@/lib/create-dialog-store";
import { getLoadStatus } from "@/lib/load-status";

import { useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Toast } from "@base-ui/react/toast";
import { apiRequest, ApiError } from "@/lib/api-request";
import { SESSION_QUERY_KEY, useSession } from "@/hooks/use-session";
import {
  itemSchema,
  itemUomSchema,
  itemBrandSchema,
  itemSupplierOptionSchema,
  itemSupplierOfferSchema,
  type ItemSupplierOption,
  type ItemBrand,
  toItemInput,
  type Item,
  type ItemUom,
  type CreateItemInput,
  type UpdateItemInput,
  type ItemFormValues,
} from "@/components/modules/items/item.schema";

function parseItem(data: unknown): Item {
  const result = itemSchema.safeParse(data);
  if (!result.success)
    throw new Error("The item API returned an invalid record.");
  return result.data;
}
export async function getItems(signal?: AbortSignal): Promise<Item[]> {
  const data = await apiRequest("/items", { signal });
  if (!Array.isArray(data))
    throw new Error("The item API returned an invalid item list.");
  return data.map(parseItem);
}
export async function getItemUoms(signal?: AbortSignal): Promise<ItemUom[]> {
  const result = itemUomSchema
    .array()
    .safeParse(await apiRequest("/items/uoms", { signal }));
  if (!result.success)
    throw new Error("The item API returned invalid unit options.");
  return result.data;
}
export async function createItem(input: CreateItemInput): Promise<Item> {
  return parseItem(
    await apiRequest("/items", { method: "POST", body: JSON.stringify(input) }),
  );
}
export async function updateItem(
  itemId: number,
  input: UpdateItemInput,
): Promise<Item> {
  return parseItem(
    await apiRequest(`/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}
export const ITEMS_QUERY_KEY = ["items"] as const;
export async function getItemBrands(
  signal?: AbortSignal,
): Promise<ItemBrand[]> {
  const result = itemBrandSchema
    .array()
    .safeParse(await apiRequest("/brands", { signal }));
  if (!result.success)
    throw new Error("The item API returned invalid brand options.");
  return result.data;
}
const EMPTY_ITEMS: Item[] = [];
const EMPTY_UOMS: ItemUom[] = [];

const useModuleDialogs = createDialogStore<Item, Item[]>();
export function useItems() {
  const session = useSession();
  const client = useQueryClient();
  const { add: showToast } = Toast.useToastManager();
  const queryKey = [...ITEMS_QUERY_KEY, session.data?.userId];
  const itemsQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => getItems(signal),
    enabled: Boolean(session.data),
  });
  const uomsQuery = useQuery({
    queryKey: ["item-uoms", session.data?.userId],
    queryFn: ({ signal }) => getItemUoms(signal),
    enabled: Boolean(session.data),
  });
  const {
    formOpen,
    formRequested,
    editing: editingItem,
    openForm,
    setFormOpen,
    detailId,
    setDetailId,
    target,
    setTarget: setDeactivatingItems,
  } = useModuleDialogs();
  const writePending = useRef(false);
  const brandsQuery = useQuery({
    queryKey: ["item-brands", session.data?.userId],
    queryFn: ({ signal }) => getItemBrands(signal),
    enabled: Boolean(session.data) && formOpen,
  });
  const deactivatingItems = target ?? EMPTY_ITEMS;
  const canManage = session.data?.permissions.canManageInventory === true;
  const loadError = itemsQuery.error ?? uomsQuery.error ?? session.error;

  function cacheItems(saved: Item[]) {
    if (!saved.length) return;
    const updates = new Map(saved.map((item) => [item.itemId, item]));
    client.setQueryData<Item[]>(queryKey, (current = []) => {
      const ids = new Set(current.map((item) => item.itemId));
      return [
        ...current.map((item) => updates.get(item.itemId) ?? item),
        ...saved.filter((item) => !ids.has(item.itemId)),
      ];
    });
  }
  function refresh() {
    for (const key of [
      "items",
      "item-supplier-links",
      "supplier-options",
      "supplier-items",
      "purchase-order-options",
      "dashboard",
      "sales-order-options",
      "brands",
      "inventory-reports",
      "inventory-control-options",
      "inventory-controls",
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
    ])
      void client.invalidateQueries({ queryKey: [key] });
  }
  function mutationError(error: Error) {
    if (error instanceof ApiError && error.status === 403)
      void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    showToast({
      type: "error",
      title: "Unable to update the catalog",
      description: error.message,
    });
  }
  const save = useMutation({
    mutationFn: ({
      values,
      item,
    }: {
      values: ItemFormValues;
      item: Item | null;
    }) => {
      if (!canManage)
        throw new Error("Your role does not allow editing items.");
      const input = toItemInput(values);
      return item ? updateItem(item.itemId, input) : createItem(input);
    },
    onSuccess: (saved, { item }) => {
      cacheItems([saved]);
      refresh();
      showToast({
        type: "success",
        title: item ? "Item updated." : "Item added.",
      });
    },
    onError: mutationError,
  });
  const deactivate = useMutation({
    mutationFn: async (selected: Item[]) => {
      if (!canManage)
        throw new Error("Your role does not allow editing items.");
      const results = await Promise.allSettled(
        selected.map((item) => updateItem(item.itemId, { isActive: false })),
      );
      const failed = selected.filter(
        (_, index) => results[index].status === "rejected",
      );
      const savedItems = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      cacheItems(savedItems);
      setDeactivatingItems(failed);
      if (savedItems.length) refresh();
      if (failed.length < selected.length)
        showToast({
          type: "success",
          title: `${selected.length - failed.length} item(s) deactivated.`,
        });
      if (failed.length) {
        void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
        const failure = results.find((result) => result.status === "rejected");
        throw new Error(
          `${failed.length} item(s) could not be deactivated. ${failure?.reason instanceof Error ? failure.reason.message : "Please retry."}`,
        );
      }
    },
    onError: mutationError,
  });

  const { reset: resetSave } = save;
  const openAdd = useCallback(() => {
    if (!canManage || writePending.current) return;
    resetSave();
    openForm();
  }, [canManage, openForm, resetSave]);
  const openEdit = useCallback(
    (item: Item) => {
      if (!canManage || writePending.current) return;
      resetSave();
      openForm(item);
    },
    [canManage, openForm, resetSave],
  );
  const { reset: resetDeactivate } = deactivate;
  const openDeactivate = useCallback(
    (items: Item[]) => {
      if (!canManage || writePending.current) return;
      resetDeactivate();
      setDeactivatingItems(items.filter((item) => item.isActive));
    },
    [canManage, resetDeactivate, setDeactivatingItems],
  );
  const loadStatus = getLoadStatus(session, [itemsQuery, uomsQuery]);
  return {
    items: itemsQuery.data ?? EMPTY_ITEMS,
    uoms: uomsQuery.data ?? EMPTY_UOMS,
    brands: brandsQuery.data,
    brandsError: brandsQuery.error?.message,
    retryBrands: () => void brandsQuery.refetch(),
    canManage,
    loadStatus,
    loadError,
    formOpen,
    setFormOpen,
    formRequested,
    editingItem,
    supplierItem:
      itemsQuery.data?.find((item) => item.itemId === detailId) ?? null,
    openSuppliers: useCallback(
      (item: Item) => setDetailId(item.itemId),
      [setDetailId],
    ),
    closeSuppliers: () => setDetailId(null),
    deactivatingItems,
    setDeactivatingItems,
    openAdd,
    openEdit,
    openDeactivate,
    isSaving: save.isPending,
    isDeactivating: deactivate.isPending,
    isFetching:
      session.isFetching || itemsQuery.isFetching || uomsQuery.isFetching,
    retry: () => {
      void session.refetch();
      if (session.data) {
        void itemsQuery.refetch();
        void uomsQuery.refetch();
      }
    },
    handleSave: async (values: ItemFormValues, item: Item | null) => {
      if (writePending.current) return false;
      writePending.current = true;
      try {
        await save.mutateAsync({ values, item });
        return true;
      } catch {
        return false;
      } finally {
        writePending.current = false;
      }
    },
    handleDeactivate: async () => {
      if (writePending.current || !deactivatingItems.length) return;
      writePending.current = true;
      try {
        await deactivate.mutateAsync(deactivatingItems);
      } catch {
        /* Failed rows remain selected. */
      } finally {
        writePending.current = false;
      }
    },
  };
}

export async function getItemSupplierOptions(
  signal?: AbortSignal,
): Promise<ItemSupplierOption[]> {
  const result = itemSupplierOptionSchema
    .array()
    .safeParse(await apiRequest("/suppliers", { signal }));
  if (!result.success)
    throw new Error("The supplier API returned invalid supplier choices.");
  return result.data;
}
export async function getItemWithSuppliers(
  itemId: number,
  signal?: AbortSignal,
): Promise<Item> {
  return parseItem(await apiRequest(`/items/${itemId}`, { signal }));
}
export async function setItemSupplierLink(
  itemId: number,
  supplierId: number,
  supplierItemId: number | null,
  isActive: boolean,
): Promise<void> {
  const path = `/suppliers/${supplierId}/items${supplierItemId === null ? "" : `/${supplierItemId}`}`;
  const data = await apiRequest(path, {
    method: supplierItemId === null ? "POST" : "PATCH",
    body: JSON.stringify(
      supplierItemId === null ? { itemId, isActive } : { isActive },
    ),
  });
  const result = itemSupplierOfferSchema.safeParse(data);
  if (
    !result.success ||
    result.data.itemId !== itemId ||
    result.data.supplierId !== supplierId ||
    result.data.isActive !== isActive
  )
    throw new Error("The supplier API returned an invalid material link.");
}
export function useItemSupplierLinks(itemId: number) {
  const session = useSession();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["item-supplier-links", itemId, session.data?.userId],
    queryFn: ({ signal }) => getItemWithSuppliers(itemId, signal),
    enabled: Boolean(session.data),
  });
  const suppliersQuery = useQuery({
    queryKey: ["item-supplier-options", session.data?.userId],
    queryFn: ({ signal }) => getItemSupplierOptions(signal),
    enabled: Boolean(session.data),
  });
  const canManage = session.data?.permissions.canManagePurchasing === true;
  const writePending = useRef(false);
  const mutation = useMutation({
    mutationFn: async ({
      supplierId,
      supplierItemId,
      isActive,
    }: {
      supplierId: number;
      supplierItemId: number | null;
      isActive: boolean;
    }) => {
      if (!canManage)
        throw new Error("Your role does not allow changing supplier links.");
      await setItemSupplierLink(itemId, supplierId, supplierItemId, isActive);
    },
    onSuccess: async () => {
      await Promise.all(
        [
          "items",
          "item-supplier-links",
          "suppliers",
          "supplier-items",
          "purchase-order-options",
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
    },
  });
  return {
    item: query.data,
    suppliers: suppliersQuery.data,
    isLoading: query.isPending || suppliersQuery.isPending,
    error: query.error ?? suppliersQuery.error ?? session.error,
    canManage,
    isSaving: mutation.isPending,
    saveError: mutation.error?.message,
    retry: () => {
      void query.refetch();
      void suppliersQuery.refetch();
    },
    setLink: async (
      supplierId: number,
      supplierItemId: number | null,
      isActive: boolean,
    ) => {
      if (writePending.current) return;
      writePending.current = true;
      try {
        await mutation.mutateAsync({ supplierId, supplierItemId, isActive });
      } catch {
        /* Keep the dialog and error available for retry. */
      } finally {
        writePending.current = false;
      }
    },
  };
}
