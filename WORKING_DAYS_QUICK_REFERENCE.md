# Quick Reference: Working Days Calculation Functions

## Import Statement
```typescript
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
  isSecurityDept
} from "@/lib/attendance-utils"
```

---

## Function Reference

### 1. Calculate Working Days
```typescript
const workingDays = calculateWorkingDays(
  startDate,        // Date object
  endDate,          // Date object
  deptInfo          // Optional: { code?, name? }
)
```
- Returns number of working days (Mon-Fri, excluding holidays)
- Security staff get all days (including weekends)

**Example:**
```typescript
// April 2026: 22 working days
const days = calculateWorkingDays(
  new Date(2026, 3, 1),
  new Date(2026, 3, 30),
  { code: "HR", name: "Human Resources" }
)
```

---

### 2. Calculate Expected Attendance
```typescript
const expected = calculateExpectedAttendance(
  startDate,        // Date object
  endDate,          // Date object
  totalEmployees,   // Number
  deptInfo          // Optional: { code?, name? }
)
```
- Returns total staff-days expected (employees × working days)

**Example:**
```typescript
// 50 employees × 22 working days = 1,100 expected
const expected = calculateExpectedAttendance(
  new Date(2026, 3, 1),
  new Date(2026, 3, 30),
  50,
  { code: "HR", name: "Human Resources" }
)
```

---

### 3. Calculate Attendance Percentage
```typescript
const percentage = calculateAttendancePercentage(
  actualAttendance, // Number of records
  startDate,        // Date object
  endDate,          // Date object
  totalEmployees,   // Number
  deptInfo          // Optional: { code?, name? }
)
```
- Returns percentage (0-100) with 2 decimal places

**Example:**
```typescript
// 990 actual / 1,100 expected = 90%
const pct = calculateAttendancePercentage(
  990,
  new Date(2026, 3, 1),
  new Date(2026, 3, 30),
  50,
  { code: "HR", name: "Human Resources" }
) // Returns: 90
```

---

### 4. Get Working Days Breakdown
```typescript
const breakdown = getWorkingDaysBreakdown(startDate, endDate)
```
- Returns object with: `{ totalDays, weekdays, weekends, holidays, workingDays, totalCalendarDays }`

**Example:**
```typescript
const breakdown = getWorkingDaysBreakdown(
  new Date(2026, 3, 1),
  new Date(2026, 3, 30)
)
// {
//   totalDays: 30,
//   weekdays: 22,
//   weekends: 8,
//   holidays: 0,
//   workingDays: 22,
//   totalCalendarDays: 30
// }
```

---

### 5. Get Holidays in Range
```typescript
const holidays = getHolidaysInRange(startDate, endDate)
```
- Returns array of holiday objects: `[{ date, name, dateObj }, ...]`

**Example:**
```typescript
const holidays = getHolidaysInRange(
  new Date(2026, 4, 1),    // May 1
  new Date(2026, 4, 31)    // May 31
)
// [
//   { date: "2026-05-01", name: "Workers' Day", dateObj: Date(...) }
// ]
```

---

### 6. Check if Date is Working Day
```typescript
const isWorking = isWorkingDay(date)
```
- Returns boolean (true if Mon-Fri and not a holiday)

**Example:**
```typescript
isWorkingDay(new Date(2026, 3, 1))  // true (Wednesday)
isWorkingDay(new Date(2026, 3, 4))  // false (Saturday)
isWorkingDay(new Date(2026, 3, 5))  // false (Sunday)
```

---

### 7. Check if Date is Holiday
```typescript
const isHol = isHoliday(date)
```
- Returns boolean

**Example:**
```typescript
isHoliday(new Date(2026, 0, 1))  // true (New Year's Day)
isHoliday(new Date(2026, 0, 2))  // false (Regular day)
```

---

### 8. Check if Date is Weekend
```typescript
const isWeekendDay = isWeekend(date)
```
- Returns boolean (true for Sat/Sun)

---

### 9. Check Department Type
```typescript
const isSecurity = isSecurityDept(deptInfo)
```
- Returns boolean (true if code or name contains "security")

---

