import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createHolidaysTable() {
  try {
    console.log('Creating holidays table...');
    
    // Create holidays table
    const { error: tableError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.holidays (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            holiday_date DATE NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            holiday_type VARCHAR(50) DEFAULT 'national' CHECK (holiday_type IN ('national', 'local', 'organizational')),
            region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (tableError) {
      console.error('Error creating holidays table:', tableError);
      return;
    }

    console.log('Successfully created holidays table');

    // Insert Ghana's 2026 public holidays
    const ghanaHolidays = [
      { date: '2026-01-01', name: 'New Year\'s Day', type: 'national' },
      { date: '2026-03-02', name: 'Independence Day', type: 'national' },
      { date: '2026-04-10', name: 'Good Friday', type: 'national' },
      { date: '2026-04-13', name: 'Easter Monday', type: 'national' },
      { date: '2026-05-01', name: 'Workers\' Day', type: 'national' },
      { date: '2026-05-14', name: 'Ascension Day', type: 'national' },
      { date: '2026-06-21', name: 'Eid-ul-Fitr (estimated)', type: 'national' },
      { date: '2026-06-22', name: 'Eid-ul-Fitr Holiday (estimated)', type: 'national' },
      { date: '2026-07-30', name: 'Eid-ul-Adha (estimated)', type: 'national' },
      { date: '2026-09-18', name: 'Founders\' Day', type: 'national' },
      { date: '2026-12-25', name: 'Christmas Day', type: 'national' },
      { date: '2026-12-26', name: 'Boxing Day', type: 'national' },
    ];

    console.log(`Inserting ${ghanaHolidays.length} Ghana public holidays...`);

    const { data, error: insertError } = await supabase
      .from('holidays')
      .insert(
        ghanaHolidays.map(h => ({
          holiday_date: h.date,
          name: h.name,
          holiday_type: h.type,
          is_active: true
        }))
      );

    if (insertError) {
      console.error('Error inserting holidays:', insertError);
      return;
    }

    console.log('Successfully inserted Ghana public holidays for 2026');
    console.log('Holidays table setup complete!');

  } catch (error) {
    console.error('Error setting up holidays table:', error);
    process.exit(1);
  }
}

createHolidaysTable();
