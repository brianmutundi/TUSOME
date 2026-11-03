import { createClient } from '@supabase/supabase-js';

export interface ServerSchoolProfile {
  name: string;
  logo_url: string | null;
  motto: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  county: string | null;
  region: string | null;
  country: string | null;
  watermark_url: string | null;
}

export async function loadSchoolProfile(accessToken: string): Promise<ServerSchoolProfile | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await client.rpc('get_school_profile');
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    name: String(row.name ?? ''),
    logo_url: row.logo_url ? String(row.logo_url) : null,
    motto: row.motto ? String(row.motto) : null,
    contact_person: row.contact_person ? String(row.contact_person) : null,
    contact_phone: row.contact_phone ? String(row.contact_phone) : null,
    contact_email: row.contact_email ? String(row.contact_email) : null,
    county: row.county ? String(row.county) : null,
    region: row.region ? String(row.region) : null,
    country: row.country ? String(row.country) : null,
    watermark_url: row.watermark_url ? String(row.watermark_url) : null,
  };
}