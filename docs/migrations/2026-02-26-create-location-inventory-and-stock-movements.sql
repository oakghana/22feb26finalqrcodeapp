-- Migration: Create location_inventory and stock_movements, plus transfer_stock function
-- Run in Postgres (Supabase SQL editor / psql)

BEGIN;

-- Create location_inventory table to track per-location stock quantities
CREATE TABLE IF NOT EXISTS public.location_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,## Error Type
Build Error

## Error Message
Parsing ecmascript source code failed

## Build Output
./components/admin/attendance-reports.tsx:12:15
Parsing ecmascript source code failed
  10 | import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
  11 | import { Alert, AlertDescription } from "@/components/ui/alert"
> 12 |               return [
     |               ^^^^^^^^
> 13 |                 new Date(record.check_in_time).toLocaleDateString(),
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 14 |                 `"${record.user_profiles?.employee_id || "N/A"}"`,
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 15 |                 `"${(record.user_profiles?.first_name || "") + (record.user_profiles?.last_name ? ' ' + record.user_profiles.last_name : '') || 'Unknown User'}"`,
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 16 |                 `"${record.user_profiles?.departments?.name || "N/A"}"`,
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 17 |                 `"${record.user_profiles?.assigned_location?.name || "N/A"}"`,
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 18 |                 `"${new Date(record.check_in_time).toLocaleTimeString()}"`,
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 19 |                 `"${checkInLabel}"`,
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 20 |                 `"${record.is_check_in_outside_location ? "Outside Assigned Location" : "On-site"}"`,
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 21 |                 `"${record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString() : "N/A"}"`,
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 22 |                 `"${checkOutLabel}"`,
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 23 |                 `"${record.is_check_out_outside_location ? "Outside Assigned Location" : "On-site"}"`,
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 24 |                 `"${record.early_checkout_reason || "-"}"`,
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 25 |                 `"${record.early_checkout_proved_by || "-"}"`,
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 26 |                 `"${record.lateness_reason || "-"}"`,
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 27 |                 `"${record.lateness_proved_by || "-"}"`,
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 28 |                 record.work_hours?.toFixed(2) || "0",
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 29 |                 `"${record.status}"`,
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 30 |                 `"${record.is_check_in_outside_location || record.is_check_out_outside_location ? "Remote Work" : "On-site"}"`,
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 31 |               ].join(",")
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^
  32 |   Download,
  33 |   CalendarIcon,
  34 |   Users,

Return statement is not allowed here

Import trace:
  Server Component:
    ./components/admin/attendance-reports.tsx
    ./app/dashboard/reports/page.tsx

Next.js version: 16.1.4 (Turbopack)

  item_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_location_item_unique ON public.location_inventory (location_id, item_id);

-- Create stock_movements table to audit transfers/issuances
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  quantity numeric NOT NULL,
  from_location_id uuid NULL,
  to_location_id uuid NULL,
  requisition_id uuid NULL,
  performed_by uuid NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON public.stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_requisition ON public.stock_movements(requisition_id);

-- Create a function to perform an atomic transfer (decrement from source, increment to destination)
CREATE OR REPLACE FUNCTION public.transfer_stock(
  p_item_id uuid,
  p_quantity numeric,
  p_from_location uuid,
  p_to_location uuid,
  p_requisition_id uuid,
  p_performed_by uuid,
  p_notes text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Validate quantity
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  -- Ensure source inventory row exists (if from_location provided)
  IF p_from_location IS NOT NULL THEN
    INSERT INTO public.location_inventory (location_id, item_id, quantity)
    VALUES (p_from_location, p_item_id, 0)
    ON CONFLICT (location_id, item_id) DO NOTHING;

    -- Check available quantity
    PERFORM 1 FROM public.location_inventory WHERE location_id = p_from_location AND item_id = p_item_id AND quantity >= p_quantity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock at source location';
    END IF;

    -- Decrement source
    UPDATE public.location_inventory
    SET quantity = quantity - p_quantity, updated_at = now()
    WHERE location_id = p_from_location AND item_id = p_item_id;
  END IF;

  -- Ensure destination inventory row exists (if to_location provided)
  IF p_to_location IS NOT NULL THEN
    INSERT INTO public.location_inventory (location_id, item_id, quantity)
    VALUES (p_to_location, p_item_id, 0)
    ON CONFLICT (location_id, item_id) DO NOTHING;

    -- Increment destination
    UPDATE public.location_inventory
    SET quantity = quantity + p_quantity, updated_at = now()
    WHERE location_id = p_to_location AND item_id = p_item_id;
  END IF;

  -- Record movement in audit table
  INSERT INTO public.stock_movements (item_id, quantity, from_location_id, to_location_id, requisition_id, performed_by, notes)
  VALUES (p_item_id, p_quantity, p_from_location, p_to_location, p_requisition_id, p_performed_by, p_notes);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS as appropriate (policy examples - adjust to your auth setup)
ALTER TABLE public.location_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Policy: allow authenticated users to select their location inventory (example)
CREATE POLICY "Select location inventory for authenticated" ON public.location_inventory
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Policy: allow inserts/updates via service role (recommend to use admin RPCs)
CREATE POLICY "Service role can modify inventory" ON public.location_inventory
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMIT;

-- Note: Adjust RLS policies to match your Supabase auth setup. The transfer_stock function is SECURITY DEFINER to allow atomic updates; ensure function ownership and privileges are reviewed before deploying to production.
