import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function run() {
  const days = parseInt(process.argv[2], 10) || 30
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days)

  const startISO = start.toISOString()
  const endISO = end.toISOString()

  console.log(`Checking attendance reasons from ${startISO} to ${endISO}`)

  const { data: records, error } = await supabase
    .from('attendance_records')
    .select('id,user_id,check_in_time,check_out_time,lateness_reason,early_checkout_reason')
    .gte('check_in_time', startISO)
    .lte('check_in_time', endISO)
    .order('check_in_time', { ascending: false })
    .limit(5000)

  if (error) {
    console.error('Failed to fetch attendance_records:', error.message)
    process.exit(1)
  }

  console.log('Fetched', records.length, 'attendance rows')

  const userIds = [...new Set(records.map(r => r.user_id).filter(Boolean))]
  console.log('Unique user_ids in range:', userIds.length)

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, first_name, last_name, employee_id, department_id')
    .in('id', userIds)

  const profileMap = new Map((profiles || []).map(p => [p.id, p]))

  const missing = []
  const withReasons = []

  for (const r of records) {
    const hasReason = r.lateness_reason || r.early_checkout_reason
    const profile = profileMap.get(r.user_id)
    if (!profile) missing.push(r)
    if (hasReason) withReasons.push({ record: r, profile })
  }

  console.log('\nMissing user_profiles count:', missing.length)
  if (missing.length > 0) {
    console.log('Sample missing records:')
    missing.slice(0, 20).forEach((m) => {
      console.log(` - id=${m.id} user_id=${m.user_id} lateness=${m.lateness_reason ? 'Y' : 'N'} early=${m.early_checkout_reason ? 'Y' : 'N'} time=${m.check_in_time}`)
    })
  }

  const missingWithReasons = withReasons.filter(w => !w.profile)
  console.log('\nRecords with reasons but missing profiles:', missingWithReasons.length)
  missingWithReasons.slice(0, 50).forEach((w) => {
    console.log(` - id=${w.record.id} user_id=${w.record.user_id} lateness=${w.record.lateness_reason || '-'} early=${w.record.early_checkout_reason || '-'} time=${w.record.check_in_time}`)
  })

  // Aggregate reason counts for missing profiles
  const reasonCounts = missingWithReasons.reduce((acc, w) => {
    const key = w.record.lateness_reason ? `late:${w.record.lateness_reason}` : (w.record.early_checkout_reason ? `early:${w.record.early_checkout_reason}` : 'none')
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  console.log('\nReason counts for missing-profile records:')
  console.table(reasonCounts)

  console.log('\nDone')
  // Force exit to avoid lingering handles on some Node/Windows environments
  process.exit(0)
}

run().catch(err => { console.error(err); process.exit(1) })
