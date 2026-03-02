-- Migration: add columns to capture who provided/verified reasons for lateness and early checkout
-- Adds text fields for a human-readable name and optional UUID columns for a reference id
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS lateness_proved_by TEXT,
  ADD COLUMN IF NOT EXISTS lateness_proved_by_id UUID,
  ADD COLUMN IF NOT EXISTS early_checkout_proved_by TEXT,
  ADD COLUMN IF NOT EXISTS early_checkout_proved_by_id UUID;

-- Add brief comment for clarity
COMMENT ON COLUMN public.attendance_records.lateness_proved_by IS 'Display name or identifier of the person who provided/verified the lateness reason';
COMMENT ON COLUMN public.attendance_records.early_checkout_proved_by IS 'Display name or identifier of the person who provided/verified the early checkout reason';
