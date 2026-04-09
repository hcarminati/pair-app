import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env["SUPABASE_URL"];
const supabaseKey = process.env["SUPABASE_SECRET_KEY"];
const supabaseAnonKey = process.env["SUPABASE_ANON_KEY"];

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL must be set");
}

if (!supabaseKey) {
  throw new Error("SUPABASE_SECRET_KEY must be set");
}

if (!supabaseAnonKey) {
  throw new Error("SUPABASE_ANON_KEY must be set");
}

// Service role client — used for all DB operations. Never call signInWithPassword
// on this client; doing so stores the user JWT in-memory and causes subsequent
// PostgREST calls to use the authenticated role instead of service_role.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Auth-only client — used exclusively for signInWithPassword, signOut, and
// refreshSession so user sessions never contaminate the service role client.
export const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
