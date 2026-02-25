-- Migration 045: Add audit_staff role to user_profiles role constraint
-- Fixes: "Failed to create user account" error when IT-Admin creates staff with audit_staff role

-- Drop the existing constraint
ALTER TABLE user_profiles
DROP CONSTRAINT user_profiles_role_check;

-- Add the new constraint with all valid roles including audit_staff
ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('admin', 'it-admin', 'department_head', 'regional_manager', 'nsp', 'intern', 'contract', 'staff', 'audit_staff'));
