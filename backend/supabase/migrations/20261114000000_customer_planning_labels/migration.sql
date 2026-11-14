-- Add customer PO references and product label assignments without rewriting history.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='items' AND column_name='label_item_id') THEN
        ALTER TABLE "items" ADD COLUMN "label_item_id" integer;
        -- Infer only an unambiguous existing BOM label; multiple labels require operator choice.
UPDATE "items" AS product
SET "label_item_id" = candidate.label_id
FROM (
    SELECT bom.parent_item_id, min(component.item_id) AS label_id
    FROM bill_of_materials bom
    JOIN items component ON component.item_id=bom.component_item_id
    WHERE component.item_type='Packaging - Label'
    GROUP BY bom.parent_item_id
    HAVING count(*)=1
) AS candidate
WHERE product.item_id=candidate.parent_item_id
  AND product.item_type='Finished Good' AND product.label_item_id IS NULL;
    END IF;
END $$;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "customer_po_number" varchar(100);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='items'::regclass AND conname='items_label_item_id_items_item_id_fk') THEN
        ALTER TABLE "items" ADD CONSTRAINT "items_label_item_id_items_item_id_fk" FOREIGN KEY ("label_item_id") REFERENCES "items"("item_id") ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='items'::regclass AND conname='items_label_finished_only') THEN
        ALTER TABLE "items" ADD CONSTRAINT "items_label_finished_only" CHECK ("label_item_id" IS NULL OR "item_type"='Finished Good');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='items'::regclass AND conname='items_label_not_self') THEN
        ALTER TABLE "items" ADD CONSTRAINT "items_label_not_self" CHECK ("label_item_id" IS NULL OR "label_item_id"<>"item_id");
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS "items_label_item_idx" ON "items" ("label_item_id");
-- The legacy brands table and items.brand_id remain untouched for existing history.

