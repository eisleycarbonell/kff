import type { QueryClient } from "@tanstack/react-query"

/** Availability and eligibility feed several operational forms, not only the stock list. */
export function invalidateInventoryAvailability(client: QueryClient) {
    return Promise.all(
        [
            "inventory-stock-options",
            "inventory-control-options",
            "packing-options",
            "packing-preview",
            "transfer-options",
            "delivery-order-options",
            "sales-order-options",
            "sales-order-material-plan",
        ].map((prefix) => client.invalidateQueries({ queryKey: [prefix] })),
    )
}
