export type DeptInfo = { code?: string | null; name?: string | null } | undefined | null

// Ghana public holidays for 2026
export const GHANA_HOLIDAYS_2026 = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-02-23", name: "Founder's Day" },
  { date: "2026-03-30", name: "Easter Monday" },
  { date: "2026-05-01", name: "Workers' Day" },
  { date: "2026-05-14", name: "Ascension Day" },
  { date: "2026-06-04", name: "Republic Day" },
  { date: "2026-07-01", name: "Id-ul-Adha" },
  { date: "2026-07-21", name: "Islamic New Year" },
  { date: "2026-09-21", name: "Founder's Day" },
  { date: "2026-09-29", name: "Founders' Day (Observation)" },
  { date: "2026-10-25", name: "Eid-ul-Mawlid" },
  { date: "2026-12-25", name: "Christmas Day" },
  { date: "2026-12-26", name: "Boxing Day" },
]

export function isWeekend(date: Date = new Date()): boolean {
  const d = date.getDay()
  return d === 0 || d === 6
}

export function isHoliday(date: Date): boolean {
  const dateStr = date.toISOString().split("T")[0] // Format: YYYY-MM-DD
  return GHANA_HOLIDAYS_2026.some((holiday) => holiday.date === dateStr)
}

export function isWorkingDay(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date)
}

export function isSecurityDept(dept?: DeptInfo): boolean {
  if (!dept) return false
  const code = (dept.code || "").toString().toLowerCase()
  const name = (dept.name || "").toString().toLowerCase()
  return code === "security" || name.includes("security")
}

export function isResearchDept(dept?: DeptInfo): boolean {
  if (!dept) return false
  const code = (dept.code || "").toString().toLowerCase()
  const name = (dept.name || "").toString().toLowerCase()
  return code === "research" || name.includes("research")
}

export function isOperationalDept(dept?: DeptInfo): boolean {
  if (!dept) return false
  const code = (dept.code || "").toString().toLowerCase()
  const name = (dept.name || "").toString().toLowerCase()
  return code === "operations" || code === "operational" || name.includes("operations") || name.includes("operational")
}

export function isTransportDept(dept?: DeptInfo): boolean {
  if (!dept) return false
  const code = (dept.code || "").toString().toLowerCase()
  const name = (dept.name || "").toString().toLowerCase()
  return code === "transport" || name.includes("transport")
}

export function isExemptFromTimeRestrictions(dept?: DeptInfo, role?: string | null): boolean {
  if (!dept && !role) return false
  // Operational, Security and Transport departments are exempt from time restrictions
  if (isOperationalDept(dept)) return true
  if (isSecurityDept(dept)) return true
  if (isTransportDept(dept)) return true
  // Admin, department/head and regional manager roles are also exempt
  const lowerRole = (role || "").toLowerCase()
  return lowerRole === "admin" || lowerRole === "department_head" || lowerRole === "regional_manager"
}

export function isExemptFromAttendanceReasons(role?: string | null): boolean {
  if (!role) return false
  const lowerRole = role.toLowerCase()
  return lowerRole === "department_head" || lowerRole === "regional_manager"
}

/**
 * Returns true when a lateness reason SHOULD be required.
 * - Requires reason only on weekdays (Mon-Fri)
 * - Security, Research, Operational, and Transport departments are exempt
 * - Admin, Department heads and regional managers are exempt
 */
export function requiresLatenessReason(date: Date = new Date(), dept?: DeptInfo, role?: string | null): boolean {
  if (isWeekend(date)) return false
  // Only Security and Transport departments are exempt
  if (isSecurityDept(dept)) return false
  if (isTransportDept(dept)) return false
  // Admin, department heads and regional managers are exempt
  const lowerRole = (role || "").toLowerCase()
  if (lowerRole === "admin" || lowerRole === "department_head" || lowerRole === "regional_manager") return false
  return true
}

/**
 * Returns true when an early-checkout reason should be enforced.
 * - Enforced only when location-level flag is true and it's not a weekend
 * - Only Security and Transport departments are exempt
 * - Admin, Department heads and regional managers are exempt
 */
