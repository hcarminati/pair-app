import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../lib/supabase.js", () => {
  const mockSupabase = {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
    rpc: vi.fn(),
  };
  const mockSupabaseAuthClient = {
    auth: { signInWithPassword: vi.fn(), refreshSession: vi.fn() },
  };
  return { supabase: mockSupabase, supabaseAuthClient: mockSupabaseAuthClient };
});

const { supabase } = await import("../lib/supabase.js");
const { app } = await import("../app.js");

const mockAuth = supabase.auth as unknown as {
  getUser: ReturnType<typeof vi.fn>;
};
const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

const USER_ID = "user-abc";
const PARTNER_ID = "user-xyz";

function mockAuthenticatedUser(userId = USER_ID) {
  mockAuth.getUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

function makeMockFrom({
  myProfile = {
    display_name: "Alex",
    about_me: "Love hiking",
    location: "Portland, OR",
    partner_id: PARTNER_ID,
  },
  partnerProfile = {
    display_name: "Jordan",
    about_me: "Love cooking",
    location: "Seattle, WA",
  },
  pair = {
    id: "pair-id-1",
    about_us: "We love adventures",
    location: "Portland, OR",
  },
  tagRows = [
    { user_id: USER_ID, tags: { label: "hiking" } },
    { user_id: USER_ID, tags: { label: "cooking" } },
    { user_id: PARTNER_ID, tags: { label: "yoga" } },
    { user_id: PARTNER_ID, tags: { label: "cooking" } }, // duplicate
  ],
}: {
  myProfile?: Record<string, unknown> | null;
  partnerProfile?: Record<string, unknown> | null;
  pair?: Record<string, unknown> | null;
  tagRows?: { user_id: string; tags: { label: string } | null }[];
} = {}) {
  let profileCallCount = 0;

  mockFrom.mockImplementation((table: string) => {
    if (table === "profiles") {
      profileCallCount++;
      if (profileCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: myProfile,
                error: myProfile ? null : { message: "Not found" },
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: partnerProfile,
              error: partnerProfile ? null : { message: "Not found" },
            }),
          }),
        }),
      };
    }

    if (table === "pairs") {
      return {
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: pair, error: pair ? null : { message: "Not found" } }),
          }),
        }),
      };
    }

    if (table === "user_tags") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: tagRows, error: null }),
        }),
      };
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /pairs/me ────────────────────────────────────────────────────────────

describe("GET /pairs/me", () => {
  it("returns 200 with full couple profile when user is paired", async () => {
    mockAuthenticatedUser();
    makeMockFrom();

    const res = await request(app)
      .get("/pairs/me")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body.pair_id).toBe("pair-id-1");
    expect(res.body.about_us).toBe("We love adventures");
    expect(res.body.location).toBe("Portland, OR");
    expect(res.body.partner1.display_name).toBe("Alex");
    expect(res.body.partner2.display_name).toBe("Jordan");
  });

  it("includes both partners' about_me fields", async () => {
    mockAuthenticatedUser();
    makeMockFrom();

    const res = await request(app)
      .get("/pairs/me")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body.partner1.about_me).toBe("Love hiking");
    expect(res.body.partner2.about_me).toBe("Love cooking");
  });

  it("returns shared tags (intersection) in tags, individual tags on each partner", async () => {
    mockAuthenticatedUser();
    // USER_ID: hiking, cooking — PARTNER_ID: yoga, cooking → shared = cooking
    makeMockFrom();

    const res = await request(app)
      .get("/pairs/me")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual(["cooking"]);
    expect(res.body.partner1.tags).toContain("hiking");
    expect(res.body.partner1.tags).toContain("cooking");
    expect(res.body.partner2.tags).toContain("yoga");
    expect(res.body.partner2.tags).toContain("cooking");
  });

  it("sorts individual and shared tags alphabetically", async () => {
    mockAuthenticatedUser();
    makeMockFrom({
      tagRows: [
        { user_id: USER_ID, tags: { label: "yoga" } },
        { user_id: USER_ID, tags: { label: "cooking" } },
        { user_id: PARTNER_ID, tags: { label: "hiking" } },
        { user_id: PARTNER_ID, tags: { label: "cooking" } },
      ],
    });

    const res = await request(app)
      .get("/pairs/me")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body.partner1.tags).toEqual(["cooking", "yoga"]);
    expect(res.body.partner2.tags).toEqual(["cooking", "hiking"]);
    expect(res.body.tags).toEqual(["cooking"]);
  });

  it("caps individual tag lists at 10", async () => {
    mockAuthenticatedUser();
    const userTags = Array.from({ length: 12 }, (_, i) => ({
      user_id: USER_ID,
      tags: { label: `tag-${String(i).padStart(2, "0")}` },
    }));
    const partnerTags = Array.from({ length: 12 }, (_, i) => ({
      user_id: PARTNER_ID,
      tags: { label: `tag-${String(i).padStart(2, "0")}` },
    }));
    makeMockFrom({ tagRows: [...userTags, ...partnerTags] });

    const res = await request(app)
      .get("/pairs/me")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect((res.body.partner1.tags as string[]).length).toBeLessThanOrEqual(10);
    expect((res.body.partner2.tags as string[]).length).toBeLessThanOrEqual(10);
  });

  it("returns 400 when user is not paired", async () => {
    mockAuthenticatedUser();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              display_name: "Alex",
              about_me: null,
              location: null,
              partner_id: null,
            },
            error: null,
          }),
        }),
      }),
    });

    const res = await request(app)
      .get("/pairs/me")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not currently paired/i);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const res = await request(app).get("/pairs/me");

    expect(res.status).toBe(401);
  });
});
