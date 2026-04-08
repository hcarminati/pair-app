// ============================================================
// Pair — Shared TypeScript Types
// Matches the Supabase schema in project-memory/database-setup.sql
// Used by server/ (route handlers, service layer) and eventually client/ (API responses).
// ============================================================

export type ConnectionStatus =
  | "INTEREST_PENDING"
  | "INTEREST_ALIGNED"
  | "REQUEST_PENDING"
  | "CONNECTED"
  | "DECLINED";

// ----------------------------------------------------------------
// profiles
// ----------------------------------------------------------------
export interface Profile {
  id: string; // uuid — matches auth.users.id
  display_name: string;
  partner_id: string | null;
  about_me: string | null;
  location: string | null;
  created_at: string; // ISO 8601 timestamptz
  updated_at: string;
}

// ----------------------------------------------------------------
// pairs
// Couple-level record. Created on linking, deleted on delink.
// ----------------------------------------------------------------
export interface Pair {
  id: string;
  profile_id_1: string; // profiles.id
  profile_id_2: string; // profiles.id
  about_us: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------
// invite_tokens
// ----------------------------------------------------------------
export interface InviteToken {
  id: string;
  token: string;
  created_by: string; // profiles.id
  used_by: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

// ----------------------------------------------------------------
// tags
// ----------------------------------------------------------------
export interface Tag {
  id: string;
  label: string; // normalized: lowercase, trimmed
  is_custom: boolean;
  created_at: string;
}

// ----------------------------------------------------------------
// user_tags
// ----------------------------------------------------------------
export interface UserTag {
  user_id: string; // profiles.id
  tag_id: string; // tags.id
}

// ----------------------------------------------------------------
// connection_requests
// couple_1 = initiating couple; couple_2 = target couple
// user_a/user_b are the two partners on each side (order arbitrary)
// ----------------------------------------------------------------
export interface ConnectionRequest {
  id: string;
  couple_1_user_a: string; // profiles.id
  couple_1_user_b: string; // profiles.id
  couple_2_user_a: string; // profiles.id
  couple_2_user_b: string; // profiles.id
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------
// connection_request_participants
// 4 rows per request (one per user).
// ----------------------------------------------------------------
export interface ConnectionRequestParticipant {
  request_id: string; // connection_requests.id
  user_id: string; // profiles.id
  interested: boolean;
}

// ----------------------------------------------------------------
// messages
// ----------------------------------------------------------------
export interface Message {
  id: string;
  request_id: string; // connection_requests.id
  sender_id: string; // profiles.id
  content: string;
  created_at: string;
}
