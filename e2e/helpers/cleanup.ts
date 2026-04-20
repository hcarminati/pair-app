import { createClient } from "@supabase/supabase-js";

/**
 * Deletes a test user via the `delete_test_user()` Supabase RPC function.
 * The function only accepts emails matching `test_e2e_%@example.com`.
 * Signs in as the user (anon key), calls the RPC, then signs out.
 */
export async function deleteTestUser(
  email: string,
  password: string,
): Promise<void> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    console.warn(
      "deleteTestUser: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set — skipping cleanup",
    );
    return;
  }

  const supabase = createClient(supabaseUrl, anonKey);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    console.warn(`deleteTestUser: could not sign in as ${email} — skipping`);
    return;
  }

  const { error: rpcError } = await supabase.rpc("delete_test_user");
  if (rpcError) {
    console.warn(
      `deleteTestUser: RPC failed for ${email} — ${rpcError.message}`,
    );
  } else {
    console.log(`deleteTestUser: deleted ${email}`);
  }
  await supabase.auth.signOut();
}
