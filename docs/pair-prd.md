# Pair — Product Requirements Document
**Version:** 1.0
**Last Updated:** March 22, 2026
**Authors:** Heather Carminati, Edward Chan
**Status:** Draft

---

## 1. Product Overview

### 1.1 Mission Statement
Pair helps couples discover and connect with other couples who share similar interests — making it easier to build a mutual social circle where both partners are genuinely opted in.

### 1.2 Problem Statement
Couples who want to make new friends together face a fundamental coordination problem: one partner may be enthusiastic about a potential new friendship while the other is indifferent or uncomfortable. Existing platforms (Meetup, Bumble BFF, Facebook Groups) are built for individuals, not pairs, and provide no mechanism for mutual couple-level consent before a social connection is established. This leads to one-sided social pressure, awkward situations, and friendships that never meaningfully form.

### 1.3 Key Differentiators
- **Couples-only dynamic:** The unit of identity is a couple, not an individual. Profiles are couple profiles.
- **Dual-consent connection model:** A connection between two couples only confirms when *both* partners in the requesting couple have opted in. Either partner can veto.
- **Transparent internal state:** Each partner can see which couples their partner wants to connect with, preventing hidden social obligations.

### 1.4 Mom Test Research Summary
Interviews with target users validated the following findings:
- The fear of one partner being "dragged into" a friendship they didn't choose is a real and common friction point.
- Interest-tag overlap is a meaningful proxy for social compatibility — users want to filter by what they have in common before investing time.
- Location matters, but users think of it as a tag/filter, not a separate map-based feature.

---

## 2. Target Users

### 2.1 Primary Personas

**Persona 1 — The Newly-Moved Couple**
- Recently relocated to a new city (e.g., Boston)
- Want to build a local social circle from scratch
- Motivated by finding people with shared hobbies nearby
- Pain point: Don't know where to start; individual platforms feel mismatched for their goal

**Persona 2 — The Busy Dual-Income Couple**
- Limited free time; can't afford low-compatibility social experiments
- Want to vet interest overlap before committing to plans
- Pain point: Social outreach feels high-effort and risky if one partner isn't into it

**Persona 3 — The Introverted Partner**
- More comfortable reaching out when their partner is also actively opted in
- Doesn't want to be surprised by a social obligation they didn't consent to
- Pain point: Feels pressure when their partner makes social plans on both their behalves

### 2.2 Out of Scope Users (v1)
- Singles or groups of more than two
- Users seeking romantic connections
- Users looking for professional networking

---

## 3. User Stories

### 3.1 Account & Onboarding
| ID | Story | Priority |
|----|-------|----------|
| US-01 | As a user, I want to create a personal account with email and password so I can log into Pair. | P0 |
| US-02 | As a user, I want to generate a private invite token so I can link my account with my partner. | P0 |
| US-03 | As a user, I want to accept my partner's invite token to form a couple profile together. | P0 |
| US-04 | As a user, I want to add interest tags to my profile (from a list or custom) so our couple profile reflects what we enjoy. | P0 |
| US-05 | As a user, I want to add a location tag so couples near us can find us. | P0 |

### 3.2 Discovery
| ID | Story | Priority |
|----|-------|----------|
| US-06 | As a couple (both partners registered), I want to browse other visible couple profiles ranked by shared tag overlap. | P0 |
| US-07 | As a user, I want to filter the discovery feed by specific tags so I can narrow results to what matters most. | P0 |
| US-08 | As a user who hasn't linked with a partner yet, I want to be directed to my profile page to complete linking before accessing the discovery feed or any other screen. | P0 |

### 3.3 Connection Requests & Mutual Consent
| ID | Story | Priority |
|----|-------|----------|
| US-09 | As a fully-registered couple, I want to send a connection request to another couple. | P0 |
| US-10 | As a partner, I want to see which couples my partner has expressed interest in connecting with. | P0 |
| US-11 | As a partner, I want to accept or decline my partner's pending connection interests. | P0 |
| US-12 | As a couple, I want a connection request to only be sent to couple 2 once both my partner and I have both opted in. | P0 |
| US-13 | As a member of couple 2, I want to receive a connection request only after both members of couple 1 have opted in. | P0 |
| US-14 | As a member of couple 2, I want to accept or decline an incoming connection request, and only connect if both my partner and I accept. | P0 |
| US-15 | As a user, I want to see the status of pending and confirmed connections. | P1 |

