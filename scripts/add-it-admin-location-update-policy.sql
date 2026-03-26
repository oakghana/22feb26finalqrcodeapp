-- Allow it-admin role to update the name column on geofence_locations
-- This fixes the RLS permission denied error when IT-Admin tries to rename a location

-- Drop the policy if it already exists to avoid conflicts
DROP POLICY IF EXISTS "it_admin_update_location_name" ON geofence_locations;

-- Create a new RLS policy that allows users with role 'it-admin' to UPDATE geofence_locations
-- but only the name column (enforced at the application level via the API)
CREATE POLICY "it_admin_update_location_name"
ON geofence_locations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'it-admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'it-admin'
  )
);
