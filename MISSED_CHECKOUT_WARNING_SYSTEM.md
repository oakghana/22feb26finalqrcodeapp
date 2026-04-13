# Missed Checkout Warning System

## Overview

The Missed Checkout Warning System automatically detects when a user fails to check out before 11:59 PM and displays a prominent warning banner when they log in the next day.

## How It Works

### 1. Detection Flow

When a user logs into the dashboard (visits `/dashboard/overview`):

1. **Server-side check** (`app/dashboard/overview/page.tsx`):
   - Queries yesterday's attendance records
   - Looks for records with `check_in_time` populated but `check_out_time` as NULL
   - If found, creates a warning object with details

2. **Client-side display** (`DashboardOverviewClient`):
   - Receives the warning object as a prop
   - Renders `MissedCheckoutWarningBanner` component if warning exists
   - User can dismiss the banner

### 2. Components

#### `app/dashboard/overview/page.tsx` (Server Component)
- Fetches yesterday's unfinished attendance records
- Passes warning to client component

```typescript
// Detects unfinished attendance from yesterday
const { data: unfinishedRecords } = await supabase
  .from("attendance_records")
  .select("id, check_in_time, check_out_time, created_at")
  .eq("user_id", user.id)
  .gte("created_at", yesterdayStart.toISOString())
  .lte("created_at", yesterdayEnd.toISOString())
  .is("check_out_time", null)
  .limit(1)
```

#### `components/notifications/missed-checkout-warning-banner.tsx`
- Displays dismissible warning banner
- Shows check-in time and missed checkout date
- Uses amber/warning color scheme
- Friendly reminder about checkout requirements

**Features:**
- Non-blocking (user can continue with their day)
- Dismissible with X button
- Displays check-in time and date
- Mobile responsive
- Clear messaging about checkout importance

#### `app/dashboard/overview/dashboard-overview-client.tsx`
- Integrates the warning banner into dashboard
- Positioned at top of page (after welcome greeting)
- Props passed from server component

### 3. Data Flow

```
User logs in
    ↓
Page.tsx Server Component loads
    ↓
Check yesterday's attendance records
    ↓
Is there an unfinished record (no check_out)?
    ├─ YES → Create warning object
    │         Pass to DashboardOverviewClient
    │         ↓
    │         Banner displays at top
    │         User can dismiss
    │
    └─ NO → Pass null warning
             No banner shown
```

## Implementation Details

### Timing

- **Check-out deadline**: 11:59 PM (23:59)
- **Warning trigger**: Next day login (any time after midnight)
- **Detection scope**: Only yesterday's incomplete records

### Warning Lifecycle

1. **Created**: When page loads and finds incomplete record
2. **Displayed**: In amber/warning color at top of dashboard
3. **Dismissed**: User clicks X button (state only, not persisted)
4. **Next day**: Fresh page load checks again

### Queries Used

```sql
-- Find unfinished attendance records from yesterday
SELECT id, check_in_time, check_out_time, created_at
FROM attendance_records
WHERE user_id = $1
  AND created_at >= $2  -- yesterday start
  AND created_at <= $3  -- yesterday end
  AND check_out_time IS NULL
LIMIT 1
```

## Styling

The warning banner uses:
- **Background**: `bg-amber-50` (light amber)
- **Border**: `border-l-4 border-amber-400` (left accent)
- **Icon**: `AlertCircle` from lucide-react
- **Text**: `text-amber-900` and `text-amber-800`
- **Close button**: `text-amber-600` with hover effects

## Testing

### Manual Testing Steps

1. **Create incomplete attendance**:
   - Check in today at any time
   - Do NOT check out
   - Wait until next day (or change system date in dev)

2. **Verify warning**:
   - Log out
   - Log back in
   - Warning banner should appear at top of dashboard
   - Shows correct check-in time and date

3. **Test dismissal**:
   - Click X button on banner
   - Banner disappears
   - Refresh page (warning reappears since not persisted)

### Automated Testing

Test file location: (to be added)

```typescript
// Example test
test('should show missed checkout warning', () => {
  // Setup unfinished record from yesterday
  // Render DashboardOverviewClient with warning prop
  // Expect banner to be visible
  // Check message content
})
```

## Future Enhancements

1. **Persistent dismissal**: Store dismissal in database (per user per date)
2. **Auto-checkout**: Allow admin to auto-checkout user with confirmation
3. **Analytics**: Track missed checkout trends
4. **Notifications**: Send email/SMS before 11:59 PM deadline
5. **Warning severity**: Escalate to manager if repeated
6. **Bulk actions**: Admin dashboard to view all missed checkouts

## Troubleshooting

### Warning not showing

1. Verify unfinished record exists in DB:
```sql
SELECT * FROM attendance_records
WHERE user_id = 'user_id'
  AND check_out_time IS NULL
  AND created_at::date = CURRENT_DATE - 1
```

2. Check time zones - ensure dates are being compared correctly

3. Verify user is checking in before 11:59 PM (not late at night on same day)

### Warning showing for wrong date

- Usually a time zone issue
- Check if `created_at` is in UTC while comparison is in local time
- Verify PostgreSQL time zone settings

## File Locations

- Server logic: `app/dashboard/overview/page.tsx`
- Client logic: `app/dashboard/overview/dashboard-overview-client.tsx`
- Component: `components/notifications/missed-checkout-warning-banner.tsx`
- API route (future): `app/api/attendance/check-missed-checkout/route.ts` (optional, for standalone checks)

## Related Features

- **Staff Warnings System**: `scripts/026_create_staff_warnings_system.sql`
- **Attendance Records**: `app/api/attendance/check-in/route.ts`, `check-out/route.ts`
- **Dashboard**: `app/dashboard/overview/page.tsx`
