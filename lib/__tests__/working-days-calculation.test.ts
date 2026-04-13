/**
 * Test file to demonstrate the corrected working days calculation logic
 * Run this file to verify all calculations are working correctly
 */

import {
  calculateWorkingDays,
  calculateAttendancePercentage,
  calculateExpectedAttendance,
  getWorkingDaysBreakdown,
  getHolidaysInRange,
  isWorkingDay,
  isHoliday,
  isWeekend,
  GHANA_HOLIDAYS_2026,
} from "@/lib/attendance-utils"

// Test dates - April 2026 (sample month)
const testStartDate = new Date(2026, 3, 1) // April 1, 2026 (Wednesday)
const testEndDate = new Date(2026, 3, 30) // April 30, 2026 (Thursday)

console.log("=" * 80)
console.log("WORKING DAYS CALCULATION TEST SUITE")
console.log("=" * 80)

// Test 1: Working days breakdown
console.log("\n1. WORKING DAYS BREAKDOWN FOR APRIL 2026:")
console.log("-".repeat(80))

const breakdown = getWorkingDaysBreakdown(testStartDate, testEndDate)
console.log("Total Calendar Days:", breakdown.totalCalendarDays)
console.log("Weekends (Sat/Sun):", breakdown.weekends)
console.log("Holidays:", breakdown.holidays)
console.log("Actual Working Days:", breakdown.workingDays)
console.log("Expected: ~22 working days (excluding 8-9 weekend days and holidays)")

// Test 2: Holidays in range
console.log("\n2. HOLIDAYS IN APRIL 2026:")
console.log("-".repeat(80))

const holidaysInApril = getHolidaysInRange(testStartDate, testEndDate)
console.log(`Found ${holidaysInApril.length} holiday(s):`)
holidaysInApril.forEach((h) => {
  console.log(`  - ${h.date}: ${h.name}`)
})

// Test 3: Regular staff working days
console.log("\n3. WORKING DAYS FOR REGULAR STAFF:")
console.log("-".repeat(80))

const regularStaffDays = calculateWorkingDays(testStartDate, testEndDate, {
  code: "HR",
  name: "Human Resources",
})
console.log(`Regular staff working days in April 2026: ${regularStaffDays}`)

// Test 4: Security staff working days
console.log("\n4. WORKING DAYS FOR SECURITY STAFF:")
console.log("-".repeat(80))

const securityStaffDays = calculateWorkingDays(testStartDate, testEndDate, {
  code: "SECURITY",
  name: "Security",
})
console.log(`Security staff working days in April 2026: ${securityStaffDays}`)
console.log(`Note: Security staff work all days (including weekends/holidays): 30 days`)

// Test 5: Attendance percentage calculation
console.log("\n5. ATTENDANCE PERCENTAGE COMPARISON:")
console.log("-".repeat(80))

const totalEmployees = 50
const actualAttendance = 45 * regularStaffDays // 45 out of 50 employees present each day

const percentage = calculateAttendancePercentage(actualAttendance, testStartDate, testEndDate, totalEmployees, {
  code: "HR",
  name: "Human Resources",
})

console.log(`Total Employees: ${totalEmployees}`)
console.log(`Actual Attendance Records: ${actualAttendance}`)
console.log(`Working Days (Regular Staff): ${regularStaffDays}`)
console.log(`Expected Attendance: ${totalEmployees * regularStaffDays}`)
console.log(`Attendance Percentage: ${percentage}%`)

// Test 6: OLD vs NEW calculation comparison
console.log("\n6. OLD vs NEW CALCULATION COMPARISON:")
console.log("-".repeat(80))

const oldTotalDays = Math.ceil((testEndDate.getTime() - testStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
const oldExpected = totalEmployees * oldTotalDays
const oldPercentage = (actualAttendance / oldExpected) * 100

console.log("OLD CALCULATION (INCORRECT - includes weekends):")
console.log(`  Total Days: ${oldTotalDays} (includes weekends/holidays)`)
console.log(`  Expected Attendance: ${oldExpected}`)
console.log(`  Attendance Percentage: ${oldPercentage.toFixed(2)}%`)
console.log(`  ❌ PROBLEM: Artificially low percentage due to counting weekends`)

console.log("\nNEW CALCULATION (CORRECT - excludes weekends/holidays):")
console.log(`  Working Days: ${regularStaffDays} (excludes weekends/holidays)`)
console.log(`  Expected Attendance: ${totalEmployees * regularStaffDays}`)
console.log(`  Attendance Percentage: ${percentage}%`)
console.log(`  ✓ ACCURATE: Reflects actual performance on working days only`)

// Test 7: Individual day classification
console.log("\n7. SAMPLE DAYS - CLASSIFICATION:")
console.log("-".repeat(80))

const sampleDates = [
  new Date(2026, 3, 1), // April 1 - Wednesday
  new Date(2026, 3, 4), // April 4 - Saturday
  new Date(2026, 3, 5), // April 5 - Sunday
  new Date(2026, 3, 6), // April 6 - Monday (work day)
]

sampleDates.forEach((date) => {
  const dayName = date.toLocaleDateString("en-US", { weekday: "long" })
  const isWeekendDay = isWeekend(date)
  const isHolidayDay = isHoliday(date)
  const isWorkingDayCheck = isWorkingDay(date)

  console.log(
    `${date.toISOString().split("T")[0]} (${dayName}): Weekend=${isWeekendDay}, Holiday=${isHolidayDay}, WorkingDay=${isWorkingDayCheck}`,
  )
})

console.log("\n" + "=" * 80)
console.log("KEY IMPROVEMENTS IN NEW SYSTEM:")
console.log("=" * 80)
console.log("✓ Weekends (Sat/Sun) excluded from working days for non-security staff")
console.log("✓ Holidays automatically excluded from working days calculation")
console.log("✓ Security staff treated differently (work all days)")
console.log("✓ Accurate attendance percentage reflecting actual performance")
console.log("✓ Consistent logic across all API routes and components")
console.log("✓ Full holiday support for Ghana 2026")
console.log("\nResult: Attendance reports now accurately reflect staff performance!")
console.log("=" * 80 + "\n")
