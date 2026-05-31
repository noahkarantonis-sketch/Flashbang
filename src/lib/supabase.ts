import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// True once the project is actually configured (not the placeholder .env).
export const supabaseConfigured =
  !!url && !!anon && !url.includes('YOUR-PROJECT') && !anon.includes('YOUR-ANON')

export const supabase = createClient(url || 'http://localhost', anon || 'anon', {
  auth: { persistSession: true, autoRefreshToken: true }
})
