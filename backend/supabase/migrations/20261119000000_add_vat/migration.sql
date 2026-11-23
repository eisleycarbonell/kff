-- Add VAT support (company VAT rate, item VATability flag, and per-line PO/SO VAT snapshots).
-- Existing PO and SO lines retain 0.00% so historical financial records are never altered.
ALTER TABLE "company_settings"
    ADD COLUMN IF NOT EXISTS "vat_rate_percent" numeric(5, 2) NOT NULL DEFAULT 12.00;
ALTER TABLE "company_settings" DROP CONSTRAINT IF EXISTS "settings_limits";
ALTER TABLE "company_settings"
    ADD CONSTRAINT "settings_limits" CHECK (
        "default_reorder_level" >= 0
        AND "expiry_warning_days" BETWEEN 0 AND 3650
        AND "vat_rate_percent" BETWEEN 0 AND 100
        AND "version" > 0
    );

ALTER TABLE "items"
    ADD COLUMN IF NOT EXISTS "is_vatable" boolean NOT NULL DEFAULT true;

ALTER TABLE "purchase_order_lines"
    ADD COLUMN IF NOT EXISTS "vat_rate_percent" numeric(5, 2) NOT NULL DEFAULT 0.00;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='purchase_order_lines'::regclass AND conname='pol_vat_rate_range') THEN
        ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "pol_vat_rate_range" CHECK ("vat_rate_percent" >= 0 AND "vat_rate_percent" <= 100);
    END IF;
END $$;

ALTER TABLE "sales_order_lines"
    ADD COLUMN IF NOT EXISTS "vat_rate_percent" numeric(5, 2) NOT NULL DEFAULT 0.00;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='sales_order_lines'::regclass AND conname='sales_line_vat_rate_range') THEN
        ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_line_vat_rate_range" CHECK ("vat_rate_percent" >= 0 AND "vat_rate_percent" <= 100);
    END IF;
END $$;
