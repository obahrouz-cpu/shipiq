import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pzlckjasayitxcblvkjg.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6bGNramFzYXlpdHhjYmx2a2pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NDYwMDEsImV4cCI6MjA5NDIyMjAwMX0.dBxpr3gySGu5le4UgMpskGaJpNmLlSPbb_BE42bLc_E'

export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseKey)
}