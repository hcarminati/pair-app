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

const USER_ID = "user-a1";
const PARTNER_ID = "user-a2";
const OTHER_USER_A = "user-b1";
const OTHER_USER_B = "user-b2";
const REQUEST_ID = "req-001";
const MESSAGE_ID = "msg-001";

const CONNECTED_REQUEST = {
  id: REQUEST_ID,
  couple_1_user_a: USER_ID,
  couple_1_user_b: PARTNER_ID,
  couple_2_user_a: OTHER_USER_A,
  couple_2_user_b: OTHER_USER_B,
  status: "CONNECTED",
};

const MESSAGES = [
  {
    id: "msg-001",
    request_id: REQUEST_ID,
    sender_id: USER_ID,
    content: "Hey there!",
    created_at: "2026-01-01T10:00:00Z",
  },
  {
    id: "msg-002",
    request_id: REQUEST_ID,
    sender_id: OTHER_USER_A,
    content: "Hi! How are you?",
    created_at: "2026-01-01T10:01:00Z",
  },
];

function mockAuthenticatedUser(userId = USER_ID) {
  mockAuth.getUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

function mockUnauthenticated() {
  mockAuth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: "Not authenticated" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /messages/:request_id ────────────────────────────────────────────────

type GetMessagesMockOptions = {
  connectionRequest?: Record<string, unknown> | null;
  messages?: Record<string, unknown>[];
};

function setupGetMessagesMocks({
  connectionRequest = CONNECTED_REQUEST,
  messages = MESSAGES,
}: GetMessagesMockOptions = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "connection_requests") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: connectionRequest,
              error: connectionRequest ? null : { message: "Not found" },
            }),
          }),
        }),
      };
    }

    if (table === "messages") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: messages, error: null }),
          }),
        }),
      };
    }
  });
}

describe("GET /messages/:request_id", () => {
  it("returns 401 if unauthenticated", async () => {
    mockUnauthenticated();

    const res = await request(app).get(`/messages/${REQUEST_ID}`);

    expect(res.status).toBe(401);
  });

  it("returns 404 if the connection request does not exist", async () => {
    mockAuthenticatedUser();
    setupGetMessagesMocks({ connectionRequest: null });

    const res = await request(app)
      .get(`/messages/${REQUEST_ID}`)
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(404);
  });

  it("returns 403 if the connection request status is not CONNECTED", async () => {
    mockAuthenticatedUser();
    setupGetMessagesMocks({
      connectionRequest: { ...CONNECTED_REQUEST, status: "REQUEST_PENDING" },
    });

    const res = await request(app)
      .get(`/messages/${REQUEST_ID}`)
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(403);
  });

  it("returns 403 if the authenticated user is not a participant", async () => {
    mockAuthenticatedUser("outsider-user");
    setupGetMessagesMocks();

    const res = await request(app)
      .get(`/messages/${REQUEST_ID}`)
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(403);
  });

  it("returns 200 and the messages array for a participant in couple 1", async () => {
    mockAuthenticatedUser(USER_ID);
    setupGetMessagesMocks();

    const res = await request(app)
      .get(`/messages/${REQUEST_ID}`)
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      id: "msg-001",
      content: "Hey there!",
      sender_id: USER_ID,
      request_id: REQUEST_ID,
    });
  });

  it("allows each of the 4 participants to read messages", async () => {
    for (const userId of [USER_ID, PARTNER_ID, OTHER_USER_A, OTHER_USER_B]) {
      vi.clearAllMocks();
      mockAuthenticatedUser(userId);
      setupGetMessagesMocks();

      const res = await request(app)
        .get(`/messages/${REQUEST_ID}`)
        .set("Authorization", "Bearer valid-jwt");

      expect(res.status).toBe(200);
    }
  });

  it("returns an empty array when the thread has no messages", async () => {
    mockAuthenticatedUser();
    setupGetMessagesMocks({ messages: [] });

    const res = await request(app)
      .get(`/messages/${REQUEST_ID}`)
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns messages ordered by created_at ascending (oldest first)", async () => {
    mockAuthenticatedUser();
    setupGetMessagesMocks();

    const res = await request(app)
      .get(`/messages/${REQUEST_ID}`)
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(new Date(res.body[0].created_at).getTime()).toBeLessThan(
      new Date(res.body[1].created_at).getTime(),
    );
  });

  it("does not leak raw error details to the client on database failure", async () => {
    mockAuthenticatedUser();
    mockFrom.mockImplementation((table: string) => {
      if (table === "connection_requests") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: CONNECTED_REQUEST,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "messages") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi
                .fn()
                .mockResolvedValue({
                  data: null,
                  error: { message: "DB internal error with sensitive info" },
                }),
            }),
          }),
        };
      }
    });

    const res = await request(app)
      .get(`/messages/${REQUEST_ID}`)
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("sensitive info");
  });
});

// ─── POST /messages/:request_id ───────────────────────────────────────────────

