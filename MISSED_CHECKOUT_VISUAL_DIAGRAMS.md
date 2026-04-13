# Missed Checkout Warning System - Visual Diagrams

## User Journey Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ MISSED CHECKOUT WARNING - USER JOURNEY                          │
└─────────────────────────────────────────────────────────────────┘

DAY 1 - EMPLOYEE
───────────────────
  9:00 AM
   │
   ├─→ Employee logs into system
   │
  12:00 PM
   │
   ├─→ "Check In" button appears on dashboard
   │
  12:05 PM
   │
   ├─→ Employee clicks "Check In"
   │
   └─→ Database: attendance_records
       ├─ user_id: emp123
       ├─ check_in_time: 2026-04-11 12:05:00
       ├─ check_out_time: NULL  ← UNFINISHED
       └─ created_at: 2026-04-11 12:05:00

  [Whole day passes...]

 11:55 PM
   │
   └─→ Employee is busy, forgets to check out 😬


DAY 2 - EMPLOYEE (NEXT DAY)
──────────────────────────
  9:00 AM
   │
   ├─→ Employee logs in again
   │
   ├─→ Browser: GET /dashboard/overview
   │
   └─→ Server (page.tsx) EXECUTES:
       ├─ Get current user: emp123
       ├─ Calculate yesterday: 2026-04-11
       ├─ Query attendance_records:
       │  WHERE user_id = 'emp123'
       │    AND created_at >= 2026-04-11 00:00:00
       │    AND created_at <= 2026-04-11 23:59:59
       │    AND check_out_time IS NULL
       │  LIMIT 1
       │
       └─→ FOUND: The record from yesterday! ✓
           └─→ Create warning object:
               {
                 type: "no_checkout",
                 date: "2026-04-11",
                 message: "You did not check out yesterday...",
                 missedCheckInTime: "2026-04-11T12:05:00"
               }

   ├─→ Pass warning to DashboardOverviewClient
   │
   ├─→ DashboardOverviewClient renders:
   │   <MissedCheckoutWarningBanner warning={warning} />
   │
   └─→ Browser displays:
       ┌──────────────────────────────────────────────┐
       │ ⚠️  Incomplete Check-out                  [X] │
       │                                              │
       │ You did not check out on Saturday,           │
       │ April 11, 2026 before 11:59 PM.              │
       │ Your check-in was recorded at 12:05 PM.      │
       │                                              │
       │ Please remember to check out...              │
       └──────────────────────────────────────────────┘

  Employee Options:
  ├─ Click X → Dismiss banner (UI only)
  │  Next refresh: Warning reappears
  │
  └─ Check out now → Completes yesterday's record
     check_out_time: 2026-04-12 09:05:00
     Next day: No warning
