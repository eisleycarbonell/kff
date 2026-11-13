"use client";

import { useState } from "react";
import type { Supplier } from "@/components/modules/suppliers/supplier.schema";
import { useSupplierItems } from "@/hooks/modules/suppliers/use-suppliers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier;
};

export function SupplierItemsDialog({ open, onOpenChange, supplier }: Props) {
  const links = useSupplierItems(open ? supplier.supplierId : null);
  const [search, setSearch] = useState("");
  const [showAvailable, setShowAvailable] = useState(false);
  const searchTerm = search.trim().toLowerCase();
  const byItem = new Map(links.items.map((link) => [link.itemId, link]));
  const materials = links.options.items.filter((item) =>
    showAvailable
      ? !byItem.get(item.itemId)?.isActive &&
        item.isActive &&
        item.itemType !== "Finished Good"
      : Boolean(byItem.get(item.itemId)?.isActive),
  );
  const filtered = materials
    .filter((item) =>
      `${item.sku} ${item.name}`.toLowerCase().includes(searchTerm),
    )
    .sort(
      (a, b) =>
        Number(Boolean(byItem.get(b.itemId)?.isActive)) -
          Number(Boolean(byItem.get(a.itemId)?.isActive)) ||
        a.name.localeCompare(b.name),
    );
  const linkedCount = links.items.filter((link) => link.isActive).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!links.isSaving) {
          links.resetError();
          setSearch("");
          setShowAvailable(false);
          onOpenChange(value);
        }
      }}
    >
      {open && (
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
          showCloseButton={!links.isSaving}
        >
          <DialogHeader>
            <DialogTitle className="break-words">
              Linked items: {supplier.name}
            </DialogTitle>
            <DialogDescription>
              Link the materials this supplier provides. The same links appear
              in Items and control its purchase-order choices. Enter prices and
              purchase units on the PO.
            </DialogDescription>
          </DialogHeader>
          {!supplier.isActive && (
            <p className="text-sm text-muted-foreground">
              Reactivate this supplier before linking items.
            </p>
          )}
          {!links.canManage && (
            <p className="text-sm text-muted-foreground">
              Purchasing permission is required to change links.
            </p>
          )}
          {links.loadStatus === "loading" && (
            <p role="status">Loading item links...</p>
          )}
          {links.loadError && (
            <Alert variant="destructive">
              <AlertTitle>Unable to load item links</AlertTitle>
              <AlertDescription>
                {links.loadError instanceof Error
                  ? links.loadError.message
                  : "Please retry."}
                <Button
                  variant="outline"
                  disabled={links.isFetching}
                  onClick={links.retry}
                >
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
          {links.loadStatus === "ready" && (
            <>
              <p className="text-sm" role="status">
                {linkedCount} linked {linkedCount === 1 ? "item" : "items"}
              </p>
              {(showAvailable || (links.canManage && supplier.isActive)) && (
                <Button
                  variant="outline"
                  disabled={links.isSaving}
                  onClick={() => {
                    setShowAvailable(!showAvailable);
                    setSearch("");
                    links.resetError();
                  }}
                >
                  {showAvailable ? "Back to linked items" : "Link another item"}
                </Button>
              )}
              {showAvailable && (
                <p className="text-sm font-medium">Available items to link</p>
              )}
              <Input
                aria-label={
                  showAvailable
                    ? "Search available items"
                    : "Search linked items"
                }
                placeholder={
                  showAvailable
                    ? "Search available items..."
                    : "Search linked items..."
                }
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="flex flex-col gap-2">
                {filtered.map((item) => {
                  const link = byItem.get(item.itemId);
                  const linked = Boolean(link?.isActive);
                  return (
                    <div
                      key={item.itemId}
                      className="flex items-center justify-between gap-3 rounded-md border p-3"
                    >
                      <div className="min-w-0">
                        <p className="break-words font-medium">{item.name}</p>
                        <p className="break-words text-sm text-muted-foreground">
                          {item.sku} / {item.primaryUomName}
                        </p>
                        <Badge variant={linked ? "secondary" : "outline"}>
                          {linked ? "Linked" : "Not linked"}
                        </Badge>
                        {!item.isActive && (
                          <p className="text-sm text-muted-foreground">
                            Item inactive; unavailable on new POs.
                          </p>
                        )}
                      </div>
                      {links.canManage && (
                        <Button
                          variant="outline"
                          className="shrink-0"
                          disabled={
                            links.isSaving ||
                            (!linked && (!supplier.isActive || !item.isActive))
                          }
                          aria-label={`${linked ? "Unlink" : "Link"} ${item.name}`}
                          onClick={() =>
                            void links.setLink(
                              item.itemId,
                              link?.supplierItemId ?? null,
                              !linked,
                            )
                          }
                        >
                          {links.isSaving
                            ? "Saving..."
                            : linked
                              ? "Unlink"
                              : "Link item"}
                        </Button>
                      )}
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="py-4 text-sm text-muted-foreground">
                    {searchTerm
                      ? "No items match your search."
                      : showAvailable
                        ? "No more materials available to link."
                        : "No items linked to this supplier."}
                  </p>
                )}
              </div>
            </>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={links.isSaving}
              onClick={() => {
                links.resetError();
                setSearch("");
                setShowAvailable(false);
                onOpenChange(false);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
