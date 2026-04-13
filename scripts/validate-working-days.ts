/**
 * Validation Script for Working Days Calculation
 * Run this to verify all calculations are correct in your environment
 */

import {
  calculateWorkingDays,
  calculateAttendancePercentage,
  getWorkingDaysBreakdown,
  getHolidaysInRange,
  isWorkingDay,
  isHoliday,
} from "@/lib/attendance-utils"

interface ValidationResult {
  test: string
  passed: boolean
  expected: any
  actual: any
  error?: string
}

const results: ValidationResult[] = []

function test(description: string, condition: boolean, expected: any, actual: any, error?: string) {
  results.push({
    test: description,
    passed: condition,
    expected,
    actual,
    error,
  })
}

console.log("RUNNING WORKING DAYS CALCULATION VALIDATION\n")

// Test 1: April 2026 working days
const april1 = new Date(2026, 3, 1)
const april30 = new Date(2026, 3, 30)
const aprilWorkingDays = calculateWorkingDays(april1, april30)

test(
  "April 2026 should have 22 working days",
  aprilWorkingDays === 22,
  22,
  aprilWorkingDays,
  aprilWorkingDays !== 22 ? `Got ${aprilWorkingDays} instead of 22` : undefined,
)

// Test 2: Weekend detection
const saturday = new Date(2026, 3, 4) // April 4, 2026 is Saturday
const wednesday = new Date(2026, 3, 1) // April 1, 2026 is Wednesday

test("Saturday should not be a working day", !isWorkingDay(saturday), true, !isWorkingDay(saturday))

test("Wednesday should be a working day", isWorkingDay(wednesday), true, isWorkingDay(wednesday))

// Test 3: Holiday detection
const newYearsDay = new Date(2026, 0, 1)
const randomDay = new Date(2026, 0, 2)

test("January 1, 2026 should be detected as a holiday", isHoliday(newYearsDay), true, isHoliday(newYearsDay))

test("January 2, 2026 should not be a holiday", !isHoliday(randomDay), true, !isHoliday(randomDay))

// Test 4: Attendance percentage calculation
const actual = 990
const expected = 1100
const percentage = calculateAttendancePercentage(actual, april1, april30, 50)
const expectedPercentage = 90

test(
  `Attendance percentage should be ${expectedPercentage}%`,
  percentage === expectedPercentage,
  expectedPercentage,
  percentage,
)

// Test 5: Working days breakdown
const breakdown = getWorkingDaysBreakdown(april1, april30)

test("Breakdown should show 30 total days", breakdown.totalDays === 30, 30, breakdown.totalDays)

test("Breakdown should show 22 working days", breakdown.workingDays === 22, 22, breakdown.workingDays)

test("Breakdown should show 8 weekend days", breakdown.weekends === 8, 8, breakdown.weekends)

// Test 6: Holidays in range
const mayStart = new Date(2026, 4, 1)
const mayEnd = new Date(2026, 4, 31)
const mayHolidays = getHolidaysInRange(mayStart, mayEnd)

test("May 2026 should have 1 holiday (Workers Day)", mayHolidays.length === 1, 1, mayHolidays.length)

if (mayHolidays.length > 0) {
  test("May holiday should be Workers Day", mayHolidays[0].name === "Workers' Day", "Workers' Day", mayHolidays[0].name)
}

// Test 7: Single day calculation
const singleDay = new Date(2026, 3, 1)
const singleDayCalc = calculateWorkingDays(singleDay, singleDay)

test("Single Wednesday should be 1 working day", singleDayCalc === 1, 1, singleDayCalc)

// Test 8: Week calculation
const monday = new Date(2026, 3, 6) // April 6, 2026 is Monday
const friday = new Date(2026, 3, 10) // April 10, 2026 is Friday
const weekDays = calculateWorkingDays(monday, friday)

test("Single week (Mon-Fri) should be 5 working days", weekDays === 5, 5, weekDays)

// Test 9: Week including weekend
const mondayIncludingWeekend = new Date(2026, 3, 6) // Monday
const mondayNextWeek = new Date(2026, 3, 13) // Next Monday
const weekPlusWeekendDays = calculateWorkingDays(mondayIncludingWeekend, mondayNextWeek)

test("Mon-Mon (including weekend) should be 6 working days", weekPlusWeekendDays === 6, 6, weekPlusWeekendDays)

// Test 10: Security staff gets all days
const securityStaffDays = calculateWorkingDays(april1, april30, { code: "SECURITY", name: "Security" })

test("Security staff in April 2026 should get 30 days", securityStaffDays === 30, 30, securityStaffDays)

// Print results
console.log("\n" + "=".repeat(80))
console.log("VALIDATION RESULTS")
console.log("=".repeat(80) + "\n")

let passed = 0
let failed = 0

results.forEach((result, index) => {
  const status = result.passed ? "✓ PASS" : "✗ FAIL"
  console.log(`${index + 1}. ${status}: ${result.test}`)

  if (!result.passed) {
    console.log(`   Expected: ${JSON.stringify(result.expected)}`)
    console.log(`   Actual: ${JSON.stringify(result.actual)}`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
    failed++
  } else {
    passed++
  }
})

console.log("\n" + "=".repeat(80))
console.log(`SUMMARY: ${passed} passed, ${failed} failed out of ${results.length} tests`)
console.log("=".repeat(80) + "\n")

if (failed === 0) {
  console.log("✓ ALL TESTS PASSED - Working days calculation is functioning correctly!")
} else {
  console.log(`✗ ${failed} TEST(S) FAILED - Please review the errors above`)
}

// Export for testing frameworks
export { results }
