# Ghana Server Time Implementation

## Overview
This implementation replaces device-dependent `new Date()` calls with authoritative **Ghana timezone (GMT/UTC+0)** server time. This prevents users from manipulating their device clock to fake check-ins/check-outs.

## Key Changes

### 1. Server-Time API Endpoint
**File**: `/app/api/server-time/route.ts`
- Returns Ghana server time (GMT/UTC+0) with no timezone offset
- Called by clients to get authoritative time
- No caching - always returns current server time
- Response format:
  ```json
  {
    "timestamp": "2024-04-23T14:30:00.000Z",
    "serverTime": 1713880200000,
    "timezone": "GMT"
  }
  ```

### 2. Server-Time Utility Library
**File**: `/lib/server-time.ts`
- **Server-side functions**:
  - `getGhanaServerTime()` - Returns Ghana time as Date object
  - `getGhanaServerTimeISO()` - Returns Ghana time as ISO string
- **Client-side functions**:
  - `syncServerTime()` - Fetches server time and calculates offset
  - `getGhanaTime()` - Returns adjusted time using offset
  - `getGhanaTimeISO()` - Returns adjusted time as ISO string
- **React hook**:
  - `useServerTime()` - Auto-syncs on mount, updates every second, resyncs every 5 minutes

### 3. Time Sync Provider
**File**: `/components/providers/time-sync-provider.tsx`
- Wraps the app at the root level
- Automatically syncs server time on app initialization
- Provides context for accessing sync status
- Handles errors and fallback behavior

### 4. Updated API Routes
All attendance check-in/check-out routes now use Ghana server time:
- `/app/api/attendance/check-in/route.ts`
- `/app/api/attendance/qr-checkin/route.ts`
- `/app/api/attendance/fast-check-in/route.ts`
- `/app/api/attendance/qr-checkout/route.ts`
- `/app/api/attendance/emergency-checkout/route.ts`

**Changes**:
- Import: `import { getGhanaServerTime, getGhanaServerTimeISO } from "@/lib/server-time"`
- Replace `new Date()` → `getGhanaServerTime()`
- Replace `new Date().toISOString()` → `getGhanaServerTimeISO()`
- All timestamps stored in database are Ghana time

### 5. Root Layout Integration
**File**: `/app/root-layout-client.tsx`
- Added `TimeSyncProvider` as top-level wrapper
- Ensures all child components have access to synced Ghana time

## How It Works

### Server-Side (API Routes)
1. API endpoints call `getGhanaServerTimeISO()` to get current Ghana time
2. This time is stored directly in the database
3. No client input needed for timestamps - server is always authoritative

### Client-Side (Apps & Components)
1. On app load, `TimeSyncProvider` calls `syncServerTime()`
2. Client fetches server time from `/api/server-time`
3. Client calculates time offset: `offset = serverTime - deviceTime`
4. For subsequent time checks, client applies offset: `adjustedTime = Date.now() + offset`
5. Every 5 minutes, client resyncs to account for drift

## Security Benefits

✅ **Prevents Clock Manipulation**: Users cannot fake check-ins by changing device time
✅ **Server Authority**: All timestamps originate from server, not client
✅ **Ghana-Specific**: All times are in Ghana timezone (GMT/UTC+0), eliminating timezone confusion
✅ **Periodic Resync**: Accounts for device clock drift over time
✅ **Graceful Fallback**: If sync fails, system still works but warns in logs

## Testing

### Manual Testing
1. Set device time to a different value
2. Attempt check-in/check-out
3. Verify that Ghana server time is used, not device time
4. Check database timestamps match Ghana time

### Verification
- Check `/api/server-time` directly: `curl http://localhost:3000/api/server-time`
- Check browser console logs for sync messages: `[v0] Server time synced...`
- Verify attendance_records table has Ghana timezone timestamps

## Deployment Notes

- No database schema changes required
- No migration scripts needed
- Environment: Works in any timezone; converts to Ghana time
- The system automatically handles DST (Ghana doesn't observe DST, but the code accounts for timezone changes)

## Usage Examples

### In API Routes
```typescript
import { getGhanaServerTime, getGhanaServerTimeISO } from "@/lib/server-time"

// Get time as Date object
const now = getGhanaServerTime()

// Get time as ISO string
const isoTime = getGhanaServerTimeISO()

// Store in database
await supabase.from("attendance_records").insert({
  check_in_time: getGhanaServerTimeISO(),
  // ... other fields
})
```

### In React Components
```typescript
import { useTimeSync } from "@/components/providers/time-sync-provider"

export function MyComponent() {
  const { isSynced, error, ghanaTime } = useTimeSync()

  if (!isSynced) return <div>Syncing time...</div>
  if (error) return <div>Error: {error}</div>

  return <div>Ghana Time: {ghanaTime.toLocaleTimeString()}</div>
}
```

## Files Modified

- ✅ `/lib/server-time.ts` - Created
- ✅ `/app/api/server-time/route.ts` - Created
- ✅ `/components/providers/time-sync-provider.tsx` - Created
- ✅ `/app/root-layout-client.tsx` - Updated
- ✅ `/app/api/attendance/check-in/route.ts` - Updated
- ✅ `/app/api/attendance/qr-checkin/route.ts` - Updated
- ✅ `/app/api/attendance/fast-check-in/route.ts` - Updated
- ✅ `/app/api/attendance/qr-checkout/route.ts` - Updated
- ✅ `/app/api/attendance/emergency-checkout/route.ts` - Updated

## Next Steps

1. Review all changes and test thoroughly
2. Monitor logs for any sync failures
3. Verify database contains Ghana timezone timestamps
4. Consider adding admin dashboard to view server-time endpoint health
