-- ============================================================
-- Pair — Database Setup
-- Apply manually via Supabase Studio SQL Editor.
-- Run in order: schema first, then seed, then test_helpers.
-- ============================================================

-- ----------------------------------------------------------------
-- updated_at trigger function (shared by profiles, pairs, connection_requests)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------
-- profiles
-- Individual-level data. partner_id null until invite token redeemed.
-- ----------------------------------------------------------------
CREATE TABLE public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text        NOT NULL,
  partner_id   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  about_me     text,
  location     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_partner_id ON public.profiles(partner_id);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ----------------------------------------------------------------
-- pairs
-- Couple-level data. Created when both partners link via invite token.
-- about_us and location are the shared fields shown on the discover card.
-- Deleted automatically when either partner's profile is deleted (CASCADE).
-- The backend explicitly deletes this row on delink.
-- ----------------------------------------------------------------
CREATE TABLE public.pairs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id_1 uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id_2 uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  about_us     text,
  location     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id_1, profile_id_2)
);

CREATE INDEX idx_pairs_profile_id_1 ON public.pairs(profile_id_1);
CREATE INDEX idx_pairs_profile_id_2 ON public.pairs(profile_id_2);

CREATE TRIGGER pairs_updated_at
  BEFORE UPDATE ON public.pairs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ----------------------------------------------------------------
-- invite_tokens
-- ----------------------------------------------------------------
CREATE TABLE public.invite_tokens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token      text        NOT NULL UNIQUE,
  created_by uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  used_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invite_tokens_token      ON public.invite_tokens(token);
CREATE INDEX idx_invite_tokens_created_by ON public.invite_tokens(created_by);

