import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jwygjihrbwxhehijldiz.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3eWdqaWhyYnd4aGVoaWpsZGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDQxNzQsImV4cCI6MjA4NjY4MDE3NH0.zQc3dq53HBpMeN0rbJA9soF0oYhl7de1_sNnB_9JPoM'

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
