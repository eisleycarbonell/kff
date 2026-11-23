-- Additive performance indexes matching high-frequency ORDER BY, WHERE, and EXISTS patterns.
CREATE INDEX IF NOT EXISTS "txn_created_id_idx" ON "inventory_transactions" USING btree ("created_at","transaction_id");
CREATE INDEX IF NOT EXISTS "txn_type_created_idx" ON "inventory_transactions" USING btree ("transaction_type","created_at");
CREATE INDEX IF NOT EXISTS "formula_rev_mat_component_idx" ON "formula_revision_materials" USING btree ("component_item_id");
CREATE INDEX IF NOT EXISTS "sales_order_date_idx" ON "sales_orders" USING btree ("order_date");
CREATE INDEX IF NOT EXISTS "delivery_order_date_idx" ON "delivery_orders" USING btree ("delivery_date");
CREATE INDEX IF NOT EXISTS "lots_created_id_idx" ON "lots" USING btree ("created_at","lot_id");
