-- ============================================================================
-- CLEAR ALL DEVICE MONITORING DATA - Fresh Start
-- ============================================================================
-- Purpose: Remove all dubious/questionable device violation data so we can
-- start fresh with the improved, accurate device fingerprinting logic.
--
-- Why: The previous data contained false positives caused by:
--   1. Shared public IP addresses (CGNAT from Ghana ISPs like MTN, Vodafone)
--      grouping users from DIFFERENT regions as "sharing a device"
--   2. Weak device fingerprinting that gave identical hashes to users with
--      the same phone model + browser version
--
-- Tables affected: device_security_violations, device_user_bindings,
-- device_sessions
-- ============================================================================

-- 1. Clear all recorded device security violations
DELETE FROM device_security_violations;

-- 2. Clear all device-to-user bindings (users will be re-bound on next login)
DELETE FROM device_user_bindings;

-- 3. Clear all device sessions (will be re-populated as users log in)
DELETE FROM device_sessions;

-- 4. Clear device-related security notifications so dashboard starts clean
DELETE FROM staff_notifications
WHERE notification_type IN ('security_violation', 'device_sharing_alert')
   OR type IN ('security_violation', 'device_sharing_alert');

-- 5. Report post-cleanup counts for verification
DO $$
DECLARE
  v_violations_count INT;
  v_bindings_count INT;
  v_sessions_count INT;
BEGIN
  SELECT COUNT(*) INTO v_violations_count FROM device_security_violations;
  SELECT COUNT(*) INTO v_bindings_count FROM device_user_bindings;
  SELECT COUNT(*) INTO v_sessions_count FROM device_sessions;

  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Device monitoring data cleanup complete';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'device_security_violations: % rows', v_violations_count;
  RAISE NOTICE 'device_user_bindings:       % rows', v_bindings_count;
  RAISE NOTICE 'device_sessions:            % rows', v_sessions_count;
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Fresh start ready. New accurate fingerprinting is active.';
END $$;
