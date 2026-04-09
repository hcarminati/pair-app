import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../lib/supabase.js", () => {
  const mockSupabase = {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
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

function mockAuthenticatedUser(userId = USER_ID) {
  mockAuth.getUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

function mockSuccessfulSave(tagRows: { id: string; label: string }[]) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "tags") {
      return {
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: tagRows, error: null }),
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
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /users/me/interests", () => {
  it("persists all tags and returns 200 with saved labels", async () => {
    mockAuthenticatedUser();
    mockSuccessfulSave([
      { id: "t1", label: "hiking" },
      { id: "t2", label: "cooking" },
    ]);

    const res = await request(app)
      .patch("/users/me/interests")
      .set("Authorization", "Bearer valid-jwt")
      .send({ tags: ["hiking", "cooking"] });

    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual(["hiking", "cooking"]);
  });

  it("calls upsert, delete, and insert in sequence (bulk transaction)", async () => {
    mockAuthenticatedUser();
    const tagRows = [{ id: "t1", label: "hiking" }];

    const upsertSelect = vi.fn().mockResolvedValue({ data: tagRows, error: null });
    const upsertFn = vi.fn().mockReturnValue({ select: upsertSelect });
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const deleteFn = vi.fn().mockReturnValue({ eq: deleteEq });
    const insertFn = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "tags") return { upsert: upsertFn };
      if (table === "user_tags") return { delete: deleteFn, insert: insertFn };
    });

    const res = await request(app)
      .patch("/users/me/interests")
      .set("Authorization", "Bearer valid-jwt")
      .send({ tags: ["hiking"] });

    expect(res.status).toBe(200);
    expect(upsertFn).toHaveBeenCalledWith(
      [{ label: "hiking", is_custom: false }],
      { onConflict: "label" },
    );
    expect(deleteFn).toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(insertFn).toHaveBeenCalledWith([
      { user_id: USER_ID, tag_id: "t1" },
    ]);
  });

  it("returns 422 when more than 10 tags are submitted", async () => {
    mockAuthenticatedUser();

    const res = await request(app)
      .patch("/users/me/interests")
      .set("Authorization", "Bearer valid-jwt")
      .send({ tags: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"] });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/cannot save more than 10/i);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("deduplicates tags after normalization before insert", async () => {
    mockAuthenticatedUser();

    const upsertSelect = vi
      .fn()
      .mockResolvedValue({ data: [{ id: "t1", label: "hiking" }], error: null });
    const upsertFn = vi.fn().mockReturnValue({ select: upsertSelect });
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const deleteFn = vi.fn().mockReturnValue({ eq: deleteEq });
    const insertFn = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "tags") return { upsert: upsertFn };
      if (table === "user_tags") return { delete: deleteFn, insert: insertFn };
    });

    const res = await request(app)
      .patch("/users/me/interests")
      .set("Authorization", "Bearer valid-jwt")
      .send({ tags: ["hiking", "HIKING", "  hiking  "] });

    expect(res.status).toBe(200);
    expect(upsertFn).toHaveBeenCalledWith(
      [{ label: "hiking", is_custom: false }],
      { onConflict: "label" },
    );
  });

  it("returns 200 and skips all DB calls when tags array is empty", async () => {
    mockAuthenticatedUser();

    const res = await request(app)
      .patch("/users/me/interests")
      .set("Authorization", "Bearer valid-jwt")
      .send({ tags: [] });

    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 400 when tags is not an array", async () => {
    mockAuthenticatedUser();

    const res = await request(app)
      .patch("/users/me/interests")
      .set("Authorization", "Bearer valid-jwt")
      .send({ tags: "not-an-array" });

    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const res = await request(app)
      .patch("/users/me/interests")
      .send({ tags: ["hiking"] });

    expect(res.status).toBe(401);
  });
});