```

## System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    MISSED CHECKOUT WARNING SYSTEM                │
└──────────────────────────────────────────────────────────────────┘

                          User Logs In
                              │
                              ▼
                    ┌─────────────────┐
                    │ Browser: React  │
                    └────────┬────────┘
                             │
                    GET /dashboard/overview
                             │
                             ▼
        ┌────────────────────────────────────────┐
        │  app/dashboard/overview/page.tsx       │
        │  (Server Component - RSC)              │
        │                                        │
        │  1. Get current user from auth         │
        │  2. Get user profile & today data      │
        │  3. ⭐ CHECK YESTERDAY'S RECORDS       │
        │     - Calculate yesterday date         │
        │     - Query attendance_records table   │
        │     - Look for: check_in but no        │
        │       check_out from yesterday         │
        │     - If found: create warning object  │
        │  4. Pass warning to client component   │
        └────────────────┬───────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │  Database: attendance_records          │
        │                                        │
        │  SELECT check_in_time, check_out_time │
        │  WHERE user_id = 'emp123'              │
        │    AND created_at BETWEEN yesterday    │
        │    AND check_out_time IS NULL          │
        │                                        │
        │  Result: Unfinished record found ✓     │
        └────────────────┬───────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │ DashboardOverviewClient (Client)       │
        │                                        │
        │ Props:                                 │
        │ - user                                 │
        │ - profile                              │
        │ - todayAttendance                      │
        │ - monthlyAttendance                    │
        │ - pendingApprovals                     │
        │ - missedCheckoutWarning ⭐             │
        │                                        │
        │ Logic:                                 │
        │ if (missedCheckoutWarning) {           │
        │   <MissedCheckoutWarningBanner />      │
        │ }                                      │
        └────────────────┬───────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │ MissedCheckoutWarningBanner Component  │
        │                                        │
        │ Props:                                 │
        │ - warning object                       │
        │ - onDismiss callback                   │
        │                                        │
        │ Renders:                               │
        │ ┌──────────────────────────────────┐  │
        │ │ ⚠️  Incomplete Check-out     [X] │  │
        │ │                                  │  │
        │ │ Details with times & dates...   │  │
        │ └──────────────────────────────────┘  │
        │                                        │
        │ Styling:                               │
        │ - Amber background (warning color)    │
        │ - Left border accent                  │
        │ - AlertCircle icon                    │
        │ - Dismissible X button                │
        └────────────────┬───────────────────────┘
                         │
                         ▼
              Browser displays to user
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│              DATA FLOW SEQUENCE                      │
└─────────────────────────────────────────────────────┘

USER LOGIN
   │
   ▼ (1) Navigate to dashboard
┌─────────────────────────────────────┐
│ Next.js App Router                  │
│ Route: /dashboard/overview          │
│ File: page.tsx (Server Component)   │
└──────────────┬──────────────────────┘
               │
               ▼ (2) Get current user
            ┌────────────────┐
            │ Supabase Auth  │
            │ user: emp123   │
            └────────┬───────┘
                     │
                     ▼ (3) Get user profile
                  ┌─────────────┐
                  │ Supabase    │
                  │ user_profiles│
                  │ departments  │
                  └────────┬────┘
                           │
                           ▼ (4) Get today's attendance
                        ┌─────────────────┐
                        │ attendance_records
                        │ (today only)     │
                        └────────┬────────┘
                                 │
                ┌────────────────┴─────────────────┐
                │                                  │
                ▼ (5) ⭐ GET YESTERDAY'S RECORDS   │
            ┌────────────────────────────┐
            │ attendance_records         │
            │                            │
            │ WHERE user_id = 'emp123'   │
            │  AND created_at = YESTERDAY│
            │  AND check_out_time IS NULL│
            │  LIMIT 1                   │
            │                            │
            │ Result:                    │
            │ - Found record with        │
            │   check_in but no checkout │
            │   ✓ Create warning object  │
            └──────────┬─────────────────┘
                       │
                ▼ (6) Create warning object
            ┌────────────────────────────┐
            │ {                          │
            │   type: "no_checkout",     │
            │   date: "2026-04-11",      │
            │   message: "You did not... │
            │   missedCheckInTime: "..." │
            │ }                          │
            └──────────┬─────────────────┘
                       │
        ▼ (7) Pass to client component
     ┌──────────────────────────────┐
     │ DashboardOverviewClient      │
     │ (props.missedCheckoutWarning)│
     └──────────┬───────────────────┘
                │
     ▼ (8) Render warning banner
  ┌──────────────────────────┐
  │ MissedCheckoutWarning    │
  │ Banner Component         │
  │                          │
  │ ┌────────────────────┐   │
  │ │ ⚠️ Warning Banner  │   │
  │ │ "You did not       │   │
  │ │  check out..."     │   │
  │ │ [X dismiss]        │   │
  │ └────────────────────┘   │
  └──────────┬───────────────┘
             │
             ▼
        Browser (User Sees It!)
```

## Component Tree Diagram

```
┌──────────────────────────────────────────────────────┐
│           COMPONENT HIERARCHY                        │
└──────────────────────────────────────────────────────┘

app/dashboard/overview/page.tsx
│
│ (Server Component - RSC)
│ ├─ Fetches data from Supabase
│ ├─ Checks for missed checkout
│ └─ Passes props down
│
└─→ DashboardOverviewClient
    │
    │ (Client Component - "use client")
    │ ├─ Receives props including missedCheckoutWarning
    │ ├─ State management
    │ └─ Renders:
    │
    ├─→ PWAInstallToast
    │   └─ Shows PWA install prompt
    │
    ├─→ ⭐ MissedCheckoutWarningBanner (Conditional)
    │   │
    │   │ Props:
    │   │ - warning: {
    │   │     type, date, message, 
    │   │     missedCheckInTime
    │   │   }
    │   │ - onDismiss: callback
    │   │
    │   ├─ Internal state:
    │   │  └─ isVisible (toggled by X button)
    │   │
    │   └─ Renders:
    │      ├─ Container div (amber-50 bg)
    │      ├─ AlertCircle icon
    │      ├─ Text content
    │      │  ├─ Title
    │      │  ├─ Message
    │      │  └─ Helper text
    │      └─ Close button (X)
    │
    ├─→ StatsCard (Checked In Status)
    │
    ├─→ StatsCard (Monthly Attendance)
    │
    ├─→ StatsCard (Department)
    │
    ├─→ QuickActions
    │
    └─→ LeaveNotificationsCard
```

## Database Query Diagram