-- ----------------------------------------------------------------
-- tags
-- ----------------------------------------------------------------
CREATE TABLE public.tags (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  label      text        NOT NULL UNIQUE,
  is_custom  bool        NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------
-- user_tags
-- ----------------------------------------------------------------
CREATE TABLE public.user_tags (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tag_id  uuid NOT NULL REFERENCES public.tags(id)    ON DELETE CASCADE,
  PRIMARY KEY (user_id, tag_id)
);

CREATE INDEX idx_user_tags_user_id ON public.user_tags(user_id);
CREATE INDEX idx_user_tags_tag_id  ON public.user_tags(tag_id);

-- ----------------------------------------------------------------
-- connection_requests
-- ----------------------------------------------------------------
CREATE TYPE public.connection_status AS ENUM (
  'INTEREST_PENDING',
  'INTEREST_ALIGNED',
  'REQUEST_PENDING',
  'CONNECTED',
  'DECLINED'
);

CREATE TABLE public.connection_requests (
  id              uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_1_user_a uuid                     NOT NULL REFERENCES public.profiles(id),
  couple_1_user_b uuid                     NOT NULL REFERENCES public.profiles(id),
  couple_2_user_a uuid                     NOT NULL REFERENCES public.profiles(id),
  couple_2_user_b uuid                     NOT NULL REFERENCES public.profiles(id),
  status          public.connection_status NOT NULL DEFAULT 'INTEREST_PENDING',
  created_at      timestamptz              NOT NULL DEFAULT now(),
  updated_at      timestamptz              NOT NULL DEFAULT now()
);

CREATE INDEX idx_conn_req_couple_1_a ON public.connection_requests(couple_1_user_a);
CREATE INDEX idx_conn_req_couple_1_b ON public.connection_requests(couple_1_user_b);
CREATE INDEX idx_conn_req_couple_2_a ON public.connection_requests(couple_2_user_a);
CREATE INDEX idx_conn_req_couple_2_b ON public.connection_requests(couple_2_user_b);
CREATE INDEX idx_conn_req_status     ON public.connection_requests(status);

CREATE TRIGGER connection_requests_updated_at
  BEFORE UPDATE ON public.connection_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ----------------------------------------------------------------
-- connection_request_participants
-- ----------------------------------------------------------------
CREATE TABLE public.connection_request_participants (
  request_id uuid NOT NULL REFERENCES public.connection_requests(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id)            ON DELETE CASCADE,
  interested bool NOT NULL DEFAULT false,
  PRIMARY KEY (request_id, user_id)
);

CREATE INDEX idx_conn_participants_user_id ON public.connection_request_participants(user_id);

-- ----------------------------------------------------------------
-- messages
-- ----------------------------------------------------------------
CREATE TABLE public.messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid        NOT NULL REFERENCES public.connection_requests(id) ON DELETE CASCADE,
  sender_id  uuid        NOT NULL REFERENCES public.profiles(id)            ON DELETE CASCADE,
  content    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_request_id ON public.messages(request_id);
CREATE INDEX idx_messages_sender_id  ON public.messages(sender_id);

-- ----------------------------------------------------------------
-- Supabase Realtime — enable live updates for chat
-- ----------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ----------------------------------------------------------------
-- link_partners
-- Atomically links two profiles and creates the pairs row.
-- Called from the Express backend via supabase.rpc().
-- Runs as SECURITY INVOKER (service role caller bypasses RLS).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_partners(user_a uuid, user_b uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles SET partner_id = user_b WHERE id = user_a;
  UPDATE public.profiles SET partner_id = user_a WHERE id = user_b;
  INSERT INTO public.pairs (profile_id_1, profile_id_2) VALUES (user_b, user_a);
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------
-- Seed — preset interest tags
-- ----------------------------------------------------------------
INSERT INTO public.tags (label, is_custom) VALUES
  ('hiking', false),
  ('cooking', false),
  ('travel', false),
  ('gaming', false),
  ('movies', false),
  ('music', false),
  ('reading', false),
  ('fitness', false),
  ('yoga', false),
  ('cycling', false),
  ('running', false),
  ('photography', false),
  ('art', false),
  ('dancing', false),
  ('wine', false),
  ('coffee', false),
  ('foodie', false),
  ('camping', false),
  ('beach', false),
  ('skiing', false),
  ('climbing', false),
  ('tennis', false),
  ('golf', false),
  ('board games', false),
  ('trivia', false),
  ('comedy', false),
  ('theater', false),
  ('concerts', false),
  ('volunteering', false),
  ('dogs', false),
  ('cats', false),
  ('brunch', false),
  ('crafts', false),
  ('podcasts', false),
  ('meditation', false)
ON CONFLICT (label) DO NOTHING;

-- ----------------------------------------------------------------
-- E2E Test Helper
-- Allows a test user to delete themselves using their own JWT (anon key).
-- No service role key required in tests.
--
-- Safeguards:
--   - Uses auth.uid() — each user can only delete themselves
--   - Strict email check prevents deleting real users
--   - Deletion order matters:
--       1. connection_requests (no ON DELETE CASCADE on profile FKs)
--          → cascades to connection_request_participants + messages
--       2. auth.users → cascades to profiles → pairs, invite_tokens, user_tags
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_test_user()
RETURNS void AS $$
DECLARE
  _user_id    uuid;
  _user_email text;
BEGIN
  _user_id := auth.uid();

  SELECT email INTO _user_email FROM auth.users WHERE id = _user_id;

  IF _user_email LIKE 'test_e2e_%@example.com' THEN
    -- Must delete connection_requests first (no ON DELETE CASCADE on profile FKs)
    -- cascades to connection_request_participants + messages
    DELETE FROM public.connection_requests
    WHERE couple_1_user_a = _user_id
       OR couple_1_user_b = _user_id
       OR couple_2_user_a = _user_id
       OR couple_2_user_b = _user_id;

    -- Delete auth user; cascades to profiles → pairs, invite_tokens, user_tags
    DELETE FROM auth.users WHERE id = _user_id;
  ELSE
    RAISE EXCEPTION 'Unauthorized: Only automated test users can self-delete.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