type PostMessageMockOptions = {
  connectionRequest?: Record<string, unknown> | null;
  insertedMessage?: Record<string, unknown> | null;
  insertError?: Record<string, unknown> | null;
};

function setupPostMessageMocks({
  connectionRequest = CONNECTED_REQUEST,
  insertedMessage = {
    id: MESSAGE_ID,
    request_id: REQUEST_ID,
    sender_id: USER_ID,
    content: "Hello!",
    created_at: "2026-01-01T10:00:00Z",
  },
  insertError = null,
}: PostMessageMockOptions = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "connection_requests") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: connectionRequest,
              error: connectionRequest ? null : { message: "Not found" },
            }),
          }),
        }),
      };
    }

    if (table === "messages") {
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: insertedMessage,
              error: insertError,
            }),
          }),
        }),
      };
    }
  });
}

describe("POST /messages/:request_id", () => {
  it("returns 401 if unauthenticated", async () => {
    mockUnauthenticated();

    const res = await request(app)
      .post(`/messages/${REQUEST_ID}`)
      .send({ content: "Hello!" });

    expect(res.status).toBe(401);
  });

  it("returns 400 if content is missing from the request body", async () => {
    mockAuthenticatedUser();
    setupPostMessageMocks();

    const res = await request(app)
      .post(`/messages/${REQUEST_ID}`)
      .set("Authorization", "Bearer valid-jwt")
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 400 if content is an empty string", async () => {
    mockAuthenticatedUser();
    setupPostMessageMocks();

    const res = await request(app)
      .post(`/messages/${REQUEST_ID}`)
      .set("Authorization", "Bearer valid-jwt")
      .send({ content: "" });

    expect(res.status).toBe(400);
  });

  it("returns 400 if content is only whitespace", async () => {
    mockAuthenticatedUser();
    setupPostMessageMocks();

    const res = await request(app)
      .post(`/messages/${REQUEST_ID}`)
      .set("Authorization", "Bearer valid-jwt")
      .send({ content: "   " });

    expect(res.status).toBe(400);
  });

  it("returns 404 if the connection request does not exist", async () => {
    mockAuthenticatedUser();
    setupPostMessageMocks({ connectionRequest: null });

    const res = await request(app)
      .post(`/messages/${REQUEST_ID}`)
      .set("Authorization", "Bearer valid-jwt")
      .send({ content: "Hello!" });

    expect(res.status).toBe(404);
  });

  it("returns 403 if the connection request status is not CONNECTED", async () => {
    mockAuthenticatedUser();
    setupPostMessageMocks({
      connectionRequest: { ...CONNECTED_REQUEST, status: "REQUEST_PENDING" },
    });

    const res = await request(app)
      .post(`/messages/${REQUEST_ID}`)
      .set("Authorization", "Bearer valid-jwt")
      .send({ content: "Hello!" });

    expect(res.status).toBe(403);
  });

  it("returns 403 if the authenticated user is not a participant", async () => {
    mockAuthenticatedUser("outsider-user");
    setupPostMessageMocks();

    const res = await request(app)
      .post(`/messages/${REQUEST_ID}`)
      .set("Authorization", "Bearer valid-jwt")
      .send({ content: "Hello!" });

    expect(res.status).toBe(403);
  });

  it("returns 201 and the created message for a valid participant", async () => {
    mockAuthenticatedUser();
    setupPostMessageMocks();

    const res = await request(app)
      .post(`/messages/${REQUEST_ID}`)
      .set("Authorization", "Bearer valid-jwt")
      .send({ content: "Hello!" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: MESSAGE_ID,
      request_id: REQUEST_ID,
      sender_id: USER_ID,
      content: "Hello!",
    });
    expect(res.body.created_at).toBeDefined();
  });

  it("allows each of the 4 participants to post a message", async () => {
    for (const userId of [USER_ID, PARTNER_ID, OTHER_USER_A, OTHER_USER_B]) {
      vi.clearAllMocks();
      mockAuthenticatedUser(userId);
      setupPostMessageMocks({
        insertedMessage: {
          id: MESSAGE_ID,
          request_id: REQUEST_ID,
          sender_id: userId,
          content: "Hello!",
          created_at: "2026-01-01T10:00:00Z",
        },
      });

      const res = await request(app)
        .post(`/messages/${REQUEST_ID}`)
        .set("Authorization", "Bearer valid-jwt")
        .send({ content: "Hello!" });

      expect(res.status).toBe(201);
    }
  });

  it("uses sender_id from the JWT — ignores any sender_id in the request body", async () => {
    mockAuthenticatedUser(USER_ID);
    setupPostMessageMocks();

    const res = await request(app)
      .post(`/messages/${REQUEST_ID}`)
      .set("Authorization", "Bearer valid-jwt")
      .send({ content: "Hello!", sender_id: "malicious-user-id" });

    // Route must succeed; the sender_id in the response must be the JWT user, not the body value
    expect(res.status).toBe(201);
    expect(res.body.sender_id).toBe(USER_ID);
    expect(res.body.sender_id).not.toBe("malicious-user-id");
  });
});
