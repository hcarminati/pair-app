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

const mockAuth = supabase.auth as unknown as { getUser: ReturnType<typeof vi.fn> };
const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

const CURRENT_USER_ID = "user-abc";
const OTHER_USER_ID = "user-xyz";

function mockAuthenticatedUser(userId = CURRENT_USER_ID) {
  mockAuth.getUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── POST /couples/invite ─────────────────────────────────────────────────────

describe("POST /couples/invite", () => {
  it("returns 201 with a new token when user has no existing valid token", async () => {
    mockAuthenticatedUser();
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { partner_id: null },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "invite_tokens") {
        const deleteChain = { eq: vi.fn().mockReturnThis(), or: vi.fn().mockResolvedValue({ error: null }) };
        return {
          delete: vi.fn().mockReturnValue(deleteChain),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
    });

    const res = await request(app)
      .post("/couples/invite")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("expires_at");
    expect(typeof res.body.token).toBe("string");
  });

  it("returns 200 with existing token when user already has a valid one", async () => {
    mockAuthenticatedUser();
    const existingToken = "existing-token-uuid";
    const existingExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { partner_id: null },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "invite_tokens") {
        const deleteChain = { eq: vi.fn().mockReturnThis(), or: vi.fn().mockResolvedValue({ error: null }) };
        return {
          delete: vi.fn().mockReturnValue(deleteChain),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { token: existingToken, expires_at: existingExpiry },
            error: null,
          }),
        };
      }
    });

    const res = await request(app)
      .post("/couples/invite")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body.token).toBe(existingToken);
    expect(res.body.expires_at).toBe(existingExpiry);
  });

  it("returns 400 when user is already paired", async () => {
    mockAuthenticatedUser();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { partner_id: OTHER_USER_ID },
            error: null,
          }),
        }),
      }),
    });

    const res = await request(app)
      .post("/couples/invite")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already paired/i);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const res = await request(app).post("/couples/invite");

    expect(res.status).toBe(401);
  });
});

// ─── POST /couples/link ───────────────────────────────────────────────────────

describe("POST /couples/link", () => {
  function mockValidTokenLookup(overrides: Record<string, unknown> = {}) {
    const tokenData = {
      id: "token-id-1",
      created_by: OTHER_USER_ID,
      used_by: null,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      ...overrides,
    };

    const updateEq = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "invite_tokens") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: tokenData, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: updateEq }),
        };
      }
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { partner_id: null },
                error: null,
              }),
            }),
          }),
        };
      }
    });

    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
  }

  it("returns 200 and links accounts on valid token", async () => {
    mockAuthenticatedUser(CURRENT_USER_ID);
    mockValidTokenLookup();

    const res = await request(app)
      .post("/couples/link")
      .set("Authorization", "Bearer valid-jwt")
      .send({ token: "some-valid-token" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/successfully linked/i);
  });

  it("returns 500 when rpc fails", async () => {
    mockAuthenticatedUser(CURRENT_USER_ID);
    mockValidTokenLookup();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: { message: "DB error" },
    });

    const res = await request(app)
      .post("/couples/link")
      .set("Authorization", "Bearer valid-jwt")
      .send({ token: "some-valid-token" });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to link/i);
  });

  it("returns 400 when user submits their own token", async () => {
    mockAuthenticatedUser(CURRENT_USER_ID);
    mockValidTokenLookup({ created_by: CURRENT_USER_ID });

    const res = await request(app)
      .post("/couples/link")
      .set("Authorization", "Bearer valid-jwt")
      .send({ token: "own-token" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot use your own invite token/i);
  });

  it("returns 400 when token has already been used", async () => {
    mockAuthenticatedUser(CURRENT_USER_ID);
    mockValidTokenLookup({ used_by: "someone-else" });

    const res = await request(app)
      .post("/couples/link")
      .set("Authorization", "Bearer valid-jwt")
      .send({ token: "used-token" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already been used/i);
  });

  it("returns 400 when token has expired", async () => {
    mockAuthenticatedUser(CURRENT_USER_ID);
    mockValidTokenLookup({
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });

    const res = await request(app)
      .post("/couples/link")
      .set("Authorization", "Bearer valid-jwt")
      .send({ token: "expired-token" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/i);
  });

  it("returns 400 when token creator is already paired", async () => {
    mockAuthenticatedUser(CURRENT_USER_ID);

    const updateEq = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "invite_tokens") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "token-id-1",
                  created_by: OTHER_USER_ID,
                  used_by: null,
                  expires_at: new Date(Date.now() + 60_000).toISOString(),
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: updateEq }),
        };
      }
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { partner_id: "already-linked-user" },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: updateEq }),
        };
      }
      if (table === "pairs") {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
    });

    const res = await request(app)
      .post("/couples/link")
      .set("Authorization", "Bearer valid-jwt")
      .send({ token: "creator-paired-token" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already paired/i);
  });

  it("returns 404 when token does not exist", async () => {
    mockAuthenticatedUser();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
        }),
      }),
    });

    const res = await request(app)
      .post("/couples/link")
      .set("Authorization", "Bearer valid-jwt")
      .send({ token: "nonexistent" });

    expect(res.status).toBe(404);
  });

  it("returns 400 when token is missing from body", async () => {
    mockAuthenticatedUser();

    const res = await request(app)
      .post("/couples/link")
      .set("Authorization", "Bearer valid-jwt")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/token is required/i);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const res = await request(app)
      .post("/couples/link")
      .send({ token: "some-token" });

    expect(res.status).toBe(401);
  });
});

// ─── DELETE /couples/link ─────────────────────────────────────────────────────

describe("DELETE /couples/link", () => {
  it("returns 204 on successful unlink", async () => {
    mockAuthenticatedUser();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { partner_id: OTHER_USER_ID },
            error: null,
          }),
        }),
      }),
    });
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

    const res = await request(app)
      .delete("/couples/link")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(204);
    expect(supabase.rpc).toHaveBeenCalledWith("unlink_partners", {
      user_a: CURRENT_USER_ID,
      partner: OTHER_USER_ID,
    });
  });

  it("returns 400 when user is not paired", async () => {
    mockAuthenticatedUser();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { partner_id: null },
            error: null,
          }),
        }),
      }),
    });

    const res = await request(app)
      .delete("/couples/link")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not currently paired/i);
  });

  it("returns 500 when rpc fails", async () => {
    mockAuthenticatedUser();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { partner_id: OTHER_USER_ID },
            error: null,
          }),
        }),
      }),
    });
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: { message: "DB error" },
    });

    const res = await request(app)
      .delete("/couples/link")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to unlink/i);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const res = await request(app).delete("/couples/link");

    expect(res.status).toBe(401);
  });
});
