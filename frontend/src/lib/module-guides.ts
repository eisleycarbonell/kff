export type ModuleGuide = {
    title: string
    purpose: string
    steps: readonly string[]
    workflow: readonly { label: string; href: string }[]
    note?: string
}

export const moduleGuides = {
    "/dashboard": {
        title: "Dashboard",
        purpose:
            "Review stock, warnings and unfinished work before deciding what to buy, pack or move today.",
        steps: [
            "Review inventory totals in their own units, such as kilograms and pieces.",
            "Check low-stock and expiry warnings, then inspect the affected item, lot and location.",
            "Review open purchase orders, active packing orders and goods still In Transit.",
            "Open the relevant module to continue the work, then refresh the dashboard after saving changes.",
        ],
        workflow: [
            { label: "Sales Orders", href: "/sales-orders" },
            { label: "Inventory Stock", href: "/inventory" },
            { label: "Purchase Orders", href: "/purchase-orders" },
            { label: "Packing Orders", href: "/packing-orders" },
        ],
        note: "Dashboard figures come from saved operations. Receiving and completed packing create stock.",
    },
    "/inventory": {
        title: "Inventory Stock",
        purpose:
            "See how much of each item and lot is at each company location, how much is reserved and how much remains available.",
        steps: [
            "Filter by item and location before choosing stock for packing, transfer or delivery.",
            "Compare On hand, Reserved and Available in the item's stock unit.",
            "Inspect the lot's status, expiry and origin before using its available quantity.",
            "Follow the lot or stock movements to explain a balance; use Stock Adjustments only for a verified count difference.",
        ],
        workflow: [
            { label: "Lots / Batches", href: "/inventory/lots" },
            { label: "Stock Movements", href: "/inventory/transactions" },
            { label: "Packing Orders", href: "/packing-orders" },
            { label: "Stock Adjustments", href: "/inventory/adjustments" },
        ],
        note: "Available equals on hand minus outstanding reservations. Stock still needs an Approved, unexpired lot and a suitable active location before it can be used.",
    },
    "/inventory/lots": {
        title: "Lots / Batches",
        purpose:
            "Trace each received or packed batch to its origin, dates, status and stock across locations.",
        steps: [
            "Find the item or lot number and open its details.",
            "Check the supplier purchase-order line for a purchased lot, or the packing order for a finished lot.",
            "Review dates, approval status and each location's on-hand, reserved and available quantities.",
            "Inspect movements to follow the batch; use Edit metadata for an authorized correction to its recorded details.",
        ],
        workflow: [
            { label: "Receiving", href: "/receiving" },
            { label: "Packing Orders", href: "/packing-orders" },
            { label: "Inventory Stock", href: "/inventory" },
            { label: "Lot Genealogy", href: "/reports/genealogy" },
        ],
        note: "New received and packed lots start Approved. Editing a lot's details does not add stock or move it between locations.",
    },
    "/inventory/transactions": {
        title: "Stock Movements",
        purpose:
            "Explain every stock increase, decrease and move using its saved operation, lot, location and reference.",
        steps: [
            "Search a document reference, item or lot, and apply the relevant movement filters.",
            "Read Receive for purchases, Consume and Produce for packing, and paired Transfer movements for location changes.",
            "Look for Sale when a customer delivery is completed, or Adjustment and Scrap for stock corrections and disposal.",
            "Follow the source record to investigate a movement and export the matching rows when needed.",
        ],
        workflow: [
            { label: "Inventory Stock", href: "/inventory" },
            { label: "Lots / Batches", href: "/inventory/lots" },
            { label: "Inventory Reports", href: "/reports/inventory" },
        ],
        note: "Stock history is permanent. Correct a mistake through a new authorized operation so the full history remains visible.",
    },
    "/inventory/adjustments": {
        title: "Stock Adjustments",
        purpose:
            "Correct a verified difference between a physical count and the recorded quantity for one item, lot and location.",
        steps: [
            "Physically count the selected stock, including the quantity already reserved.",
            "Choose Record adjustment, select the item and lot, location and an active adjustment reason.",
            "Review the expected on-hand and reserved balances, then enter the final Counted quantity and a reference if available.",
            "Save and verify that the signed difference appears in Stock Movements and the new balance appears in Inventory Stock.",
        ],
        workflow: [
            { label: "Reason Codes", href: "/reason-codes" },
            { label: "Inventory Stock", href: "/inventory" },
            { label: "Stock Movements", href: "/inventory/transactions" },
        ],
        note: "Inventory access is required. A stale expected balance or a count below outstanding reservations is rejected. Use Scrap & Disposal for permanent removal.",
    },
    "/inventory/scrap": {
        title: "Scrap & Disposal",
        purpose:
            "Record permanent removal of expired, damaged or unusable goods with an independent review.",
        steps: [
            "Prepare a request for the actual lot, source location, disposal quantity and active reason.",
            "Record the supporting notes or evidence and review the displayed stock balance.",
            "Submit the request for a different authorized person to review.",
            "After approval, verify the stock decrease and negative Scrap movement against the request.",
        ],
        workflow: [
            { label: "Reason Codes", href: "/reason-codes" },
            { label: "Lots / Batches", href: "/inventory/lots" },
            { label: "Stock Movements", href: "/inventory/transactions" },
        ],
        note: "The preparer cannot approve their own request. Disposal cannot take stock committed to another order; changed balances may require a fresh review.",
    },
    "/purchase-orders": {
        title: "Purchase Orders",
        purpose:
            "Order raw ingredients, packaging and printed labels from a supplier to replenish the materials the business needs.",
        steps: [
            "Create an order and keep the generated PO number or replace it with a unique custom reference before saving.",
            "Select an active supplier, then add its linked materials with quantities, compatible purchase units and agreed prices.",
            "Review and save the Draft, then mark it Sent when ready for the supplier.",
            "After physical arrival, use Receiving to post the actual quantities against its outstanding lines.",
            "Track partial receipts and the remaining quantities until the order is Completed.",
        ],
        workflow: [
            { label: "Sales Orders", href: "/sales-orders" },
            { label: "Suppliers", href: "/suppliers" },
            { label: "Receiving", href: "/receiving" },
            { label: "Inventory Stock", href: "/inventory" },
        ],
        note: "Purchasing access is required. Saved PO numbers stay fixed. Creating or marking an order Sent adds no stock and does not email the supplier.",
    },
    "/receiving": {
        title: "Receiving",
        purpose:
            "Turn goods that physically arrived from a supplier into traceable warehouse stock against an outstanding purchase order.",
        steps: [
            "Select a Sent or Partially Received PO and an outstanding material line.",
            "Choose the receiving warehouse and enter the quantity that arrived in the appropriate purchase unit.",
            "Enter a unique lot reference, supplier lot details and available dates; optional dates may stay empty where appropriate.",
            "Save the receipt, then verify the purchased lot, Receive movement, warehouse balance and updated PO progress.",
        ],
        workflow: [
            { label: "Purchase Orders", href: "/purchase-orders" },
            { label: "Lots / Batches", href: "/inventory/lots" },
            { label: "Inventory Stock", href: "/inventory" },
            { label: "Packing Orders", href: "/packing-orders" },
        ],
        note: "Inventory access is required. Saving a receipt adds stock in the item's primary unit; a partial arrival leaves the remaining PO quantity outstanding.",
    },
    "/packing-orders": {
        title: "Packing Orders",
        purpose:
            "Use a released formula to reserve materials and pack finished products into a traceable new finished lot.",
        steps: [
            "Create a Draft with the finished product, target output, material source and finished-goods destination.",
            "Review material requirements, shortages and maximum producible quantity; replenish missing materials through purchasing and receiving.",
            "Choose Plan and reserve to commit eligible material lots, then Start packing when work begins.",
            "After packing, enter actual output, a unique finished lot and the available dates, then Complete packing.",
            "Verify material consumption, released unused reservations and the new finished stock before transfer or delivery.",
        ],
        workflow: [
            { label: "Packing Formulas", href: "/bom" },
            { label: "Receiving", href: "/receiving" },
            { label: "Material Reservations", href: "/packing-orders/reservations" },
            { label: "Delivery Orders", href: "/delivery-orders" },
        ],
        note: "Packing access is required. Planning reserves stock and starting keeps it reserved; completion consumes materials and creates finished stock together. Each order keeps its saved formula requirements.",
    },
    "/packing-orders/reservations": {
        title: "Material Reservations",
        purpose:
            "See which packing orders have committed which material lots, and how much remains reserved or has been consumed.",
        steps: [
            "Find the packing order or material and inspect its reserved lot and source location.",
            "Compare reserved, consumed and outstanding quantities in the material's stock unit.",
            "Open Inventory Stock to see how the outstanding reservation reduces availability while the materials remain on hand.",
            "Continue, complete or cancel the owning Packing Order to consume or release its reservations.",
        ],
        workflow: [
            { label: "Packing Orders", href: "/packing-orders" },
            { label: "Inventory Stock", href: "/inventory" },
            { label: "Stock Movements", href: "/inventory/transactions" },
        ],
        note: "Reserving creates no stock movement. Completion consumes the required portion and releases the unused portion; customer shipment reservations are managed in Delivery Orders.",
    },
    "/transfers": {
        title: "Stock Transfers",
        purpose:
            "Move company-owned finished stock between a warehouse and another warehouse, branch or store through In Transit.",
        steps: [
            "Create a Draft with distinct source and destination locations, finished-product lots and requested quantities.",
            "Dispatch the actual shipment into an active In Transit location after it leaves the source.",
            "Use the In Transit view to follow quantities still travelling to their destination.",
            "After arrival, confirm the quantity received now; repeat for later arrivals until the transfer is Completed.",
            "Verify source, transit and destination balances and the matching Transfer movements.",
        ],
        workflow: [
            { label: "Inventory Stock", href: "/inventory" },
            { label: "Transfer Report", href: "/reports/transfers" },
            { label: "Delivery Orders", href: "/delivery-orders" },
        ],
        note: "Transfers access is required. Goods remain company-owned during transit. Enter each receipt as an additional arrival quantity; partial receipt leaves the balance In Transit.",
    },
    "/sales-orders": {
        title: "Sales Orders",
        purpose:
            "Record the customer's PO and requested products, check finished supply and material shortages, and follow fulfillment.",
        steps: [
            "Create a Draft for an active customer, enter the Customer PO number and dates, then select finished products, quantities and prices.",
            "Save and open Material plan. Select the material source and review existing finished stock, quantity to pack and combined material shortages.",
            "Purchase missing materials from the suggested linked suppliers, receive them, refresh the plan and create the required Packing Orders.",
            "Confirm the accepted order, then allocate its outstanding demand through Delivery Orders.",
            "Review delivered and remaining quantities as completed customer deliveries fulfill the order.",
        ],
        workflow: [
            { label: "Customers", href: "/customers" },
            { label: "Purchase Orders", href: "/purchase-orders" },
            { label: "Receiving", href: "/receiving" },
            { label: "Packing Orders", href: "/packing-orders" },
            { label: "Delivery Orders", href: "/delivery-orders" },
        ],
        note: "Inventory access is required for changes. Material plan and sales confirmation reserve no physical stock; packing planning and delivery dispatch check availability again.",
    },
    "/delivery-orders": {
        title: "Delivery Orders",
        purpose:
            "Allocate customer demand, ship selected finished lots and record customer receipt so sales fulfillment stays accurate.",
        steps: [
            "Create a Draft against a Confirmed or Partially Delivered sales order and choose its shipping source.",
            "Select the sales products, matching finished lots and quantities. Saving the Draft allocates sales demand without moving stock.",
            "Dispatch the shipment to In Transit after departure; its stock is protected there for this delivery.",
            "After the customer receives the whole shipment, choose Confirm customer receipt.",
            "Verify the Sale movement, closed shipment reservations and updated delivered quantities on the Sales Order.",
        ],
        workflow: [
            { label: "Sales Orders", href: "/sales-orders" },
            { label: "Inventory Stock", href: "/inventory" },
            { label: "Stock Movements", href: "/inventory/transactions" },
        ],
        note: "Transfers access is required. Goods leave company inventory on completed customer receipt. Use separate deliveries for partial fulfillment; dispatched deliveries cannot be cancelled.",
    },
    "/items": {
        title: "Items / Products",
        purpose:
            "Define each bulk ingredient, packaging material, printed label and finished product once, with its primary stock unit.",
        steps: [
            "Create the item with its SKU, name, type, primary unit, reference cost and active status.",
            "Create printed labels as Packaging - Label items, then select the matching material in a Finished Good's Labels field.",
            "Save purchased materials and link their suppliers before selecting them on supplier POs.",
            "Prepare and release a finished product's formula with the correct ingredients, hardware, label and seal before packing.",
        ],
        workflow: [
            { label: "Units of Measure", href: "/uom" },
            { label: "Suppliers", href: "/suppliers" },
            { label: "Formula Revisions", href: "/formula-revisions" },
            { label: "Inventory Stock", href: "/inventory" },
        ],
        note: "Inventory access is required for catalog changes. Creating an item adds no stock. Selecting a label does not change its consumption formula; used item types and units are protected.",
    },
    "/bom": {
        title: "Packing Formulas",
        purpose:
            "Inspect the released material quantities needed to pack one unit of each finished product.",
        steps: [
            "Find the finished product and open its formula details.",
            "Review each ingredient, packaging item, printed label and its quantity per finished unit.",
            "Check that the units and matching label describe the product you intend to pack.",
            "Use Formula Revisions for a change, or create a Packing Order to save these requirements for a production run.",
        ],
        workflow: [
            { label: "Items / Products", href: "/items" },
            { label: "Formula Revisions", href: "/formula-revisions" },
            { label: "Packing Orders", href: "/packing-orders" },
        ],
        note: "Formula changes require Packing access and an independent release review. Existing packing orders keep their own saved material requirements.",
    },
    "/formula-revisions": {
        title: "Formula Revisions",
        purpose:
            "Prepare and independently release a dated replacement or retirement of a finished product's packing formula.",
        steps: [
            "Create a revision for the finished product, choose Replace or Retire and set its effective date.",
            "For a replacement, enter the materials, compatible units and quantities required per one finished unit, including the matching printed label.",
            "Review the complete revision and submit it for approval.",
            "Have a different authorized reviewer release it on or after the effective date.",
            "Verify the published Packing Formula before creating future Packing Orders.",
        ],
        workflow: [
            { label: "Items / Products", href: "/items" },
            { label: "Packing Formulas", href: "/bom" },
            { label: "Packing Orders", href: "/packing-orders" },
        ],
        note: "Packing access is required to prepare revisions. The reviewer also needs Users & roles access. Release is manual; older orders retain their saved requirements and reservations.",
    },
    "/item-packaging": {
        title: "Item Packaging",
        purpose:
            "Define how many of an item's primary units belong in its box or case, with an optional barcode and gross weight.",
        steps: [
            "Choose the item and a compatible box or case unit.",
            "Enter the number of primary stock units in that package, such as 12 pieces per box.",
            "Add the barcode and gross weight when useful, then save the packaging record.",
            "Use the configured package unit in compatible purchasing or formula requirements and verify the converted quantities.",
        ],
        workflow: [
            { label: "Items / Products", href: "/items" },
            { label: "Units of Measure", href: "/uom" },
            { label: "Purchase Orders", href: "/purchase-orders" },
            { label: "Formula Revisions", href: "/formula-revisions" },
        ],
        note: "Inventory access is required. This item-specific ratio takes precedence over the unit's general conversion. Used ratios are protected so existing records keep their meaning.",
    },
    "/reorder-policies": {
        title: "Reorder Levels",
        purpose:
            "Set the available-stock threshold that should trigger a low-stock warning for each item.",
        steps: [
            "Select the item and review its primary stock unit.",
            "Enter and save the reorder level appropriate to its usual demand and replenishment needs.",
            "Open Dashboard or Low Stock in Inventory Reports to review warnings against that level.",
            "Use customer Material plan and supplier Purchase Orders to decide and record the actual replenishment.",
        ],
        workflow: [
            { label: "Dashboard", href: "/dashboard" },
            { label: "Inventory Reports", href: "/reports/inventory" },
            { label: "Sales Orders", href: "/sales-orders" },
            { label: "Purchase Orders", href: "/purchase-orders" },
        ],
        note: "Inventory access is required. Items without an override use the company default. A report threshold can override the saved level for that report; warnings create no purchase orders.",
    },
    "/reason-codes": {
        title: "Reason Codes",
        purpose:
            "Maintain clear, reusable explanations for verified stock corrections and permanent disposal.",
        steps: [
            "Create or review the reason name, description and appropriate category.",
            "Keep a reason active while operators should be able to choose it.",
            "Select an Inventory Adjustment reason when correcting a physical count, or a suitable disposal reason when preparing Scrap & Disposal.",
            "Deactivate a reason that should no longer be selected while preserving its past use.",
        ],
        workflow: [
            { label: "Stock Adjustments", href: "/inventory/adjustments" },
            { label: "Scrap & Disposal", href: "/inventory/scrap" },
            { label: "Stock Movements", href: "/inventory/transactions" },
        ],
        note: "Inventory access is required. Creating or editing a reason does not change stock.",
    },
    "/suppliers": {
        title: "Suppliers",
        purpose:
            "Maintain supplier contacts and identify which purchased materials each supplier can provide.",
        steps: [
            "Create the supplier with its contact details and active status.",
            "Open Link items to review current materials, or choose Link another item to add an eligible material.",
            "Check the linked-item count and the same supplier tags on Items / Products.",
            "Create a Purchase Order for that supplier and enter the agreed units, quantities and prices on its lines.",
        ],
        workflow: [
            { label: "Items / Products", href: "/items" },
            { label: "Purchase Orders", href: "/purchase-orders" },
            { label: "Receiving", href: "/receiving" },
        ],
        note: "Purchasing access is required. Only active linked materials appear on that supplier's new PO. A material can have several suppliers without duplicate item records.",
    },
    "/customers": {
        title: "Customers",
        purpose:
            "Keep customer contacts and delivery addresses ready for customer purchase orders and fulfillment.",
        steps: [
            "Create the customer with its name, contact person and available contact details.",
            "Record the delivery address and useful order notes, then keep the customer active for new business.",
            "Select the customer in Sales Orders and enter its PO reference with the requested products.",
            "Keep its details current while preserving the customer record used by historical orders.",
        ],
        workflow: [
            { label: "Sales Orders", href: "/sales-orders" },
            { label: "Delivery Orders", href: "/delivery-orders" },
        ],
        note: "Inventory access is required for changes. Customers are external contacts; stock leaves company inventory when their delivery is completed. Open sales orders can block deactivation.",
    },
    "/locations": {
        title: "Locations",
        purpose:
            "Define the company places where stock can be received, packed, stored or held while travelling.",
        steps: [
            "Create a unique code and name, choose the correct location type and keep it active for operations.",
            "Set up separate raw-material and finished-goods storage, with branch or store locations as needed.",
            "Provide an active In Transit location for dispatched transfers and customer deliveries.",
            "Select these records in receiving, packing and shipping, then use Inventory Stock to inspect their balances.",
        ],
        workflow: [
            { label: "Receiving", href: "/receiving" },
            { label: "Packing Orders", href: "/packing-orders" },
            { label: "Stock Transfers", href: "/transfers" },
            { label: "Inventory Stock", href: "/inventory" },
        ],
        note: "Inventory access is required. Creating a location adds no stock. Used location types are protected, and deactivation must not strand stock, reservations or open work.",
    },
    "/uom": {
        title: "Units of Measure",
        purpose:
            "Define compatible stock and purchase units so quantities convert consistently into each item's primary unit.",
        steps: [
            "Reuse an existing compatible class, such as Mass or Count, or create a class when needed.",
            "For an empty class, create its base unit first; add compatible units with the correct factor to that base.",
            "Choose each item's primary stock unit in Items / Products, such as kg for bulk ingredients or pc for packs and labels.",
            "Use Item Packaging for product-specific box or case contents, then review converted quantities in purchasing and packing.",
        ],
        workflow: [
            { label: "Items / Products", href: "/items" },
            { label: "Item Packaging", href: "/item-packaging" },
            { label: "Purchase Orders", href: "/purchase-orders" },
        ],
        note: "Inventory access is required. Each nonempty class has one base unit. Referenced conversions are protected so saved quantities retain their meaning.",
    },
    "/reports/inventory": {
        title: "Inventory Reports",
        purpose:
            "Inspect and export Stock by Location, Stock by Lot, Low Stock, Near Expiry and Inventory Movement.",
        steps: [
            "Choose the report tab that answers your stock or movement question.",
            "Select the relevant item, label, location, type or lot-status filters and apply them.",
            "For Low Stock review the threshold; for Near Expiry set the warning window; for Movement choose the dates or movement type.",
            "Compare the matching rows and totals in each primary unit, then sort, choose columns or select rows.",
            "Export all matching rows or the selected rows, and refresh after new operations have been saved.",
        ],
        workflow: [
            { label: "Inventory Stock", href: "/inventory" },
            { label: "Lots / Batches", href: "/inventory/lots" },
            { label: "Stock Movements", href: "/inventory/transactions" },
            { label: "Reorder Levels", href: "/reorder-policies" },
        ],
        note: "Reports are read-only. Stock tabs show current balances; movement dates filter stock history. Kilograms and pieces remain separate totals.",
    },
    "/reports/packing": {
        title: "Packing Report",
        purpose:
            "Compare planned and actual packing output with saved material requirements and recorded consumption.",
        steps: [
            "Filter to the packing runs or products you want to review.",
            "Compare target quantity, actual output and the reported variance.",
            "Inspect required and consumed material quantities, keeping each unit separate.",
            "Open the relevant Packing Order or stock movements to investigate, then export the matching rows when needed.",
        ],
        workflow: [
            { label: "Packing Orders", href: "/packing-orders" },
            { label: "Material Reservations", href: "/packing-orders/reservations" },
            { label: "Stock Movements", href: "/inventory/transactions" },
        ],
        note: "This report reads saved packing requirements and consumption. Later formula changes do not rewrite an older order's results.",
    },
    "/reports/purchasing": {
        title: "Purchasing Report",
        purpose:
            "Review supplier orders, actual receipts and the quantities and value still outstanding.",
        steps: [
            "Filter the purchasing records you want to review, such as a supplier or open orders.",
            "Compare ordered, received and remaining quantities in the displayed units.",
            "Review the agreed purchasing values and identify delayed or incomplete supply.",
            "Continue the relevant Purchase Order or Receiving action, and export the matching report rows when needed.",
        ],
        workflow: [
            { label: "Suppliers", href: "/suppliers" },
            { label: "Purchase Orders", href: "/purchase-orders" },
            { label: "Receiving", href: "/receiving" },
        ],
        note: "An outstanding PO is expected supply. It becomes available stock only after physical goods are received and the receipt is saved.",
    },
    "/reports/transfers": {
        title: "Transfer Report",
        purpose:
            "Follow internal shipments by comparing dispatched, received and still-In-Transit quantities.",
        steps: [
            "Filter the transfers or locations you want to inspect.",
            "Compare shipped and received quantities to find the remaining transit balance.",
            "Review shipments awaiting receipt and confirm their physical progress with the destination.",
            "Record actual arrivals in Stock Transfers, then refresh or export the report.",
        ],
        workflow: [
            { label: "Stock Transfers", href: "/transfers" },
            { label: "Inventory Stock", href: "/inventory" },
            { label: "Delivery Orders", href: "/delivery-orders" },
        ],
        note: "Company stock remains owned during an internal transfer. Customer shipments and their receipt are managed in Delivery Orders.",
    },
    "/reports/genealogy": {
        title: "Lot Genealogy",
        purpose:
            "Follow a batch from its supplier receipt through packing into finished lots and onward stock movements.",
        steps: [
            "Find the purchased material or finished-product lot you need to trace.",
            "For a finished lot, inspect its Packing Order and the material lots consumed to produce it.",
            "Follow purchased materials back to the supplier PO line and inspect later transfer or delivery references.",
            "Compare the linked lots and movements, then export the matching trace records when needed.",
        ],
        workflow: [
            { label: "Lots / Batches", href: "/inventory/lots" },
            { label: "Purchase Orders", href: "/purchase-orders" },
            { label: "Packing Orders", href: "/packing-orders" },
            { label: "Stock Movements", href: "/inventory/transactions" },
        ],
        note: "This is a read-only trace of saved operations. Current stock for a lot at each location is available in Lots / Batches and Inventory Stock.",
    },
    "/users": {
        title: "Users",
        purpose:
            "Give each operator a personal account and the role appropriate to their responsibilities.",
        steps: [
            "Confirm the intended role and its permissions before adding an operator.",
            "Create the user with their name, email, initial password and assigned role.",
            "Have the operator sign in and verify that the expected modules and actions are available.",
            "Keep profile and access assignments current while retaining an administrator account for ongoing management.",
        ],
        workflow: [
            { label: "Roles & Permissions", href: "/roles" },
            { label: "Company Settings", href: "/settings" },
            { label: "Dashboard", href: "/dashboard" },
        ],
        note: "Users & roles access is required. Personal accounts identify who performed each operation and allow independent review by another person.",
    },
    "/roles": {
        title: "Roles & Permissions",
        purpose:
            "Group operator responsibilities and control who may manage inventory, purchasing, packing, transfers and users.",
        steps: [
            "Create or edit a role with a clear name and description of its responsibilities.",
            "Choose only the management permissions the role needs and save it.",
            "Assign the role to the intended users and have them verify their available actions.",
            "Provide separate authorized preparers and reviewers for formula releases and disposal, while keeping administrator access.",
        ],
        workflow: [
            { label: "Users", href: "/users" },
            { label: "Formula Revisions", href: "/formula-revisions" },
            { label: "Scrap & Disposal", href: "/inventory/scrap" },
        ],
        note: "Users & roles access is required. Sales uses Inventory access, and customer deliveries use Transfers access; those permissions also allow their other related management actions.",
    },
    "/settings": {
        title: "Company Settings",
        purpose:
            "Maintain the company identity, contact details, currency and default low-stock and expiry warnings.",
        steps: [
            "Review the company name and available contact or address details.",
            "Confirm the operating currency before pricing history is recorded.",
            "Set a default reorder level and expiry-warning horizon appropriate to the business.",
            "Save the current settings, then review Dashboard and Inventory Reports to check their default warnings.",
        ],
        workflow: [
            { label: "Dashboard", href: "/dashboard" },
            { label: "Reorder Levels", href: "/reorder-policies" },
            { label: "Inventory Reports", href: "/reports/inventory" },
        ],
        note: "Users & roles access is required for changes. Currency is protected after pricing history exists, and saved item reorder levels take precedence over the company default.",
    },
} as const satisfies Record<string, ModuleGuide>

export type ModuleGuidePath = keyof typeof moduleGuides

export function getModuleGuide(pathname: string): ModuleGuide | undefined {
    const normalizedPath = pathname.replace(/\/+$/, "") || "/"
    const path =
        normalizedPath === "/transfers/in-transit" ? "/transfers" : normalizedPath
    return Object.hasOwn(moduleGuides, path)
        ? moduleGuides[path as ModuleGuidePath]
        : undefined
}
