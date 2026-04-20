import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// Mock the supabase module before importing app
vi.mock("../lib/supabase.js", () => {
  const mockSupabase = {
    auth: {
      admin: {
        createUser: vi.fn(),
        signOut: vi.fn(),
      },
      getUser: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  };
  const mockSupabaseAuthClient = {
    auth: {
      signInWithPassword: vi.fn(),
      refreshSession: vi.fn(),
    },
  };
  return { supabase: mockSupabase, supabaseAuthClient: mockSupabaseAuthClient };
});

const { supabase, supabaseAuthClient } = await import("../lib/supabase.js");
const { app } = await import("../app.js");

const mockAdmin = supabase.auth.admin as unknown as {
  createUser: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
};
const mockAuth = supabase.auth as unknown as {
  getUser: ReturnType<typeof vi.fn>;
};
const mockAuthClient = supabaseAuthClient.auth as unknown as {
  signInWithPassword: ReturnType<typeof vi.fn>;
  refreshSession: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
    insert: vi.fn().mockResolvedValue({ error: null }),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi
      .fn()
      .mockResolvedValue({ data: { partner_id: null }, error: null }),
  });
});

describe("POST /auth/register", () => {
  it("returns 201 with session on successful registration", async () => {
    mockAdmin.createUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "alice@example.com" } },
      error: null,
    });
    mockAuthClient.signInWithPassword.mockResolvedValue({
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

  it("returns 400 when password is too short", async () => {
    const res = await request(app).post("/auth/register").send({
      displayName: "Alice",
      email: "alice@example.com",
      password: "short",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 8 characters/i);
  });

  it("returns 409 when email is already registered", async () => {
    mockAdmin.createUser.mockResolvedValue({
      data: { user: null },
      error: {
        message: "A user with this email address has already been registered",
      },
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
    mockAuthClient.signInWithPassword.mockResolvedValue({
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
      partnerId: null,
    });
  });

  it("returns partnerId when user is linked to a partner", async () => {
    mockAuthClient.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: "user-123", email: "alice@example.com" },
        session: {
          access_token: "access-token-abc",
          refresh_token: "refresh-token-xyz",
        },
      },
      error: null,
    });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      insert: vi.fn(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { partner_id: "partner-456" },
        error: null,
      }),
    });

    const res = await request(app).post("/auth/login").send({
      email: "alice@example.com",
      password: "secret123",
    });

    expect(res.status).toBe(200);
    expect(res.body.partnerId).toBe("partner-456");
  });

  it("returns 401 when password is wrong", async () => {
    mockAuthClient.signInWithPassword.mockResolvedValue({
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

describe("POST /auth/logout", () => {
  it("returns 204 on successful logout", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockAdmin.signOut.mockResolvedValue({ error: null });

    const res = await request(app)
      .post("/auth/logout")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(204);
    expect(mockAdmin.signOut).toHaveBeenCalledWith("valid-token");
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).post("/auth/logout");

    expect(res.status).toBe(401);
  });

  it("returns 500 when Supabase signOut fails", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockAdmin.signOut.mockResolvedValue({
      error: { message: "signOut failed" },
    });

    const res = await request(app)
      .post("/auth/logout")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to log out/i);
  });
});

describe("POST /auth/refresh", () => {
  it("returns 200 with new tokens on valid refresh_token", async () => {
    mockAuthClient.refreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
        },
      },
      error: null,
    });

    const res = await request(app)
      .post("/auth/refresh")
      .send({ refresh_token: "valid-refresh-token" });

    expect(res.status).toBe(200);
    expect(res.body.session.access_token).toBe("new-access-token");
    expect(res.body.session.refresh_token).toBe("new-refresh-token");
  });

  it("returns 401 when refresh_token is expired or invalid", async () => {
    mockAuthClient.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: "Token has expired" },
    });

    const res = await request(app)
      .post("/auth/refresh")
      .send({ refresh_token: "expired-token" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/session expired/i);
  });

  it("returns 400 when refresh_token is missing", async () => {
    const res = await request(app).post("/auth/refresh").send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/refresh_token is required/i);
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
