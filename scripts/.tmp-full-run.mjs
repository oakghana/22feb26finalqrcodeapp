// Temporary wrapper to set Supabase env vars and run the full attendance scanner.
process.env.SUPABASE_URL = 'https://vgtajtqxgczhjboatvol.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndGFqdHF4Z2N6aGpib2F0dm9sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njk3NTI0OCwiZXhwIjoyMDcyNTUxMjQ4fQ.x3by0hGUAO3GQcPs1_sla6gdGY8QuxcYiGmSRdj4-yA'

import('./check-attendance-reasons-full.mjs')
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Runner failed:', err)
    process.exit(1)
  })
