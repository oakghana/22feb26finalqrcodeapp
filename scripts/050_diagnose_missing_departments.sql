-- Diagnostic script to identify user_profiles missing department_id
-- This helps understand why "N/A" appears for many users in Reports

-- 1. Count total profiles vs profiles with department_id
SELECT 
  'Total user_profiles' as metric,
  COUNT(*) as count
FROM user_profiles
UNION ALL
SELECT 
  'Profiles WITH department_id' as metric,
  COUNT(*) as count
FROM user_profiles
WHERE department_id IS NOT NULL
UNION ALL
SELECT 
  'Profiles WITHOUT department_id' as metric,
  COUNT(*) as count
FROM user_profiles
WHERE department_id IS NULL;

-- 2. List all available departments
SELECT 
  id,
  name,
  code
FROM departments
ORDER BY name;

-- 3. Show sample users without department_id (first 20)
SELECT 
  up.id,
  up.employee_id,
  up.first_name,
  up.last_name,
  up.email,
  up.role,
  up.department_id,
  up.created_at
FROM user_profiles up
WHERE up.department_id IS NULL
ORDER BY up.created_at DESC
LIMIT 20;

-- 4. Show users WITH department assigned (for comparison)
SELECT 
  up.id,
  up.employee_id,
  up.first_name,
  up.last_name,
  up.email,
  up.role,
  d.name as department_name,
  up.created_at
FROM user_profiles up
LEFT JOIN departments d ON up.department_id = d.id
WHERE up.department_id IS NOT NULL
ORDER BY up.created_at DESC
LIMIT 20;

-- 5. Attendance records by users - shows which users have checked in but lack department
SELECT 
  up.employee_id,
  up.first_name || ' ' || up.last_name as full_name,
  up.role,
  CASE WHEN up.department_id IS NULL THEN 'MISSING' ELSE 'OK' END as dept_status,
  COUNT(ar.id) as attendance_count
FROM attendance_records ar
JOIN user_profiles up ON ar.user_id = up.id
GROUP BY up.id, up.employee_id, up.first_name, up.last_name, up.role, up.department_id
HAVING up.department_id IS NULL
ORDER BY attendance_count DESC
LIMIT 30;
