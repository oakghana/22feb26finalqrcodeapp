-- Create holidays table to track national and local holidays
-- This table will be used to exclude holidays from working days calculations

CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    country VARCHAR(50) DEFAULT 'Ghana',
    is_national BOOLEAN DEFAULT true,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, country)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_country_date ON public.holidays(country, date);
CREATE INDEX IF NOT EXISTS idx_holidays_is_active ON public.holidays(is_active);

-- Insert Ghana's public holidays for 2026
INSERT INTO public.holidays (name, date, country, is_national, description, is_active)
VALUES
    ('New Year Day', '2026-01-01', 'Ghana', true, 'New Year celebration', true),
    ('Epiphany', '2026-01-06', 'Ghana', false, 'Christian celebration', true),
    ('Independence Day', '2026-03-06', 'Ghana', true, 'Ghana Independence Anniversary', true),
    ('Good Friday', '2026-04-03', 'Ghana', true, 'Christian Easter celebration', true),
    ('Easter Monday', '2026-04-06', 'Ghana', true, 'Easter Monday celebration', true),
    ('Eid al-Fitr', '2026-04-12', 'Ghana', false, 'Islamic celebration (estimated)', true),
    ('Ghana Labor Day', '2026-05-01', 'Ghana', true, 'International Labour Day', true),
    ('Eid al-Adha', '2026-06-20', 'Ghana', false, 'Islamic celebration (estimated)', true),
    ('Nuzul Al-Quran', '2026-06-03', 'Ghana', false, 'Islamic celebration (estimated)', true),
    ('Founders Day', '2026-08-04', 'Ghana', true, 'Founders Day celebration', true),
    ('Kwame Nkrumah Memorial Day', '2026-09-21', 'Ghana', true, 'Nkrumah Memorial', true),
    ('Christmas Day', '2026-12-25', 'Ghana', true, 'Christmas celebration', true),
    ('Boxing Day', '2026-12-26', 'Ghana', true, 'Boxing Day celebration', true)
ON CONFLICT DO NOTHING;

-- Enable RLS on holidays table (allow everyone to read, only admin to modify)
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to holidays" ON public.holidays
    FOR SELECT USING (true);

CREATE POLICY "Allow admin to manage holidays" ON public.holidays
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