```
┌────────────────────────────────────────────────────┐
│     DATABASE QUERY FOR YESTERDAY'S RECORDS         │
└────────────────────────────────────────────────────┘

// Current day: 2026-04-12 (Saturday)
// Calculate yesterday: 2026-04-11 (Friday)

SELECT 
  id,
  check_in_time,      ← 2026-04-11 12:05:00
  check_out_time,     ← NULL (unfinished!)
  created_at
FROM 
  attendance_records
WHERE 
  user_id = 'emp123'                                  ← Current user
  AND created_at >= '2026-04-11 00:00:00'            ← Yesterday start
  AND created_at <= '2026-04-11 23:59:59'            ← Yesterday end
  AND check_out_time IS NULL                         ← No checkout
LIMIT 1                                               ← Only first one
;

RESULT:
┌─────┬─────────────────────┬────────────────┬────────────────────┐
│ id  │ check_in_time       │ check_out_time │ created_at         │
├─────┼─────────────────────┼────────────────┼────────────────────┤
│ 456 │ 2026-04-11 12:05:00 │ NULL           │ 2026-04-11 12:05:00│
└─────┴─────────────────────┴────────────────┴────────────────────┘

↓

WARNING OBJECT CREATED:
{
  type: "no_checkout",
  date: "2026-04-11",
  message: "You did not check out yesterday before 11:59 PM",
  missedCheckInTime: "2026-04-11T12:05:00"
}

↓

DISPLAYED TO USER IN BANNER:
- Type: Incomplete Check-out
- Message: "You did not check out yesterday before 11:59 PM"
- Checked in at: "12:05 PM" (formatted)
- Date: "Friday, April 11, 2026" (formatted)
```

## State Diagram

```
┌────────────────────────────────────────────────────┐
│         WARNING BANNER STATE TRANSITIONS           │
└────────────────────────────────────────────────────┘

                    Page Load
                       │
                       ▼
     ┌─────────────────────────────────┐
     │  Check yesterday's records      │
     │  for unfinished attendance      │
     └──────────┬──────────┬───────────┘
                │          │
         Found  │          │ Not Found
                ▼          ▼
         ┌────────────┐  ┌──────────────┐
         │  Warning  │  │  No Warning  │
         │  Object   │  │   (null)     │
         │ Created   │  └──────────────┘
         └────┬─────┘           │
              │                 │
              ▼                 ▼
         ┌────────────────────────────────┐
         │  DashboardOverviewClient       │
         │  Receives props                │
         └────────────┬───────────────────┘
                      │
         ┌────────────┴──────────────┐
         │                           │
         ▼ missedCheckoutWarning     ▼ missedCheckoutWarning
    warning object             is null/undefined
         │                           │
         ▼                           ▼
    RENDER BANNER          NO BANNER RENDERED
         │                           │
         ▼ (isVisible = true)        ▼
    ┌──────────────────┐        (Empty space)
    │  Banner shown    │
    │                  │
    │ [Banner UI]      │
    │                  │
    │      [X] dismiss │
    └────────┬─────────┘
             │
             ▼ User clicks X
         (isVisible = false)
             │
             ▼
    ┌──────────────────┐
    │  Banner hidden   │
    │                  │
    │  (UI dismissed)  │
    │                  │
    │  Page refresh→   │
    │  Warning returns │
    └──────────────────┘
```

## Timeline Diagram

```
┌─────────────────────────────────────────────────────┐
│              COMPLETE USER TIMELINE                  │
└─────────────────────────────────────────────────────┘

APRIL 11, 2026 (FRIDAY)
─────────────────────────────────────────────────────
  08:00 - Wake up
  09:00 - Arrive at work
  09:05 - Log into system → Check In ✓
         Record created: check_in_time = 09:05
  
  [Whole day of work...]
  
  17:00 - Busy with project
  17:30 - Another project
  18:00 - Meeting runs long
  
  [Still working...]
  
  23:00 - Close laptop, go home
  23:55 - Bedtime! (forgot to check out) ⚠️
         Record still open: check_out_time = NULL


APRIL 12, 2026 (SATURDAY)
─────────────────────────────────────────────────────
  08:00 - Wake up
  09:00 - Open laptop
  09:05 - Click login button
         ▼
       System queries database:
         "Is there an unfinished record from yesterday?"
         ▼
       "YES! Found:"
       - check_in: 09:05 on 2026-04-11
       - check_out: NULL (not done!)
         ▼
       Create warning object
       Pass to dashboard
         ▼
  09:06 - Dashboard loads
         ▼
    ┌─────────────────────────────────────┐
    │ ⚠️  Incomplete Check-out        [X] │
    │                                     │
    │ You did not check out on Friday,    │
    │ April 11, 2026 before 11:59 PM.     │
    │ Your check-in was recorded at       │
    │ 9:05 AM.                            │
    └─────────────────────────────────────┘
         ▼
  09:07 - User options:
         A) Click [X] → Dismiss (until next refresh)
         B) Scroll down and work
         C) Click check out now (completes yesterday)
         
  [If user does nothing...]
  
  NEXT DAY (APRIL 13):
  ─────────────────
  09:00 - Log in again
         ▼
         System checks again:
         "Is record still open from April 11?"
         "YES! Still no checkout"
         ▼
         WARNING SHOWS AGAIN ⚠️
```

These diagrams help visualize:
1. What happens when user forgets to checkout
2. How the system detects it
3. Component hierarchy
4. Data flow
5. State transitions
6. Real-world timeline
