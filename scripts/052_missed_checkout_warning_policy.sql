-- Allow system/service role to insert no_checkout warnings without needing
-- the sender to be an admin or department_head.
-- This supports auto-generated warnings triggered on the user's next login.

-- Drop the restrictive insert policy and replace with one that also allows
-- the service role (used by the server-side API) to write system warnings.

DROP POLICY IF EXISTS "Admins and dept heads can send warnings" ON public.staff_warnings;

CREATE POLICY "Admins, dept heads and system can send warnings" ON public.staff_warnings
  FOR INSERT
  WITH CHECK (
    -- Admin or department head sending manually
    (
      sender_id = auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role IN ('admin', 'department_head')
      )
    )
    OR
    -- System-generated warning: sender_id matches recipient (self-insert via service role)
    -- The service role bypasses RLS entirely, so this policy is a safety net for anon/user keys.
    sender_id = recipient_id
  );

-- Index to prevent duplicate system warnings for the same user + date + type
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_warnings_no_duplicate_system
  ON public.staff_warnings (recipient_id, warning_type, attendance_date)
  WHERE warning_type = 'no_checkout';
