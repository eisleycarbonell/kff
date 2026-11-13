"use client";

import { useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Toast } from "@base-ui/react/toast";
import { apiRequest, ApiError } from "@/lib/api-request";
import { createDialogStore } from "@/lib/create-dialog-store";
import { getLoadStatus } from "@/lib/load-status";
import { SESSION_QUERY_KEY, useSession } from "@/hooks/use-session";
import {
  supplierSchema,
  supplierItemSchema,
  supplierOptionsSchema,
  toSupplierInput,
  type Supplier,
  type SupplierItem,
  type SupplierOptions,
  type CreateSupplierInput,
  type UpdateSupplierInput,
  type CreateSupplierItemInput,
  type UpdateSupplierItemInput,
  type SupplierFormValues,
} from "@/components/modules/suppliers/supplier.schema";

function parseSupplier(data: unknown): Supplier {
  const result = supplierSchema.safeParse(data);
  if (!result.success)
    throw new Error("The supplier API returned an invalid supplier record.");
  return result.data;
}
function parseSupplierItem(data: unknown): SupplierItem {
  const result = supplierItemSchema.safeParse(data);
  if (!result.success)
    throw new Error(
      "The supplier API returned an invalid supplier item record.",
    );
  return result.data;
}
export async function getSuppliers(signal?: AbortSignal): Promise<Supplier[]> {
  const data = await apiRequest("/suppliers", { signal });
  if (!Array.isArray(data))
    throw new Error("The supplier API returned an invalid supplier list.");
  return data.map(parseSupplier);
}
export async function getSupplier(
  supplierId: number,
  signal?: AbortSignal,
): Promise<Supplier> {
  return parseSupplier(
    await apiRequest(`/suppliers/${supplierId}`, { signal }),
  );
}
export async function getSupplierOptions(
  signal?: AbortSignal,
): Promise<SupplierOptions> {
  const result = supplierOptionsSchema.safeParse(
    await apiRequest("/suppliers/options", { signal }),
  );
  if (!result.success)
    throw new Error("The supplier API returned invalid item and unit options.");
  return result.data;
}
export async function createSupplier(
  input: CreateSupplierInput,
): Promise<Supplier> {
  return parseSupplier(
    await apiRequest("/suppliers", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}
export async function updateSupplier(
  supplierId: number,
  input: UpdateSupplierInput,
): Promise<Supplier> {
  return parseSupplier(
    await apiRequest(`/suppliers/${supplierId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}
export async function getSupplierItems(
  supplierId: number,
  signal?: AbortSignal,
): Promise<SupplierItem[]> {
  const data = await apiRequest(`/suppliers/${supplierId}/items`, { signal });
  if (!Array.isArray(data))
    throw new Error("The supplier API returned an invalid supplier item list.");
  return data.map(parseSupplierItem);
}
export async function createSupplierItem(
  supplierId: number,
  input: CreateSupplierItemInput,
): Promise<SupplierItem> {
  return parseSupplierItem(
    await apiRequest(`/suppliers/${supplierId}/items`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}
export async function updateSupplierItem(
  supplierId: number,
  supplierItemId: number,
  input: UpdateSupplierItemInput,
): Promise<SupplierItem> {
  return parseSupplierItem(
    await apiRequest(`/suppliers/${supplierId}/items/${supplierItemId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}

export const SUPPLIERS_QUERY_KEY = ["suppliers"] as const;
export const SUPPLIER_ITEMS_QUERY_KEY = ["supplier-items"] as const;
const EMPTY_SUPPLIERS: Supplier[] = [];
const EMPTY_ITEMS: SupplierItem[] = [];
const EMPTY_OPTIONS: SupplierOptions = { items: [], uoms: [] };

const useDialogs = createDialogStore<
  Supplier,
  Supplier,
  { itemsOpen: boolean }
>({ itemsOpen: false });

export function useSuppliers() {
  const session = useSession();
  const client = useQueryClient();
  const { add: showToast } = Toast.useToastManager();
  const canManage = session.data?.permissions.canManagePurchasing === true;
  const queryKey = [...SUPPLIERS_QUERY_KEY, session.data?.userId];
  const suppliersQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => getSuppliers(signal),
    enabled: Boolean(session.data),
    staleTime: 0,
  });
  const {
    formOpen,
    setFormOpen,
    formRequested,
    editing: editingSupplier,
    target: deactivatingSupplier,
    setTarget: setDeactivatingSupplier,
    openForm,
    detailId,
    itemsOpen,
    patch,
  } = useDialogs();
  const loadError = suppliersQuery.error ?? session.error;

  function cacheSupplier(saved: Supplier) {
    client.setQueryData<Supplier[]>(queryKey, (current = []) =>
      current.some((supplier) => supplier.supplierId === saved.supplierId)
        ? current.map((supplier) =>
            supplier.supplierId === saved.supplierId ? saved : supplier,
          )
        : [...current, saved],
    );
    if (!saved.isActive)
      client.setQueriesData<SupplierItem[]>(
        { queryKey: [...SUPPLIER_ITEMS_QUERY_KEY, saved.supplierId] },
        (current) =>
          current?.map((item) => ({
            ...item,
            isActive: false,
            isPreferred: false,
          })),
      );
    void client.invalidateQueries({ queryKey: ["item-supplier-links"] });
    void client.invalidateQueries({ queryKey: ["item-supplier-options"] });
    void client.invalidateQueries({ queryKey: ["items"] });
    void client.invalidateQueries({ queryKey: ["purchase-order-options"] });
    void client.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY });
    void client.invalidateQueries({
      queryKey: [...SUPPLIER_ITEMS_QUERY_KEY, saved.supplierId],
    });
  }
  function mutationError(error: Error) {
    if (error instanceof ApiError && error.status === 403)
      void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    showToast({
      type: "error",
      title: "Unable to update suppliers",
      description: error.message,
    });
  }
  const save = useMutation({
    mutationFn: ({
      values,
      supplier,
    }: {
      values: SupplierFormValues;
      supplier: Supplier | null;
    }) => {
      if (!canManage)
        throw new Error("Your role does not allow editing suppliers.");
      const input = toSupplierInput(values);
      return supplier
        ? updateSupplier(supplier.supplierId, input)
        : createSupplier(input);
    },
    onSuccess: (saved, { supplier }) => {
      cacheSupplier(saved);
      showToast({
        type: "success",
        title: supplier ? "Supplier updated." : "Supplier added.",
      });
    },
    onError: mutationError,
  });
  const deactivate = useMutation({
    mutationFn: (supplier: Supplier) => {
      if (!canManage)
        throw new Error("Your role does not allow editing suppliers.");
      return updateSupplier(supplier.supplierId, { isActive: false });
    },
    onSuccess: (saved) => {
      cacheSupplier(saved);
      setDeactivatingSupplier(null);
      showToast({ type: "success", title: "Supplier deactivated." });
    },
    onError: mutationError,
  });
  const activate = useMutation({
    mutationFn: (supplier: Supplier) => {
      if (!canManage)
        throw new Error("Your role does not allow editing suppliers.");
      return updateSupplier(supplier.supplierId, { isActive: true });
    },
    onSuccess: (saved) => {
      cacheSupplier(saved);
      showToast({ type: "success", title: "Supplier reactivated." });
    },
    onError: mutationError,
  });
  const { reset: resetSave } = save;
  const { reset: resetDeactivate } = deactivate;
  const { mutateAsync: activateSupplier, isPending: isActivating } = activate;
  const handleActivate = useCallback(
    async (supplier: Supplier) => {
      if (isActivating) return false;
      try {
        await activateSupplier(supplier);
        return true;
      } catch {
        return false;
      }
    },
    [activateSupplier, isActivating],
  );
  const openAdd = useCallback(() => {
    resetSave();
    openForm();
  }, [resetSave, openForm]);
  const openEdit = useCallback(
    (supplier: Supplier) => {
      resetSave();
      openForm(supplier);
    },
    [resetSave, openForm],
  );
  const openDeactivate = useCallback(
    (supplier: Supplier) => {
      resetDeactivate();
      setDeactivatingSupplier(supplier);
    },
    [resetDeactivate, setDeactivatingSupplier],
  );
  const currentSupplier =
    suppliersQuery.data?.find((supplier) => supplier.supplierId === detailId) ??
    null;
  const openItems = useCallback(
    (supplier: Supplier) => {
      patch({ detailId: supplier.supplierId, itemsOpen: true });
    },
    [patch],
  );
  const setItemsOpen = useCallback(
    (open: boolean) => patch({ itemsOpen: open }),
    [patch],
  );
  const loadStatus = getLoadStatus(session, [suppliersQuery]);
  return {
    suppliers: suppliersQuery.data ?? EMPTY_SUPPLIERS,
    currentSupplier,
    itemsOpen,
    openItems,
    setItemsOpen,
    canManage,
    loadStatus,
    loadError,
    formOpen,
    setFormOpen,
    formRequested,
    editingSupplier,
    deactivatingSupplier,
    setDeactivatingSupplier,
    openAdd,
    openEdit,
    openDeactivate,
    isSaving: save.isPending,
    isDeactivating: deactivate.isPending,
    isActivating,
    saveError: save.error?.message ?? null,
    deactivateError: deactivate.error?.message ?? null,
    isFetching: session.isFetching || suppliersQuery.isFetching,
    retry: () => {
      void session.refetch();
      if (session.data) void suppliersQuery.refetch();
    },
    handleSave: async (
      values: SupplierFormValues,
      supplier: Supplier | null,
    ) => {
      if (save.isPending) return false;
      try {
        await save.mutateAsync({ values, supplier });
        return true;
      } catch {
        return false;
      }
    },
    handleDeactivate: () => {
      if (!deactivate.isPending && deactivatingSupplier)
        deactivate.mutate(deactivatingSupplier);
    },
    handleActivate,
  };
}

// Links use the same supplier_items records as the Items module.
export async function setSupplierItemLink(
  supplierId: number,
  itemId: number,
  supplierItemId: number | null,
  isActive: boolean,
): Promise<SupplierItem> {
  const saved =
    supplierItemId === null
      ? await createSupplierItem(supplierId, { itemId, isActive })
      : await updateSupplierItem(supplierId, supplierItemId, { isActive });
  if (
    saved.supplierId !== supplierId ||
    saved.itemId !== itemId ||
    saved.isActive !== isActive
  )
    throw new Error("The supplier API returned an invalid material link.");
  return saved;
}

export function useSupplierItems(supplierId: number | null) {
  const session = useSession();
  const client = useQueryClient();
  const { add: showToast } = Toast.useToastManager();
  const canManage = session.data?.permissions.canManagePurchasing === true;
  const queryKey = [
    ...SUPPLIER_ITEMS_QUERY_KEY,
    supplierId,
    session.data?.userId,
  ];
  const enabled = Boolean(session.data) && supplierId !== null;
  const itemsQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => getSupplierItems(supplierId!, signal),
    enabled,
    staleTime: 0,
  });
  const optionsQuery = useQuery({
    queryKey: ["supplier-options", session.data?.userId],
    queryFn: ({ signal }) => getSupplierOptions(signal),
    enabled,
    staleTime: 0,
  });
  const writePending = useRef(false);
  const mutation = useMutation({
    mutationFn: ({
      itemId,
      supplierItemId,
      isActive,
    }: {
      itemId: number;
      supplierItemId: number | null;
      isActive: boolean;
    }) => {
      if (!canManage || supplierId === null)
        throw new Error("Your role does not allow changing supplier links.");
      return setSupplierItemLink(supplierId, itemId, supplierItemId, isActive);
    },
    onSuccess: async (saved) => {
      client.setQueryData<SupplierItem[]>(queryKey, (current = []) =>
        current.some((item) => item.supplierItemId === saved.supplierItemId)
          ? current.map((item) =>
              item.supplierItemId === saved.supplierItemId ? saved : item,
            )
          : [...current, saved],
      );
      // Keep the list, counts, Items tags and PO choices in sync before enabling another action.
      await Promise.all(
        [
          "suppliers",
          "supplier-items",
          "items",
          "item-supplier-links",
          "item-supplier-options",
          "purchase-order-options",
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
      showToast({
        type: "success",
        title: saved.isActive ? "Item linked." : "Item unlinked.",
      });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.status === 403)
        void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });
  return {
    items: itemsQuery.data ?? EMPTY_ITEMS,
    options: optionsQuery.data ?? EMPTY_OPTIONS,
    canManage,
    loadStatus:
      supplierId === null
        ? "ready"
        : getLoadStatus(session, [itemsQuery, optionsQuery]),
    loadError: itemsQuery.error ?? optionsQuery.error ?? session.error,
    isFetching:
      itemsQuery.isFetching || optionsQuery.isFetching || session.isFetching,
    isSaving: mutation.isPending,
    saveError: mutation.error?.message ?? null,
    resetError: mutation.reset,
    retry: () => {
      void session.refetch();
      if (enabled) {
        void itemsQuery.refetch();
        void optionsQuery.refetch();
      }
    },
    setLink: async (
      itemId: number,
      supplierItemId: number | null,
      isActive: boolean,
    ) => {
      if (writePending.current || supplierId === null) return;
      writePending.current = true;
      try {
        await mutation.mutateAsync({ itemId, supplierItemId, isActive });
      } catch {
        // Keep the dialog and readable error available for retry.
      } finally {
        writePending.current = false;
      }
    },
  };
}
