import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isProduction } from "../config/env.js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseSecretKey) {
    if (isProduction) {
      throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required in production");
    }
    return null;
  }

  client ??= createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export async function assertPrivateMediaBucket(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data, error } = await supabase.storage.getBucket(
    env.supabaseStorageBucket,
  );
  if (error) throw new Error(`Unable to inspect media bucket: ${error.message}`);
  if (data.public) throw new Error("SUPABASE_STORAGE_BUCKET must be private");
}