### 3.4 Inbound & Partner Interest Views
| ID | Story | Priority |
|----|-------|----------|
| US-18 | As a user, I want to see a dedicated page of couples who have sent us a connection request (both partners of couple 1 aligned) so I can review and respond. | P0 |
| US-19 | As a user, I want to see which couples my partner has already expressed interest in connecting with, so I can add my own acceptance or veto without having to ask them. | P0 |
| US-20 | As a user, I want to accept or decline each couple shown in my partner's interest list directly from that page. | P0 |

### 3.5 Connected State
| ID | Story | Priority |
|----|-------|----------|
| US-16 | As a connected couple, I want to see a list of all couples we are connected with. | P1 |
| US-17 | As a connected couple, I want to access a shared async chat thread with another couple so all four of us can coordinate in one place. | P0 |

---

## 4. Functional Requirements

### 4.1 Authentication & Accounts

- **FR-AUTH-01:** Users register with email, password, and display name.
- **FR-AUTH-02:** Passwords must be hashed (bcrypt or equivalent); JWT or session-based auth.
- **FR-AUTH-03:** Each user account is individual — couples are formed by linking two accounts.

### 4.2 Partner Linking

- **FR-LINK-01:** Any registered user can generate a unique, single-use invite token.
- **FR-LINK-02:** A second user can enter the token to link accounts, forming a couple.
- **FR-LINK-03:** A couple is only considered "complete" when both partners have registered and linked.
- **FR-LINK-04:** A user may only be linked to one partner at a time (v1).
- **FR-LINK-05:** Tokens expire after 72 hours or after first use, whichever comes first.
- **FR-LINK-06:** If one partner delinks, the remaining partner's account is suspended — they cannot browse or connect until re-linked with a new partner. All connection requests and associated messages involving the dissolved couple are automatically deleted.

### 4.3 Profile & Tags

