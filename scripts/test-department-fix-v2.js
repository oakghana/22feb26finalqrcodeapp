#!/usr/bin/env node

console.log("[v0] ========== DEPARTMENT ENRICHMENT TEST (BATCH FETCH) ==========\n");

// Simulate what happens with a large number of departments
const userProfiles = Array.from({ length: 50 }, (_, i) => ({
  id: `user-${i + 1}`,
  first_name: `Employee${i + 1}`,
  last_name: `Name${i + 1}`,
  employee_id: `EMP${String(i + 1).padStart(3, '0')}`,
  department_id: `dept-${Math.floor(i / 5)}`, // Distribute across 10 departments
}));

console.log("[v0] Step 1: Extracted department IDs");
const deptIds = [...new Set(userProfiles.map(p => p.department_id).filter(Boolean))];
console.log(`[v0] Total unique departments: ${deptIds.length}`);
console.log(`[v0] Department IDs: ${deptIds.join(", ")}\n`);

// Simulate departments table
const departmentsDB = Array.from({ length: 10 }, (_, i) => ({
  id: `dept-${i}`,
  name: `Department ${String.fromCharCode(65 + i)}`, // A, B, C, etc.
  code: `D${i}`,
}));

console.log("[v0] Step 2: Simulating batch fetching departments");
const BATCH_SIZE = 200;
const deptMap = new Map();

for (let i = 0; i < deptIds.length; i += BATCH_SIZE) {
  const batch = deptIds.slice(i, i + BATCH_SIZE);
  console.log(`[v0]   Batch ${Math.floor(i / BATCH_SIZE) + 1}: Fetching ${batch.length} departments`);
  
  // Simulate database query
  const matchedDepts = departmentsDB.filter(d => batch.includes(d.id));
  matchedDepts.forEach(d => deptMap.set(d.id, d));
}

console.log(`[v0] Successfully mapped ${deptMap.size} departments\n`);

console.log("[v0] Step 3: Enriching user profiles");
const enrichedProfiles = userProfiles.map(profile => {
  const dept = profile.department_id ? deptMap.get(profile.department_id) : null;
  return {
    ...profile,
    departments: dept,
  };
});

console.log("[v0] Enriched profiles sample:");
enrichedProfiles.slice(0, 5).forEach((p) => {
  console.log(`[v0]   ${p.first_name} ${p.last_name} (${p.employee_id}) → ${p.departments?.name || "N/A"}`);
});

console.log("\n[v0] ===== DIAGNOSTIC CHECK =====");
const withDepts = enrichedProfiles.filter(p => p.departments?.name).length;
const withoutDepts = enrichedProfiles.filter(p => !p.departments?.name).length;
console.log(`[v0] Profiles with departments: ${withDepts}/${enrichedProfiles.length}`);
console.log(`[v0] Profiles missing departments: ${withoutDepts}/${enrichedProfiles.length}`);

if (withoutDepts === 0) {
  console.log("[v0] ✅ SUCCESS: All profiles have departments enriched!");
} else {
  console.log("[v0] ⚠️  WARNING: Some profiles still missing departments");
  enrichedProfiles
    .filter(p => !p.departments?.name)
    .slice(0, 3)
    .forEach(p => {
      console.log(`[v0]   - ${p.first_name} ${p.last_name} (dept_id: ${p.department_id})`);
    });
}

console.log("\n[v0] ========== TEST COMPLETE ==========");
