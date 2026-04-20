-- Add auto_checkin_enabled column to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS auto_checkin_enabled BOOLEAN DEFAULT true;

-- Add auto_checkin_radius_m column for tolerance (default 50m)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS auto_checkin_radius_m INTEGER DEFAULT 50;

-- Create geofence_entry_log table for tracking when users enter/exit locations
CREATE TABLE IF NOT EXISTS geofence_entry_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  entry_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  exit_time TIMESTAMP WITH TIME ZONE,
  distance_meters DECIMAL(10, 2),
  accuracy_meters DECIMAL(10, 2),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  auto_checked_in BOOLEAN DEFAULT false,
  check_in_record_id UUID REFERENCES attendance_records(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_geofence_entry_log_user_id ON geofence_entry_log(user_id);
CREATE INDEX IF NOT EXISTS idx_geofence_entry_log_location_id ON geofence_entry_log(location_id);
CREATE INDEX IF NOT EXISTS idx_geofence_entry_log_entry_time ON geofence_entry_log(entry_time);

-- Enable RLS on geofence_entry_log
ALTER TABLE geofence_entry_log ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only view their own geofence entry logs
CREATE POLICY IF NOT EXISTS "Users can view own geofence logs"
  ON geofence_entry_log
  FOR SELECT
  USING (user_id = auth.uid());

-- RLS: System can insert geofence logs
CREATE POLICY IF NOT EXISTS "System can insert geofence logs"
  ON geofence_entry_log
  FOR INSERT
  WITH CHECK (true);

-- RLS: Admins can view all geofence logs
CREATE POLICY IF NOT EXISTS "Admins can view all geofence logs"
  ON geofence_entry_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'department_head')
    )
  );