## Common Use Cases

### Use Case 1: Calculate Department Attendance
```typescript
const summaries = staff.map((member) => {
  const workingDays = calculateWorkingDays(
    startDate,
    endDate,
    member.departments
  )
  
  const attendanceRecords = /* fetch from DB */
  const attendance = attendanceRecords.length
  
  const percentage = calculateAttendancePercentage(
    attendance,
    startDate,
    endDate,
    1, // Single employee
    member.departments
  )
  
  return {
    name: member.name,
    workingDays,
    attendance,
    percentage
  }
})
```

### Use Case 2: Dashboard Analytics
```typescript
const analytics = {
  period: "April 2026",
  breakdown: getWorkingDaysBreakdown(startDate, endDate),
  holidays: getHolidaysInRange(startDate, endDate),
  expectedAttendance: calculateExpectedAttendance(
    startDate,
    endDate,
    totalEmployees
  ),
  actualAttendance: attendanceRecords.length,
  attendanceRate: calculateAttendancePercentage(
    attendanceRecords.length,
    startDate,
    endDate,
    totalEmployees
  )
}
```

### Use Case 3: Find Attendance Defaulters
```typescript
const defaulters = staff
  .map((member) => {
    const workingDays = calculateWorkingDays(
      startDate,
      endDate,
      member.departments
    )
    
    const attendance = /* count records */
    const isMissing = attendance < (workingDays * 0.8) // Less than 80%
    
    return isMissing ? member : null
  })
  .filter(Boolean)
```

---

## Ghana Holidays 2026

The system includes these holidays automatically:

- January 1: New Year's Day
- February 23: Founder's Day
- March 30: Easter Monday
- May 1: Workers' Day
- May 14: Ascension Day
- June 4: Republic Day
- July 1: Id-ul-Adha
- July 21: Islamic New Year
- September 21: Founder's Day
- September 29: Founders' Day (Observation)
- October 25: Eid-ul-Mawlid
- December 25: Christmas Day
- December 26: Boxing Day

---

## Department Handling

### Security Staff (24/7 Workers)
```typescript
const securityDays = calculateWorkingDays(startDate, endDate, {
  code: "SECURITY",
  name: "Security Operations"
})
// Returns ALL days (including weekends/holidays)
// Example: 30 days for 30-day period
```

### Regular Staff (Mon-Fri Workers)
```typescript
const regularDays = calculateWorkingDays(startDate, endDate, {
  code: "HR",
  name: "Human Resources"
})
// Returns working days only (Mon-Fri, excluding holidays)
// Example: 22 days for 30-day period
```

---

## Tips & Best Practices

1. **Always Include Department Info**
   ```typescript
   // Good: Account for security exemptions
   calculateWorkingDays(start, end, userDept)
   
   // Risky: Might miscalculate for security staff
   calculateWorkingDays(start, end)
   ```

2. **Use Centralized Functions**
   ```typescript
   // Good: Use utility function
   const pct = calculateAttendancePercentage(...)
   
   // Bad: Manual calculation (might miss updates)
   const pct = (actual / expected) * 100
   ```

3. **Check for Holidays in UI**
   ```typescript
   // Show holiday information to users
   const holidays = getHolidaysInRange(start, end)
   if (holidays.length > 0) {
     console.log(`Note: ${holidays.length} holiday(s) in this period`)
   }
   ```

4. **Verify Department Detection**
   ```typescript
   // Verify security staff are handled correctly
   if (isSecurityDept(userDept)) {
     // Use security-appropriate calculations
   }
   ```

---

## Troubleshooting

**Q: Attendance seems too high/low?**
- Check if department info is being passed correctly
- Verify holidays are not being double-counted

**Q: Security staff working days incorrect?**
- Confirm `isSecurityDept()` is correctly identifying the department
- Check department code/name spelling

**Q: Need to add new holidays?**
- Edit `GHANA_HOLIDAYS_2026` array in `lib/attendance-utils.ts`
- Format: `{ date: "YYYY-MM-DD", name: "Holiday Name" }`

---

**Last Updated:** April 13, 2026
**Version:** 1.0
