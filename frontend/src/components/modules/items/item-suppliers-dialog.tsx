"use client";

import Link from "next/link";
import type { Item } from "@/components/modules/items/item.schema";
import { useItemSupplierLinks } from "@/hooks/modules/items/use-items";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ItemSuppliersDialog({
  item,
  onClose,
}: {
  item: Item;
  onClose: () => void;
}) {
  const links = useItemSupplierLinks(item.itemId);
  const material = links.item ?? item;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !links.isSaving) onClose();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
        showCloseButton={!links.isSaving}
      >
        <DialogHeader>
          <DialogTitle>Suppliers for {material.name}</DialogTitle>
          <DialogDescription>
            Link the suppliers that provide this material. These same links
            control purchase-order material choices. Enter prices and purchase
            units on the purchase order.
          </DialogDescription>
        </DialogHeader>
        {links.isLoading && <p role="status">Loading supplier links...</p>}
        {links.error && (
          <Alert variant="destructive">
            <AlertTitle>Unable to load supplier links</AlertTitle>
            <AlertDescription>
              {links.error.message}
              <Button variant="outline" onClick={links.retry}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {links.saveError && (
          <Alert variant="destructive">
            <AlertTitle>Unable to update link</AlertTitle>
            <AlertDescription>{links.saveError}</AlertDescription>
          </Alert>
        )}
        {!links.canManage && (
          <p className="text-sm text-muted-foreground">
            Purchasing permission is required to change supplier links.
          </p>
        )}
        {!links.isLoading && links.item && links.suppliers && (
          <div className="flex flex-col gap-2">
            {links.suppliers?.length === 0 && (
              <p>
                No suppliers yet. Add a supplier in{" "}
                <Link className="underline" href="/suppliers">
                  Suppliers
                </Link>
                .
              </p>
            )}
            {links.suppliers?.map((supplier) => {
              const link = material.supplierLinks?.find(
                (candidate) => candidate.supplierId === supplier.supplierId,
              );
              const active = Boolean(link?.isActive && supplier.isActive);
              return (
                <div
                  key={supplier.supplierId}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">{supplier.name}</p>
                    <Badge variant={active ? "secondary" : "outline"}>
                      {active
                        ? "Linked"
                        : supplier.isActive
                          ? "Not linked"
                          : "Supplier inactive"}
                    </Badge>
                  </div>
                  {links.canManage && (
                    <Button
                      variant="outline"
                      disabled={
                        links.isSaving ||
                        (!active && (!supplier.isActive || !material.isActive))
                      }
                      onClick={() =>
                        void links.setLink(
                          supplier.supplierId,
                          link?.supplierItemId ?? null,
                          !active,
                        )
                      }
                    >
                      {links.isSaving
                        ? "Saving..."
                        : active
                          ? "Unlink"
                          : "Link supplier"}
                    </Button>
                  )}
                </div>
              );
            })}
            {!material.isActive && (
              <p className="text-sm text-muted-foreground">
                Reactivate this material before linking another supplier.
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={links.isSaving} onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
