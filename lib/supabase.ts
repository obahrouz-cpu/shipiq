import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton instance — only one client ever created
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (typeof window === 'undefined') {
    // Server side — always create new instance
    return createBrowserClient(supabaseUrl, supabaseKey)
  }
  // Client side — reuse existing instance
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(supabaseUrl, supabaseKey)
  }
  return supabaseInstance
}