export function requiresEarlyCheckoutReason(date: Date = new Date(), locationRequires: boolean = true, role?: string | null, dept?: DeptInfo): boolean {
  if (!locationRequires) return false
  if (isWeekend(date)) return false
  // Only Security and Transport departments are exempt
  if (isSecurityDept(dept)) return false
  if (isTransportDept(dept)) return false
  // Admin, department heads and regional managers are exempt
  const lowerRole = (role || "").toLowerCase()
  if (lowerRole === "admin" || lowerRole === "department_head" || lowerRole === "regional_manager") return false
  return true
}

/**
 * Check if check-in time is allowed
 * - Weekends: no time restrictions
 * - Admins, Regional Managers, Department Heads: can check in anytime
 * - Regular staff: can only check in before 3 PM (15:00)
 * - Operational and Security departments: can check in anytime
 */
export function canCheckInAtTime(date: Date = new Date(), dept?: DeptInfo, role?: string | null): boolean {
  // No restrictions on weekends
  if (isWeekend(date)) return true
  // Exempt roles can check in anytime
  if (isExemptFromTimeRestrictions(dept, role)) return true
  const hours = date.getHours()
  return hours < 15 // Allow check-in only before 3 PM for regular staff
}

/**
 * Check if check-out time is allowed (before 5:40 PM / 17:40)
 * - Weekends: no time restrictions
 * - Admin, Department Heads, Regional Managers: exempt
 * - Operational, Security, and Transport departments are exempt
 * - Regular staff: can only check out before 5:40 PM
 */
export function canCheckOutAtTime(date: Date = new Date(), dept?: DeptInfo, role?: string | null): boolean {
  // No restrictions on weekends
  if (isWeekend(date)) return true
  if (isExemptFromTimeRestrictions(dept, role)) return true
  const hours = date.getHours()
  const minutes = date.getMinutes()
  // Allow check-out only before 5:40 PM (17:40)
  return hours < 17 || (hours === 17 && minutes < 40)
}

/**
 * Get check-in deadline time (3 PM for regular staff, anytime for admins/managers)
 */
export function getCheckInDeadline(): string {
  return "3:00 PM"
}

/**
 * Get check-out deadline time (5:40 PM)
 */
export function getCheckOutDeadline(): string {
  return "5:40 PM"
}

// -----------------------------------------------------------------------------
// New helpers for exemptions and restriction information
// -----------------------------------------------------------------------------

export type Exemption = {
  type: string
  message: string
}

export type Restriction = {
  type: string
  message: string
}

/**
 * Returns an object containing arrays of exemptions and restrictions
 * based on department/role/date.  This will power the pre-check-in banner.
 */
export function getStaffRestrictions(dept?: DeptInfo, role?: string | null, date: Date = new Date()): {
  exemptions: Exemption[]
  restrictions: Restriction[]
  canCheckIn: boolean
  canCheckOut: boolean
  deadlines: { checkIn: string; checkOut: string }
} {
  const exemptions: Exemption[] = []
  const restrictions: Restriction[] = []

  if (isExemptFromTimeRestrictions(dept, role)) {
    exemptions.push({ type: "time_restriction", message: "Your department is exempt from time restrictions" })
  } else {
    restrictions.push({
      type: "time_restriction",
      message: `Check-in is only allowed before ${getCheckInDeadline()}. Check-out is only allowed before ${getCheckOutDeadline()}.`,
    })
  }

  if (requiresLatenessReason(date, dept, role)) {
    restrictions.push({ type: "lateness_reason", message: "Lateness reason is required for late check-ins" })
  }

  // location requirement is handled elsewhere; caller can supply a message if needed
  // the banner component will evaluate assigned location and GPS state

  return {
    exemptions,
    restrictions,
    canCheckIn: canCheckInAtTime(date, dept, role),
    canCheckOut: canCheckOutAtTime(date, dept, role),
    deadlines: { checkIn: getCheckInDeadline(), checkOut: getCheckOutDeadline() },
  }
}

/**
 * Return a description string suitable for display given an exemption type.
 */
export function getExemptionDescription(exemptionType: string): string {
  switch (exemptionType) {
    case "time_restriction":
      return "No time limits for attendance."
    case "lateness_reason":
      return "You are not required to provide reasons for being late."
    default:
      return "Exemption granted."
  }
}

/**
 * Return a localized explanation for a given restriction type.
 */
