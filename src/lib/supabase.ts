import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** Shown on screen when the .env.local file is missing or incomplete. */
export const configError: string | null =
  !url || !key
    ? 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local, fill both in, then restart "npm run dev".'
    : null

// The placeholders only keep the app from crashing so it can show configError.
export const supabase = createClient<Database>(url || 'http://localhost:54321', key || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})
