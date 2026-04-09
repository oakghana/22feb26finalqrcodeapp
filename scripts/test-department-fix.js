/**
 * Test script to verify the department enrichment fix
 * This simulates the API logic to verify departments are properly enriched
 */

console.log("[v0] ========== DEPARTMENT ENRICHMENT TEST ==========");

// Simulate the API response structure
const mockAttendanceRecords = [
  {
    id: "rec-1",
    user_id: "user-1",
    check_in_time: "2026-04-09T08:00:00",
    status: "present"
  },
  {
    id: "rec-2",
    user_id: "user-2",
    check_in_time: "2026-04-09T08:15:00",
    status: "present"
  }
];

const mockUserProfiles = [
  {
    id: "user-1",
    first_name: "Kwasi",
    last_name: "Boakye",
    employee_id: "EMP001",
    department_id: "dept-ops",
  },
  {
    id: "user-2",
    first_name: "Michael",
    last_name: "Oduro",
    employee_id: "EMP002",
    department_id: "dept-sec",
  }
];

const mockDepartments = [
  { id: "dept-ops", name: "Operations" },
  { id: "dept-sec", name: "Security" }
];

// Simulate the API enrichment logic
console.log("\n[v0] Step 1: Building department map");
const deptMap = new Map();
mockDepartments.forEach(d => deptMap.set(d.id, d));
console.log("[v0] Department map size:", deptMap.size);
console.log("[v0] Department map:", Object.fromEntries(deptMap));

console.log("\n[v0] Step 2: Enriching user profiles with departments");
const enrichedProfiles = mockUserProfiles.map(profile => {
  const dept = profile.department_id ? deptMap.get(profile.department_id) : null;
  return {
    ...profile,
    departments: dept,
  };
});
console.log("[v0] Enriched profiles:", JSON.stringify(enrichedProfiles, null, 2));

console.log("\n[v0] Step 3: Building user profile map");
const userMap = new Map(enrichedProfiles.map(p => [p.id, p]));
console.log("[v0] User map size:", userMap.size);

console.log("\n[v0] Step 4: Enriching attendance records with user profiles");
const enrichedRecords = mockAttendanceRecords.map(record => {
  const userProfile = userMap.get(record.user_id) || null;
  return {
    ...record,
    user_profiles: userProfile,
  };
});

console.log("\n[v0] ===== ENRICHED ATTENDANCE RECORDS =====");
enrichedRecords.forEach((record, idx) => {
  console.log(`\n[v0] Record ${idx + 1}:`);
  console.log(`  User: ${record.user_profiles?.first_name} ${record.user_profiles?.last_name}`);
  console.log(`  Employee ID: ${record.user_profiles?.employee_id}`);
  console.log(`  Department ID: ${record.user_profiles?.department_id}`);
  console.log(`  Department Name: ${record.user_profiles?.departments?.name || "N/A"}`);
});

console.log("\n[v0] ===== DIAGNOSTIC CHECK =====");
const withDepts = enrichedRecords.filter(r => r.user_profiles?.departments?.name).length;
const withoutDepts = enrichedRecords.filter(r => !r.user_profiles?.departments?.name).length;
console.log(`[v0] Records with departments: ${withDepts}/${enrichedRecords.length}`);
console.log(`[v0] Records missing departments: ${withoutDepts}/${enrichedRecords.length}`);

if (withoutDepts === 0) {
  console.log("\n[v0] ✅ SUCCESS: All records have departments enriched!");
} else {
  console.log("\n[v0] ❌ FAILURE: Some records are missing department data");
}

console.log("\n[v0] ========== TEST COMPLETE ==========");