export function getRestrictionReason(restrictionType: string, dept?: DeptInfo, role?: string | null): string {
  switch (restrictionType) {
    case "time_restriction":
      return `Attendance is only allowed before ${getCheckInDeadline()} for your current role/department.`
    case "lateness_reason":
      return `You must provide a reason when checking in after 9:00 AM.`
    case "location_required":
      return `You must be physically present at your assigned location to check in.`
    default:
      return "A restriction applies to your attendance action."
  }
}

// ============================================================================
// NEW: Comprehensive Working Days Calculation Functions
// ============================================================================

/**
 * Calculate the number of working days between two dates.
 * Working days exclude weekends (Sat, Sun) and public holidays.
 * Security staff work 24/7 so all days count as working days for them.
 *
 * @param startDate - The start date (inclusive)
 * @param endDate - The end date (inclusive)
 * @param deptInfo - Department info to check if staff is exempt (e.g., Security)
 * @returns Number of working days
 */
export function calculateWorkingDays(startDate: Date, endDate: Date, deptInfo?: DeptInfo): number {
  // Security staff work all days (weekends, holidays, etc.)
  if (isSecurityDept(deptInfo)) {
    const timeDiff = endDate.getTime() - startDate.getTime()
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1 // +1 to include both start and end dates
  }

  // For regular staff, only count Mon-Fri excluding holidays
  let workingDaysCount = 0
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    if (isWorkingDay(currentDate)) {
      workingDaysCount++
    }
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return workingDaysCount
}

/**
 * Calculate expected attendance (total staff-days expected to be present).
 * For security staff: all employees work all days
 * For regular staff: only count working days (Mon-Fri, excluding holidays)
 *
 * @param startDate - The start date
 * @param endDate - The end date
 * @param totalEmployees - Total number of employees in the group/department
 * @param deptInfo - Department info to check if staff is exempt
 * @returns Expected number of staff-days
 */
export function calculateExpectedAttendance(startDate: Date, endDate: Date, totalEmployees: number = 0, deptInfo?: DeptInfo): number {
  const workingDays = calculateWorkingDays(startDate, endDate, deptInfo)
  return totalEmployees * workingDays
}

/**
 * Calculate attendance percentage based on actual vs expected attendance.
 * Properly accounts for weekends, holidays, and department exemptions.
 *
 * @param actualAttendance - Number of actual attendance records
 * @param startDate - The start date of the period
 * @param endDate - The end date of the period
 * @param totalEmployees - Total number of employees
 * @param deptInfo - Department info for exemptions
 * @returns Attendance percentage (0-100)
 */
export function calculateAttendancePercentage(
  actualAttendance: number,
  startDate: Date,
  endDate: Date,
  totalEmployees: number = 0,
  deptInfo?: DeptInfo,
): number {
  const expectedAttendance = calculateExpectedAttendance(startDate, endDate, totalEmployees, deptInfo)

  if (expectedAttendance === 0) return 0

  const percentage = (actualAttendance / expectedAttendance) * 100
  return Math.min(100, Math.max(0, Math.round(percentage * 100) / 100)) // Round to 2 decimal places
}

/**
 * Get working days breakdown for a date range.
 * Returns detailed info about weekdays, weekends, holidays, and total working days.
 *
 * @param startDate - The start date
 * @param endDate - The end date
 * @returns Breakdown object with counts
 */
export function getWorkingDaysBreakdown(startDate: Date, endDate: Date) {
  let weekdays = 0
  let weekends = 0
  let holidays = 0
  let totalDays = 0

  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    totalDays++

    if (isHoliday(currentDate)) {
      holidays++
    } else if (isWeekend(currentDate)) {
      weekends++
    } else {
      weekdays++
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return {
    totalDays,
    weekdays, // Actual working days (excluding holidays)
    weekends,
    holidays,
    workingDays: weekdays, // Alias for clarity
    totalCalendarDays: totalDays,
  }
}

/**
 * Check if a date range contains any holidays.
 */
export function hasHolidaysInRange(startDate: Date, endDate: Date): boolean {
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    if (isHoliday(currentDate)) {
      return true
    }
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return false
}

/**
 * Get all holidays within a date range.
 */
export function getHolidaysInRange(startDate: Date, endDate: Date) {
  const holidaysInRange = []
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split("T")[0]
    const holiday = GHANA_HOLIDAYS_2026.find((h) => h.date === dateStr)

    if (holiday) {
      holidaysInRange.push({
        ...holiday,
        dateObj: new Date(currentDate),
      })
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return holidaysInRange
}
