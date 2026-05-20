import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

function createSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith('http')) {
    // Return a dummy client that will fail gracefully at runtime
    // This prevents build-time crashes when env vars aren't set
    return new Proxy({} as SupabaseClient, {
      get(_target, prop) {
        if (prop === 'from') {
          return () => new Proxy({} as ReturnType<SupabaseClient['from']>, {
            get() {
              return (..._args: unknown[]) => Promise.resolve({ data: null, error: { message: 'Supabase not configured', code: 'NOT_CONFIGURED' }, count: null });
            },
          });
        }
        return () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } });
      },
    });
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = createSupabaseClient();
