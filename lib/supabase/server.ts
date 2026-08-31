import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export async function createUserSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("supabase_url"),
    requireEnv("supabase_publishable_key"),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server components can expose a read-only cookie store.
          }
        }
      }
    }
  );
}

export function createServiceSupabaseClient() {
  return createClient(
    requireEnv("supabase_url"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  );
}
