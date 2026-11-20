import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment')
}

/**
 * Standard Authenticated Supabase Client
 * Authenticates users using Supabase Auth JWTs. All queries respect Row-Level Security (RLS)
 * where authenticated admins have verified access via the server-side is_admin() function.
 *
 * NOTE: Service role keys must NEVER be bundled into client-side code.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'ewumate_admin_auth',
  }
})

/**
 * Backward compatibility alias for supabaseAdmin:
 * Points directly to the authenticated client with admin session JWT.
 * Server-side operations requiring superuser privileges must be executed via
 * Supabase Edge Functions with Bearer token authentication.
 */
export const supabaseAdmin = supabase
