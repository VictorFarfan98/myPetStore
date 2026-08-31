import { createBrowserClient } from "@supabase/ssr";

export function createUserSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.supabase_url!,
    process.env.supabase_publishable_key!
  );
}
