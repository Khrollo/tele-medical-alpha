import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for use in browser/client components.
 * This uses @supabase/ssr to properly handle cookies for middleware compatibility.
 * Sessions are stored in cookies instead of localStorage, allowing middleware to read them.
 *
 * @throws {Error} If required environment variables are missing
 */
export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Please add it to your .env.local file."
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Please add it to your .env.local file."
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

