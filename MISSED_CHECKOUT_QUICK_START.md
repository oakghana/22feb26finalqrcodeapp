# Missed Checkout Warning - Quick Start Guide

## What Happens

**User checks in but forgets to check out**
→ **Next day they log in**
→ **See this warning banner on their dashboard:**

```
┌─────────────────────────────────────────────────────┐
│ ⚠️  Incomplete Check-out                          [X]│
│                                                      │
│ You did not check out on Friday, April 11, 2026    │
│ before 11:59 PM. Your check-in was recorded at     │
│ 5:00 PM.                                            │
│                                                      │
│ Please remember to check out before the end of     │
│ each day to maintain accurate attendance records.   │
└─────────────────────────────────────────────────────┘
```

## Testing It Out

### Step 1: Create an Incomplete Record
1. Log in as a test user
2. Check in (tap "Check In" on dashboard)
3. Do NOT check out
4. Go to bed 😴

### Step 2: Next Day - See the Warning
1. Log back in the next day
2. Go to `/dashboard/overview`
3. Warning banner appears at top
4. See your check-in time displayed

### Step 3: Dismiss It
1. Click the X button on banner
2. Banner disappears
3. You can continue working

## How It Actually Works (Technical)

### Behind the Scenes

When you load the dashboard page:

```
page.tsx (Server Component)
├─ Gets current user
├─ Looks at yesterday's attendance records
├─ Finds records with check_in_time but NO check_out_time
├─ If found: Creates warning object
└─ Passes to DashboardOverviewClient

DashboardOverviewClient (Client Component)
├─ Receives warning prop
├─ If warning exists:
│  └─ Renders <MissedCheckoutWarningBanner />
└─ Otherwise: No banner shown
```

### Key Query

```typescript
// Find unfinished attendance from yesterday
const unfinishedRecords = await supabase
  .from("attendance_records")
  .select("id, check_in_time, check_out_time")
  .eq("user_id", user.id)                    // Only current user
  .gte("created_at", yesterdayStart)         // Yesterday's date
  .lte("created_at", yesterdayEnd)           // Yesterday's date
  .is("check_out_time", null)                // NO check-out
  .limit(1)
```

## Files Changed

| File | Change | Why |
|------|--------|-----|
| `dashboard-overview-client.tsx` | Added banner import & component | Display warning |
| `page.tsx` (dashboard/overview) | Added yesterday attendance check | Detect missed checkout |
| `missed-checkout-warning-banner.tsx` | NEW component | Show the warning |

## Component Breakdown

### MissedCheckoutWarningBanner Component

**Location:** `components/notifications/missed-checkout-warning-banner.tsx`

**Props:**
```typescript
{
  warning: {
    type: "no_checkout",
    date: "2026-04-11",           // Yesterday's date
    message: "You did not check out yesterday...",
    missedCheckInTime: "2026-04-11T17:00:00"  // 5:00 PM
  },
  onDismiss?: (id?) => void  // Optional dismiss callback
}
```

**Features:**
- Shows date in readable format (e.g., "Friday, April 11, 2026")
- Shows check-in time in local timezone
- Amber/warning color scheme
- Dismissible X button
- Responsive on mobile
- Shows icon (AlertCircle)

### Dashboard Integration

**Location:** `app/dashboard/overview/dashboard-overview-client.tsx`

**Change:**
```typescript
// Added prop
missedCheckoutWarning?: MissedCheckoutWarning | null

// Added in JSX (near top)
{missedCheckoutWarning && (
  <MissedCheckoutWarningBanner warning={missedCheckoutWarning} />
)}
```

### Server-Side Detection

**Location:** `app/dashboard/overview/page.tsx`

**Change:**
```typescript
// Check for yesterday's unfinished records
const yesterday = new Date()
yesterday.setDate(yesterday.getDate() - 1)

const { data: unfinishedRecords } = await supabase
  .from("attendance_records")
  .select("id, check_in_time, check_out_time, created_at")
  .eq("user_id", user.id)
  .gte("created_at", yesterdayStart.toISOString())
  .lte("created_at", yesterdayEnd.toISOString())
  .is("check_out_time", null)
  .limit(1)

// Create warning if found
if (unfinishedRecords && unfinishedRecords.length > 0) {
  missedCheckoutWarning = {
    type: "no_checkout",
    date: yesterday.toISOString().split("T")[0],
    message: "You did not check out yesterday before 11:59 PM",
    missedCheckInTime: unfinishedRecords[0].check_in_time,
  }
}
```

## Styling Details

Banner uses Tailwind CSS classes:

```css
bg-amber-50              /* Light amber background */
border-l-4 border-amber-400  /* Left accent stripe */
rounded-sm               /* Slightly rounded corners */
p-4                      /* Padding */
mb-6                     /* Margin bottom (space from next item) */

/* Text colors */
text-amber-900          /* Dark text */
text-amber-800          /* Lighter text */
text-amber-600          /* Close button hover */
text-amber-700          /* Additional text */

/* Icon */
AlertCircle w-5 h-5     /* Warning icon */
```

## Visual Layout

```
┌─ flex items-start justify-between ──┐
│                                     │
│ ┌─ AlertCircle icon (5x5)          │
│ │                                  │
│ ├─ Text content (flex-1)            │
│ │  ├─ Title                        │
│ │  ├─ Main message                 │
│ │  └─ Helper text                  │
│ │                                  │
│ └─ Close button (X)                │
└─────────────────────────────────────┘
```

## Common Questions

**Q: What if they check out today?**
A: The warning won't show tomorrow (record will have check_out_time).

**Q: What if they check out after midnight?**
A: The attendance system handles this - check-out time is recorded even if after midnight.

**Q: Can they dismiss it permanently?**
A: Currently it dismisses UI-only. Next load will show again. (Future: persistent dismissal)

**Q: Does this affect attendance percentage?**
A: No, only shows warning. Attendance percentage isn't changed.

**Q: What about time zones?**
A: Uses server time (UTC in database), so consistent across all time zones.

## Troubleshooting

### Banner not showing?
1. Create test unfinished attendance record
2. Verify `check_out_time` is NULL in database
3. Clear browser cache
4. Check console for errors

### Wrong time displayed?
1. Verify check_in_time in database
2. Check if it's being converted correctly
3. Verify user's timezone settings

### Banner showing wrong date?
1. Check database created_at timestamp
2. Verify date range calculation (yesterday)
3. Check for timezone issues

## Next Steps

1. **Test it**: Follow testing steps above
2. **Deploy**: Push to production when ready
3. **Monitor**: Watch for any issues
4. **Enhance**: Consider future features (see documentation)

## Documentation Files

- `MISSED_CHECKOUT_WARNING_SYSTEM.md` - Full technical docs
- `MISSED_CHECKOUT_IMPLEMENTATION_SUMMARY.md` - Implementation details
- This file - Quick reference

## Support

Issues? Check the documentation files or examine the component code:
- Banner component: See `components/notifications/missed-checkout-warning-banner.tsx`
- Integration: See `app/dashboard/overview/dashboard-overview-client.tsx`
- Detection logic: See `app/dashboard/overview/page.tsx`
