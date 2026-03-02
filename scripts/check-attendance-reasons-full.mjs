import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function fetchProfilesForIds(ids) {
  const profiles = []
  const batchSize = 100
  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, employee_id, email, department_id')
      .in('id', chunk)
    if (error) {
      console.error('Warning: failed to fetch profile chunk:', error.message || error)
      continue
    }
    if (data) profiles.push(...data)
  }
  return profiles
}

async function run() {
  const days = parseInt(process.argv[2], 10) || 90
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days)

  const startISO = start.toISOString()
  const endISO = end.toISOString()

  console.log(`Full scan attendance reasons from ${startISO} to ${endISO}`)

  const pageSize = Number(process.env.PAGE_SIZE || process.argv[3]) || 500
  let offset = 0
  let totalFetched = 0
  const missingWithReasons = []

  while (true) {
    const startIndex = offset
    const endIndex = offset + pageSize - 1
    console.log(`Fetching records ${startIndex}..${endIndex}...`)
    const { data: records, error } = await supabase
      .from('attendance_records')
      .select('id,user_id,check_in_time,check_out_time,lateness_reason,early_checkout_reason,notes')
      .gte('check_in_time', startISO)
      .lte('check_in_time', endISO)
      .order('check_in_time', { ascending: false })
      .range(startIndex, endIndex)

    if (error) {
      console.error('Failed to fetch attendance_records:', error.message || error)
      process.exit(1)
    }

    if (!records || records.length === 0) {
      console.log('No more records returned for this range.')
      break
    }

    console.log('Fetched batch size:', records.length)
    totalFetched += records.length

    const userIds = [...new Set(records.map(r => r.user_id).filter(Boolean))]
    const profiles = await fetchProfilesForIds(userIds)
    const profileMap = new Map((profiles || []).map(p => [p.id, p]))

    for (const r of records) {
      const hasReason = r.lateness_reason || r.early_checkout_reason
      const profile = profileMap.get(r.user_id)
      if (!profile && hasReason) {
        missingWithReasons.push({
          id: r.id,
          user_id: r.user_id,
          check_in_time: r.check_in_time,
          check_out_time: r.check_out_time,
          lateness_reason: r.lateness_reason || '',
          early_checkout_reason: r.early_checkout_reason || '',
          notes: r.notes || '',
        })
      }
    }

    console.log('Missing-with-reasons so far:', missingWithReasons.length)
    if (records.length < pageSize) break
    offset += pageSize
  }

  console.log('\nTotal attendance rows scanned:', totalFetched)
  console.log('Records with reasons but missing profiles:', missingWithReasons.length)

  if (missingWithReasons.length > 0) {
    const outDir = path.join(process.cwd(), 'scripts', 'output')
    try { fs.mkdirSync(outDir, { recursive: true }) } catch {}
    const filePath = path.join(outDir, `missing_profiles_${Date.now()}.csv`)
    const header = 'id,user_id,check_in_time,check_out_time,lateness_reason,early_checkout_reason,notes\n'
    const rows = missingWithReasons.map(r => (
      `${r.id},${r.user_id},"${r.check_in_time}","${r.check_out_time || ''}","${(r.lateness_reason || '').replace(/"/g, '""')}","${(r.early_checkout_reason || '').replace(/"/g, '""')}","${(r.notes || '').replace(/"/g, '""')}"`
    ))
    fs.writeFileSync(filePath, header + rows.join('\n'), 'utf8')
    console.log('Wrote CSV with missing-profile records to', filePath)
  }

  console.log('\nDone')
  process.exit(0)
}

run().catch(err => { console.error(err); process.exit(1) })
