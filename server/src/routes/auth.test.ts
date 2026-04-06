import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// Mock the supabase module before importing app
vi.mock("../lib/supabase.js", () => {
  const mockSupabase = {
    auth: {
      admin: {
        createUser: vi.fn(),
        getUserById: vi.fn(),
      },
      signInWithPassword: vi.fn(),
      getUser: vi.fn(),
      refreshSession: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  };
  return { supabase: mockSupabase };
});

const { supabase } = await import("../lib/supabase.js");
const { app } = await import("../app.js");

const mockAdmin = supabase.auth.admin as {
  createUser: ReturnType<typeof vi.fn>;
  getUserById: ReturnType<typeof vi.fn>;
};
const mockAuth = supabase.auth as {
  signInWithPassword: ReturnType<typeof vi.fn>;
  getUser: ReturnType<typeof vi.fn>;
  refreshSession: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
    insert: vi.fn().mockResolvedValue({ error: null }),
  });
});

describe("POST /auth/register", () => {
  it("returns 201 with session on successful registration", async () => {
    mockAdmin.createUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "alice@example.com" } },
      error: null,
    });
    mockAuth.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: "user-123", email: "alice@example.com" },
        session: {
          access_token: "access-token-abc",
          refresh_token: "refresh-token-xyz",
        },
      },
      error: null,
    });

    const res = await request(app).post("/auth/register").send({
      displayName: "Alice",
      email: "alice@example.com",
      password: "secret123",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      user: { id: "user-123", email: "alice@example.com" },
      session: { access_token: "access-token-abc" },
    });
  });

  it("returns 400 when user provides their own invite token", async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "token-id-1",
              created_by: "partner-user-id",
              used_by: null,
              expires_at: new Date(Date.now() + 60_000).toISOString(),
            },
            error: null,
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
    mockAdmin.getUserById.mockResolvedValue({
      data: { user: { email: "alice@example.com" } },
    });

    const res = await request(app).post("/auth/register").send({
      displayName: "Alice",
      email: "alice@example.com",
      password: "secret123",
      inviteToken: "some-token",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot use your own invite token/i);
  });

  it("returns 400 when invite token does not exist", async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const res = await request(app).post("/auth/register").send({
      displayName: "Alice",
      email: "alice@example.com",
      password: "secret123",
      inviteToken: "nonexistent-token",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it("returns 400 when invite token has already been used", async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "token-id-1",
              created_by: "partner-user-id",
              used_by: "someone-else",
              expires_at: new Date(Date.now() + 60_000).toISOString(),
            },
            error: null,
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const res = await request(app).post("/auth/register").send({
      displayName: "Alice",
      email: "alice@example.com",
      password: "secret123",
      inviteToken: "used-token",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already been used/i);
  });

  it("returns 400 when invite token has expired", async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "token-id-1",
              created_by: "partner-user-id",
              used_by: null,
              expires_at: new Date(Date.now() - 60_000).toISOString(),
            },
            error: null,
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const res = await request(app).post("/auth/register").send({
      displayName: "Alice",
      email: "alice@example.com",
      password: "secret123",
      inviteToken: "expired-token",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/i);
  });

  it("returns 409 when email is already registered", async () => {
    mockAdmin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: "A user with this email address has already been registered" },
    });

    const res = await request(app).post("/auth/register").send({
      displayName: "Alice",
      email: "alice@example.com",
      password: "secret123",
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });
});

describe("POST /auth/login", () => {
  it("returns 200 with session on successful login", async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: "user-123", email: "alice@example.com" },
        session: {
          access_token: "access-token-abc",
          refresh_token: "refresh-token-xyz",
        },
      },
      error: null,
    });

    const res = await request(app).post("/auth/login").send({
      email: "alice@example.com",
      password: "secret123",
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      user: { email: "alice@example.com" },
      session: { access_token: "access-token-abc" },
    });
  });

  it("returns 401 when password is wrong", async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    const res = await request(app).post("/auth/login").send({
      email: "alice@example.com",
      password: "wrongpassword",
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });
});

describe("verifyToken middleware", () => {
  // Use a protected route to test the middleware. We'll add a test route to app for this.
  // Instead, test indirectly via a route that uses verifyToken.
  // Since /health is unprotected, we need to check the middleware directly.
  // We test it by adding auth header scenarios to any route that uses verifyToken.
  // For now, we verify middleware behavior via the auth.ts middleware unit logic.

  it("returns 401 when Authorization header is missing", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Missing token" },
    });

    // We need a route that uses verifyToken. Let's test using a real protected
    // endpoint by temporarily checking the middleware directly.
    // Since no protected routes exist yet beyond auth, we test the middleware module.
    const { verifyToken } = await import("../middleware/auth.js");

    const mockReq = { headers: {} } as import("express").Request;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      locals: {},
    } as unknown as import("express").Response;
    const mockNext = vi.fn();

    await verifyToken(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("returns 401 when token is expired or invalid", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Token has expired" },
    });

    const { verifyToken } = await import("../middleware/auth.js");

    const mockReq = {
      headers: { authorization: "Bearer expired-token" },
    } as import("express").Request;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      locals: {},
    } as unknown as import("express").Response;
    const mockNext = vi.fn();

    await verifyToken(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });
});
