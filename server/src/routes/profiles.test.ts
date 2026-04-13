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

const USER_ID = "user-profile-123";
const USER_EMAIL = "test@example.com";

function mockAuthenticatedUser(userId = USER_ID, email = USER_EMAIL) {
  mockAuth.getUser.mockResolvedValue({
    data: { user: { id: userId, email } },
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /profiles/me ─────────────────────────────────────────────────────────

describe("GET /profiles/me", () => {
  it("returns all profile fields including email and tags", async () => {
    mockAuthenticatedUser();
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  display_name: "Alex",
                  about_me: "Love hiking",
                  location: "Portland, OR",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "user_tags") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { tags: { label: "hiking" } },
                { tags: { label: "cooking" } },
              ],
              error: null,
            }),
          }),
        };
      }
    });

    const res = await request(app)
      .get("/profiles/me")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body.display_name).toBe("Alex");
    expect(res.body.about_me).toBe("Love hiking");
    expect(res.body.location).toBe("Portland, OR");
    expect(res.body.email).toBe(USER_EMAIL);
    expect(res.body.tags).toEqual(["hiking", "cooking"]);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const res = await request(app).get("/profiles/me");

    expect(res.status).toBe(401);
  });

  it("returns 404 when profile not found", async () => {
    mockAuthenticatedUser();
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Not found" },
              }),
            }),
          }),
        };
      }
    });

    const res = await request(app)
      .get("/profiles/me")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(404);
  });
});

// ─── PATCH /profiles/me ───────────────────────────────────────────────────────

describe("PATCH /profiles/me", () => {
  it("persists all fields atomically in a single request", async () => {
    mockAuthenticatedUser();
    let profileUpdateCalled = false;
    let userTagsDeleteCalled = false;
    let userTagsInsertCalled = false;

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          update: vi
            .fn()
            .mockImplementation((body: Record<string, unknown>) => {
              expect(body).toMatchObject({
                display_name: "Alex",
                about_me: "Love hiking",
                location: "Portland, OR",
              });
              profileUpdateCalled = true;
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
        };
      }
      if (table === "user_tags") {
        return {
          delete: vi.fn().mockImplementation(() => {
            userTagsDeleteCalled = true;
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
          insert: vi.fn().mockImplementation(() => {
            userTagsInsertCalled = true;
            return Promise.resolve({ error: null });
          }),
        };
      }
      if (table === "tags") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "tag-id-1" },
                error: null,
              }),
            }),
          }),
        };
      }
    });

    const res = await request(app)
      .patch("/profiles/me")
      .set("Authorization", "Bearer valid-jwt")
      .send({
        display_name: "Alex",
        about_me: "Love hiking",
        location: "Portland, OR",
        tags: ["hiking"],
      });

    expect(res.status).toBe(200);
    expect(profileUpdateCalled).toBe(true);
    expect(userTagsDeleteCalled).toBe(true);
    expect(userTagsInsertCalled).toBe(true);
  });

  it("normalizes and deduplicates tags before insert", async () => {
    mockAuthenticatedUser();
    let capturedUserTagInsert: { user_id: string; tag_id: string }[] = [];

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "user_tags") {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          insert: vi
            .fn()
            .mockImplementation(
              (rows: { user_id: string; tag_id: string }[]) => {
                capturedUserTagInsert = rows;
                return Promise.resolve({ error: null });
              },
            ),
        };
      }
      if (table === "tags") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "tag-id-hiking" },
                error: null,
              }),
            }),
          }),
        };
      }
    });

    const res = await request(app)
      .patch("/profiles/me")
      .set("Authorization", "Bearer valid-jwt")
      .send({
        tags: ["  Hiking  ", "HIKING", "hiking"],
      });

    expect(res.status).toBe(200);
    // After normalize+dedup, only one "hiking" entry
    expect(capturedUserTagInsert).toHaveLength(1);
    expect(capturedUserTagInsert[0]!.tag_id).toBe("tag-id-hiking");
  });

  it("removes tags not present in new payload", async () => {
    mockAuthenticatedUser();
    let deleteEqArg: string | null = null;

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "user_tags") {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              if (col === "user_id") deleteEqArg = val;
              return Promise.resolve({ error: null });
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === "tags") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "tag-id-1" },
                error: null,
              }),
            }),
          }),
        };
      }
    });

    const res = await request(app)
      .patch("/profiles/me")
      .set("Authorization", "Bearer valid-jwt")
      .send({ tags: ["cooking"] });

    expect(res.status).toBe(200);
    // Confirms all existing tags were wiped for this user
    expect(deleteEqArg).toBe(USER_ID);
  });

  it("returns 422 when more than 10 tags after deduplication", async () => {
    mockAuthenticatedUser();

    const res = await request(app)
      .patch("/profiles/me")
      .set("Authorization", "Bearer valid-jwt")
      .send({
        tags: [
          "tag1",
          "tag2",
          "tag3",
          "tag4",
          "tag5",
          "tag6",
          "tag7",
          "tag8",
          "tag9",
          "tag10",
          "tag11",
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/cannot have more than 10 tags/i);
  });

  it("email field is not present in PATCH payload processing", async () => {
    mockAuthenticatedUser();
    let capturedProfileUpdate: Record<string, unknown> = {};

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          update: vi
            .fn()
            .mockImplementation((body: Record<string, unknown>) => {
              capturedProfileUpdate = body;
              return { eq: vi.fn().mockResolvedValue({ error: null }) };
            }),
        };
      }
      if (table === "user_tags") {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === "tags") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "tag-id-1" },
                error: null,
              }),
            }),
          }),
        };
      }
    });

    const res = await request(app)
      .patch("/profiles/me")
      .set("Authorization", "Bearer valid-jwt")
      .send({
        display_name: "Alex",
        email: "hacker@example.com", // should be ignored
        tags: ["hiking"],
      });

    expect(res.status).toBe(200);
    expect(capturedProfileUpdate).not.toHaveProperty("email");
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const res = await request(app).patch("/profiles/me").send({ tags: [] });

    expect(res.status).toBe(401);
  });

  it("returns 400 when tags is not an array", async () => {
    mockAuthenticatedUser();

    const res = await request(app)
      .patch("/profiles/me")
      .set("Authorization", "Bearer valid-jwt")
      .send({ tags: "hiking" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tags must be an array/i);
  });

  it("handles empty tags array (removes all tags)", async () => {
    mockAuthenticatedUser();
    let deleteEqArg: string | null = null;

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "user_tags") {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              if (col === "user_id") deleteEqArg = val;
              return Promise.resolve({ error: null });
            }),
          }),
        };
      }
    });

    const res = await request(app)
      .patch("/profiles/me")
      .set("Authorization", "Bearer valid-jwt")
      .send({ tags: [] });

    expect(res.status).toBe(200);
    expect(deleteEqArg).toBe(USER_ID);
  });
});
