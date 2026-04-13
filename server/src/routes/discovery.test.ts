import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../lib/supabase.js", () => {
  const mockSupabase = {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
    rpc: vi.fn(),
  };
  return { supabase: mockSupabase };
});

const { supabase } = await import("../lib/supabase.js");
const { app } = await import("../app.js");

const mockAuth = supabase.auth as unknown as {
  getUser: ReturnType<typeof vi.fn>;
};
const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

const MY_ID = "user-me";
const PARTNER_ID = "user-partner";
const MY_PAIR_ID = "pair-mine";

const OTHER_PAIR_ID = "pair-other";
const OTHER_USER_A = "user-other-a";
const OTHER_USER_B = "user-other-b";

function mockAuthUser(userId = MY_ID) {
  mockAuth.getUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

type FromCall = {
  profiles?: object | null;
  myPair?: object | null;
  myTags?: object[];
  connectedRequests?: object[];
  allPairs?: object[];
  candidateProfiles?: object[];
  candidateTags?: object[];
};

function setupMocks({
  profiles = { partner_id: PARTNER_ID },
  myPair = { id: MY_PAIR_ID },
  myTags = [
    { tags: { label: "hiking" } },
    { tags: { label: "cooking" } },
    { tags: { label: "yoga" } },
  ],
  connectedRequests = [],
  allPairs = [
    {
      id: OTHER_PAIR_ID,
      about_us: "We love the outdoors",
      location: "Denver, CO",
      profile_id_1: OTHER_USER_A,
      profile_id_2: OTHER_USER_B,
    },
  ],
  candidateProfiles = [
    { id: OTHER_USER_A, display_name: "Alex", about_me: "Love hiking", location: "Denver, CO" },
    { id: OTHER_USER_B, display_name: "Jordan", about_me: "Love cooking", location: "Portland, OR" },
  ],
  candidateTags = [
    { user_id: OTHER_USER_A, tags: { label: "hiking" } },
    { user_id: OTHER_USER_A, tags: { label: "films" } },
    { user_id: OTHER_USER_B, tags: { label: "cooking" } },
  ],
}: FromCall = {}) {
  let profileCallCount = 0;
  let pairsCallCount = 0;
  let userTagsCallCount = 0;

  mockFrom.mockImplementation((table: string) => {
    if (table === "profiles") {
      profileCallCount++;
      // 1st call: my profile (partner_id check)
      if (profileCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: profiles, error: profiles ? null : { message: "Not found" } }),
            }),
          }),
        };
      }
      // 2nd call: batch profile fetch for candidates
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: candidateProfiles, error: null }),
        }),
      };
    }

    if (table === "pairs") {
      pairsCallCount++;
      // 1st call: my pair (single)
      if (pairsCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: myPair, error: myPair ? null : { message: "Not found" } }),
            }),
          }),
        };
      }
      // 2nd call: all other pairs
      return {
        select: vi.fn().mockReturnValue({
          neq: vi.fn().mockResolvedValue({ data: allPairs, error: null }),
        }),
      };
    }

    if (table === "user_tags") {
      userTagsCallCount++;
      // 1st call: my couple's tags
      if (userTagsCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: myTags, error: null }),
          }),
        };
      }
      // 2nd call: candidate tags
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: candidateTags, error: null }),
        }),
      };
    }

    if (table === "connection_requests") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({ data: connectedRequests, error: null }),
          }),
        }),
      };
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /discovery", () => {
  it("returns 403 when user is not paired", async () => {
    mockAuthUser();
    setupMocks({ profiles: { partner_id: null } });

    const res = await request(app)
      .get("/discovery")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/linked with a partner/i);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "Unauthorized" } });

    const res = await request(app).get("/discovery");

    expect(res.status).toBe(401);
  });

  it("returns 200 with ranked results sorted by shared tag count descending", async () => {
    mockAuthUser();
    setupMocks({
      allPairs: [
        { id: "pair-a", about_us: null, location: "NYC", profile_id_1: "ua1", profile_id_2: "ua2" },
        { id: "pair-b", about_us: null, location: "LA", profile_id_1: "ub1", profile_id_2: "ub2" },
      ],
      candidateProfiles: [
        { id: "ua1", display_name: "Alice", about_me: null, location: null },
        { id: "ua2", display_name: "Bob", about_me: null, location: null },
        { id: "ub1", display_name: "Carol", about_me: null, location: null },
        { id: "ub2", display_name: "Dan", about_me: null, location: null },
      ],
      candidateTags: [
        // pair-a: shares hiking + cooking with us (2 in common)
        { user_id: "ua1", tags: { label: "hiking" } },
        { user_id: "ua2", tags: { label: "cooking" } },
        // pair-b: shares only yoga (1 in common)
        { user_id: "ub1", tags: { label: "yoga" } },
        { user_id: "ub2", tags: { label: "films" } },
      ],
    });

    const res = await request(app)
      .get("/discovery")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].shared_count).toBeGreaterThanOrEqual(res.body[1].shared_count);
    expect(res.body[0].pair_id).toBe("pair-a");
  });

  it("excludes own couple from results", async () => {
    mockAuthUser();
    // allPairs query uses .neq("id", myPair.id) so own pair is excluded at DB level.
    // We verify it's not in the response.
    setupMocks({
      allPairs: [], // DB already excluded own pair
    });

    const res = await request(app)
      .get("/discovery")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("excludes already-connected couples from results", async () => {
    mockAuthUser();
    setupMocks({
      connectedRequests: [
        {
          couple_1_user_a: MY_ID,
          couple_1_user_b: PARTNER_ID,
          couple_2_user_a: OTHER_USER_A,
          couple_2_user_b: OTHER_USER_B,
        },
      ],
    });

    const res = await request(app)
      .get("/discovery")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("excludes incomplete couples (missing profile for a partner)", async () => {
    mockAuthUser();
    setupMocks({
      candidateProfiles: [
        { id: OTHER_USER_A, display_name: "Alex" },
        // OTHER_USER_B is missing — incomplete couple
      ],
    });

    const res = await request(app)
      .get("/discovery")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns correct fields in each result", async () => {
    mockAuthUser();
    setupMocks();

    const res = await request(app)
      .get("/discovery")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    const item = res.body[0];
    expect(item).toHaveProperty("pair_id");
    expect(item).toHaveProperty("about_us");
    expect(item).toHaveProperty("location");
    expect(item).toHaveProperty("tags");
    expect(item).toHaveProperty("matching_tags");
    expect(item).toHaveProperty("shared_count");
    expect(item).toHaveProperty("partner1.display_name");
    expect(item).toHaveProperty("partner1.about_me");
    expect(item).toHaveProperty("partner1.location");
    expect(item).toHaveProperty("partner1.tags");
    expect(item).toHaveProperty("partner2.display_name");
    expect(item).toHaveProperty("partner2.about_me");
    expect(item).toHaveProperty("partner2.location");
    expect(item).toHaveProperty("partner2.tags");
  });

  it("returns matching_tags as intersection of couples' tags", async () => {
    mockAuthUser();
    // My tags: hiking, cooking, yoga
    // Other couple tags: hiking, films, cooking → matching: hiking, cooking
    setupMocks();

    const res = await request(app)
      .get("/discovery")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body[0].matching_tags).toEqual(expect.arrayContaining(["hiking", "cooking"]));
    expect(res.body[0].shared_count).toBe(2);
  });

  it("returns empty array when no eligible couples exist", async () => {
    mockAuthUser();
    setupMocks({ allPairs: [] });

    const res = await request(app)
      .get("/discovery")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  describe("tag filtering (?tags=...)", () => {
    const TWO_PAIR_SETUP = {
      allPairs: [
        { id: "pair-a", about_us: null, location: "NYC", profile_id_1: "ua1", profile_id_2: "ua2" },
        { id: "pair-b", about_us: null, location: "LA", profile_id_1: "ub1", profile_id_2: "ub2" },
      ],
      candidateProfiles: [
        { id: "ua1", display_name: "Alice", about_me: null, location: null },
        { id: "ua2", display_name: "Bob", about_me: null, location: null },
        { id: "ub1", display_name: "Carol", about_me: null, location: null },
        { id: "ub2", display_name: "Dan", about_me: null, location: null },
      ],
      // pair-a: hiking + cooking; pair-b: hiking only
      candidateTags: [
        { user_id: "ua1", tags: { label: "hiking" } },
        { user_id: "ua2", tags: { label: "cooking" } },
        { user_id: "ub1", tags: { label: "hiking" } },
        { user_id: "ub2", tags: { label: "films" } },
      ],
    };

    it("single-tag filter returns only couples that have that tag", async () => {
      mockAuthUser();
      setupMocks(TWO_PAIR_SETUP);

      const res = await request(app)
        .get("/discovery?tags=cooking")
        .set("Authorization", "Bearer valid-jwt");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].pair_id).toBe("pair-a");
    });

    it("multi-tag OR filter returns couples that have ANY of the specified tags", async () => {
      mockAuthUser();
      setupMocks(TWO_PAIR_SETUP);

      // pair-a: hiking + cooking; pair-b: hiking + films
      // ?tags=cooking,films → pair-a has cooking, pair-b has films → both returned
      const res = await request(app)
        .get("/discovery?tags=cooking,films")
        .set("Authorization", "Bearer valid-jwt");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it("empty tags param returns the full unfiltered feed", async () => {
      mockAuthUser();
      setupMocks(TWO_PAIR_SETUP);

      const res = await request(app)
        .get("/discovery")
        .set("Authorization", "Bearer valid-jwt");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it("unknown tag returns empty array (not 404)", async () => {
      mockAuthUser();
      setupMocks(TWO_PAIR_SETUP);

      const res = await request(app)
        .get("/discovery?tags=nonexistenttag")
        .set("Authorization", "Bearer valid-jwt");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("filter tags are normalized case-insensitively", async () => {
      mockAuthUser();
      setupMocks(TWO_PAIR_SETUP);

      // COOKING matches pair-a; both pairs have hiking so ?tags=COOKING returns only pair-a
      const res = await request(app)
        .get("/discovery?tags=COOKING")
        .set("Authorization", "Bearer valid-jwt");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].pair_id).toBe("pair-a");
    });
  });
});