- **FR-TAG-01:** Tags are applied at the individual level and aggregated at the couple level (union of both partners' tags).
- **FR-TAG-02:** Tag input supports: (a) a curated list of common interest tags, and (b) free-text custom tags.
- **FR-TAG-03:** All tags are normalized — stored lowercase and whitespace-trimmed. Duplicate tags (after normalization) are rejected at insert time.
- **FR-TAG-04:** Location is treated as a tag (e.g., "boston, ma") — no map or radius logic in v1.
- **FR-TAG-05:** Maximum of 10 tags per user. The couple profile displays up to 20 tags (union of both partners').
- **FR-TAG-06:** A couple's profile is only visible in discovery once both partners have completed registration and linking.

### 4.4 Discovery & Matching

- **FR-DISC-01:** Discovery feed displays couple profiles ranked by number of shared tags with the viewing couple (descending).
- **FR-DISC-02:** Each couple card in the discovery feed displays the shared tag count (e.g., "4 tags in common") before the user clicks in.
- **FR-DISC-03:** Users can filter the feed by one or more specific tags.
- **FR-DISC-04:** A couple's own profile is excluded from their discovery feed.
- **FR-DISC-05:** Unlinked users (no partner) cannot access the discovery feed or any other screen beyond their profile page. The Profile → "Link partner" tab prompts them to link with a partner before continuing.
- **FR-DISC-06:** Already-connected couples are hidden from the discovery feed.
- **FR-DISC-07:** Couples whose connection request was declined are silently removed from the requesting couple's pending list — no rejection notice is shown.

### 4.5 Connection Request Flow

The connection flow has two internal stages before an outbound request is sent:

**Stage 1 — Internal Couple Alignment (within couple 1):**
- **FR-CONN-01:** Either partner (Person A or Person B) can express interest in connecting with another couple. This is a private, internal "interest" state — not yet a request sent to the target couple.
- **FR-CONN-02:** Each partner has a view showing which couples their partner has expressed interest in, and whether they themselves have accepted or declined each.
- **FR-CONN-03:** A connection request is only dispatched to couple 2 when *both* Person A and Person B have expressed interest in connecting with couple 2.
- **FR-CONN-04:** If either partner declines, the interest is cancelled. The other partner is notified (in-app state update).

**Stage 2 — Receiving Couple Response (couple 2):**
- **FR-CONN-05:** Couple 2 receives a connection request notification once couple 1's internal alignment is complete.
- **FR-CONN-06:** Each partner in couple 2 (Person C and Person D) independently accepts or declines.
- **FR-CONN-07:** The same dual-consent rule applies: the connection only confirms if *both* Person C and Person D accept.
- **FR-CONN-08:** If either partner in couple 2 declines, the request is rejected. Couple 1 is notified of the declined status (without specifying which partner declined).

- **FR-CONN-09:** Before creating a new connection request, the backend checks whether an existing request already exists between the two couples in any direction and at any status. If one exists, no new request is created — the existing request is surfaced to the initiating user instead.

```
INTEREST_PENDING   → One partner has expressed interest; waiting for the other
INTEREST_ALIGNED   → Both partners interested; request dispatched to couple 2
REQUEST_PENDING    → Couple 2 has received the request; awaiting both partners' responses
CONNECTED          → All four parties have accepted
DECLINED           → Request declined at stage 1 or stage 2
```

### 4.6 Inbound Requests Page ("Couples That Want to Connect With You")

- **FR-INBOUND-01:** Each user has a dedicated page listing all couples who have reached `INTEREST_ALIGNED` status toward their couple — i.e., both partners of the requesting couple have opted in and the request has been dispatched.
- **FR-INBOUND-02:** Each card on this page displays the requesting couple's profile, shared tag count, and per-partner response controls (accept / decline).
- **FR-INBOUND-03:** The page reflects each partner's individual response state — a user can see whether their partner has already responded to a given inbound request.
- **FR-INBOUND-04:** Once both partners of the receiving couple accept, the status transitions to `CONNECTED` and the couple moves to the Connections view.
- **FR-INBOUND-05:** If either partner declines, the request is silently removed from both partners' inbound pages and the status is set to `DECLINED`.

### 4.7 Partner Interest Page ("Couples Your Partner Wants to Connect With")

- **FR-PARTNER-01:** Each user has a dedicated page listing all couples their partner has individually expressed interest in (status `INTEREST_PENDING`, where the partner is the one who initiated interest).
- **FR-PARTNER-02:** Each card shows the target couple's profile, shared tag count, and the current user's response options: accept or decline.
- **FR-PARTNER-03:** If the current user accepts, both partners are now aligned and the status transitions to `INTEREST_ALIGNED` — the request is dispatched to the target couple.
- **FR-PARTNER-04:** If the current user declines, the interest is cancelled, status is set to `DECLINED`, and the entry is silently removed from both partners' views.
- **FR-PARTNER-05:** Couples that the current user themselves initiated interest in do not appear on this page — only interests initiated by their partner.

### 4.8 Connected Couples

- **FR-CHAT-01:** Once connected, all four members of two connected couples unlock a shared async chat thread.
- **FR-CHAT-02:** Any of the four members can post messages to the thread.
- **FR-CHAT-03:** Messages are displayed in chronological order with the sender's display name and timestamp.
- **FR-CHAT-04:** Supabase Realtime powers the thread — new messages appear without requiring a page refresh.
- **FR-CONN-09:** Connected couples appear in a "Connections" view for both couples.

---

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Platform** | Web app (browser-based). No mobile app in v1. |
| **Media** | No photo or video upload in v1. Text and tags only. |
| **Performance** | Discovery feed loads within 2 seconds for up to 500 couples. |
| **Security** | Invite tokens are cryptographically random (UUID v4 or similar). Auth tokens expire and are refreshed. |
| **Privacy** | Incomplete couple profiles are not surfaced in discovery. Which partner declined a request is not disclosed to the requesting couple. |
| **Accessibility** | WCAG 2.1 AA compliance for all core flows. |

---

## 6. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | React + TypeScript | Type safety catches couple/user state bugs early; strong ecosystem |
| Routing | React Router v6 | Standard SPA routing |
| Backend | Node.js + Express | Handles auth middleware, connection state machine transitions, invite token logic, and delink cascades cleanly in code |
| API Style | REST | Straightforward to scaffold, test, and document for a project of this scope |
| Database | Supabase Postgres | Managed PostgreSQL — ideal for the relational couple/connection state model |
| Auth | Supabase Auth + backend JWT verification | Supabase issues JWTs; Express middleware verifies them on every protected route |
| Data Access | Supabase JS client or `pg` directly | Backend queries Supabase Postgres via the service role key (bypasses RLS — backend enforces access control in code) |
| Real-time | Supabase Realtime | Powers the live chat thread — subscribed to from the frontend directly |
| Testing | Vitest + React Testing Library (frontend), Vitest (backend), Playwright (E2E) | TDD across both layers; Playwright covers critical user flows end-to-end |
| Hosting | Vercel (frontend) + Railway or Render (backend) + Supabase (db) | Zero-config deploys; clean separation of concerns |

---

## 7. Data Model (Conceptual)

```sql
-- Supabase manages auth.users; profiles extend it
profiles
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
  display_name  text NOT NULL
  partner_id    uuid REFERENCES profiles(id) ON DELETE SET NULL  -- null until linked
  about_me      text                                              -- individual bio, nullable
  location      text                                              -- individual location, e.g. "Portland, OR", nullable
  created_at    timestamptz NOT NULL DEFAULT now()
  updated_at    timestamptz NOT NULL DEFAULT now()

-- Couple-level record; created on linking, deleted explicitly on delink (also cascades on profile delete)
pairs
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  profile_id_1  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  profile_id_2  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  about_us      text                                              -- shared couple bio, shown on discover card
  location      text                                              -- shared couple location, shown on discover card
  created_at    timestamptz NOT NULL DEFAULT now()
  updated_at    timestamptz NOT NULL DEFAULT now()

-- Single-use partner-linking tokens; expires_at set by Express service layer (created_at + 72h)
invite_tokens
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
  token       text NOT NULL UNIQUE
  created_by  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  used_by     uuid REFERENCES profiles(id) ON DELETE SET NULL
  expires_at  timestamptz NOT NULL
  used_at     timestamptz
  created_at  timestamptz NOT NULL DEFAULT now()

tags
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid()
  label     text NOT NULL UNIQUE   -- normalized: lowercase, trimmed
  is_custom bool NOT NULL DEFAULT false
  created_at timestamptz NOT NULL DEFAULT now()

user_tags
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  tag_id    uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE
  PRIMARY KEY (user_id, tag_id)

-- All 4 participant IDs stored directly so backend can determine couple-side without joins
connection_requests
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
  couple_1_user_a uuid NOT NULL REFERENCES profiles(id)
  couple_1_user_b uuid NOT NULL REFERENCES profiles(id)
  couple_2_user_a uuid NOT NULL REFERENCES profiles(id)
  couple_2_user_b uuid NOT NULL REFERENCES profiles(id)
  status          connection_status NOT NULL DEFAULT 'INTEREST_PENDING'
    -- ENUM: INTEREST_PENDING | INTEREST_ALIGNED | REQUEST_PENDING | CONNECTED | DECLINED
  created_at      timestamptz NOT NULL DEFAULT now()
  updated_at      timestamptz NOT NULL DEFAULT now()

connection_request_participants
  request_id  uuid NOT NULL REFERENCES connection_requests(id) ON DELETE CASCADE
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  interested  bool NOT NULL DEFAULT false
  PRIMARY KEY (request_id, user_id)

messages  -- Supabase Realtime enabled
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
  request_id  uuid NOT NULL REFERENCES connection_requests(id) ON DELETE CASCADE
  sender_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  content     text NOT NULL
  created_at  timestamptz NOT NULL DEFAULT now()
```

**State transition rules (enforced in backend):**
- `INTEREST_PENDING` → `INTEREST_ALIGNED`: both partners of couple 1 have `interested = true`
- `INTEREST_ALIGNED` → `REQUEST_PENDING`: request dispatched to couple 2
- `REQUEST_PENDING` → `CONNECTED`: all four participants have `interested = true`
- Any participant sets `interested = false` at any stage → status set to `DECLINED`
- Duplicate request prevention: backend rejects new requests between two couples if any request already exists between them in any direction (FR-CONN-09)

**Note on `location`:** Both `profiles.location` (individual) and `pairs.location` (shared) are plain text columns — no map or geolocation logic in v1. `pairs.location` is the shared couple location shown on the discover card. This supersedes FR-TAG-04.

**Note on `about_me` / `about_us`:** Individual bios (`about_me`) live on `profiles`. The shared couple bio (`about_us`) and shared location live on `pairs`. The discover card shows `pairs.about_us` and `pairs.location`; clicking into a card reveals each partner's individual `about_me`.

**Access control:** The Express backend connects to Supabase using the service role key, bypassing RLS. All authorization logic is enforced in backend route handlers. The frontend never holds the service role key — it only calls the Express API.

---

## 8. Out of Scope (v1)

- Photo or video upload
- Mobile app
- Push notifications (email notification acceptable as stretch)
- Blocking / reporting users
- Couple dissolution / re-linking
- Paid tiers or monetization

---

## 10. Success Metrics (v1 MVP)

| Metric | Target |
|--------|--------|
| Couple completion rate (both partners register after first invite) | ≥ 60% |
| Connection request dual-consent rate (both partners align) | ≥ 50% of expressed interests |
| Discovery-to-request conversion | ≥ 15% of profile views result in an expressed interest |
| Core flow test coverage | ≥ 80% (unit + integration) |