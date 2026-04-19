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
const MY_PAIR_ID = "pair-me";
const TARGET_PAIR_ID = "pair-target";
const TARGET_USER_A = "user-b1";
const TARGET_USER_B = "user-b2";
const REQUEST_ID = "req-001";

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

// ─── POST /connections/interest ───────────────────────────────────────────────

type InterestMockOptions = {
  myProfile?: Record<string, unknown> | null;
  myPair?: Record<string, unknown> | null;
  targetPair?: Record<string, unknown> | null;
  existingRequests?: Record<string, unknown>[];
  newRequest?: Record<string, unknown> | null;
  participantsInsertError?: Record<string, unknown> | null;
};

function setupInterestMocks({
  myProfile = { partner_id: PARTNER_ID },
  myPair = { id: MY_PAIR_ID },
  targetPair = {
    id: TARGET_PAIR_ID,
    profile_id_1: TARGET_USER_A,
    profile_id_2: TARGET_USER_B,
  },
  existingRequests = [],
  newRequest = {
    id: REQUEST_ID,
    couple_1_user_a: USER_ID,
    couple_1_user_b: PARTNER_ID,
    couple_2_user_a: TARGET_USER_A,
    couple_2_user_b: TARGET_USER_B,
    status: "INTEREST_PENDING",
  },
  participantsInsertError = null,
}: InterestMockOptions = {}) {
  let profileCallCount = 0;
  let pairsCallCount = 0;

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
    }

    if (table === "pairs") {
      pairsCallCount++;
      if (pairsCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: myPair,
                error: myPair ? null : { message: "Not found" },
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: targetPair,
              error: targetPair ? null : { message: "Not found" },
            }),
          }),
        }),
      };
    }

    if (table === "connection_requests") {
      return {
        select: vi.fn().mockReturnValue({
          or: vi
            .fn()
            .mockResolvedValue({ data: existingRequests, error: null }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: newRequest,
              error: newRequest ? null : { message: "Insert failed" },
            }),
          }),
        }),
      };
    }

    if (table === "connection_request_participants") {
      return {
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: participantsInsertError,
        }),
      };
    }
  });
}

describe("POST /connections/interest", () => {
  it("returns 201 and creates a connection request when none exists", async () => {
    mockAuthenticatedUser();
    setupInterestMocks();

    const res = await request(app)
      .post("/connections/interest")
      .set("Authorization", "Bearer valid-jwt")
      .send({ target_pair_id: TARGET_PAIR_ID });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(REQUEST_ID);
    expect(res.body.status).toBe("INTEREST_PENDING");
    expect(res.body.couple_1_user_a).toBe(USER_ID);
    expect(res.body.couple_1_user_b).toBe(PARTNER_ID);
    expect(res.body.couple_2_user_a).toBe(TARGET_USER_A);
    expect(res.body.couple_2_user_b).toBe(TARGET_USER_B);
  });

  it("sets initiating partner's interested flag to true via participants insert", async () => {
    mockAuthenticatedUser();
    setupInterestMocks();

    await request(app)
      .post("/connections/interest")
      .set("Authorization", "Bearer valid-jwt")
      .send({ target_pair_id: TARGET_PAIR_ID });

    const participantsMock = mockFrom.mock.results.find((r) => {
      return (
        r.value &&
        typeof r.value === "object" &&
        "insert" in r.value &&
        !("select" in r.value)
      );
    });
    expect(participantsMock).toBeDefined();

    const insertArg = participantsMock?.value.insert.mock
      .calls[0]?.[0] as Array<{
      user_id: string;
      interested: boolean;
    }>;
    const initiator = insertArg?.find((p) => p.user_id === USER_ID);
    expect(initiator?.interested).toBe(true);
    const partner = insertArg?.find((p) => p.user_id === PARTNER_ID);
    expect(partner?.interested).toBe(false);
  });

  it("returns 200 with existing request when one already exists (duplicate prevention)", async () => {
    mockAuthenticatedUser();
    const existingRequest = {
      id: "req-existing",
      couple_1_user_a: USER_ID,
      couple_1_user_b: PARTNER_ID,
      couple_2_user_a: TARGET_USER_A,
      couple_2_user_b: TARGET_USER_B,
      status: "INTEREST_PENDING",
    };
    setupInterestMocks({ existingRequests: [existingRequest] });

    const res = await request(app)
      .post("/connections/interest")
      .set("Authorization", "Bearer valid-jwt")
      .send({ target_pair_id: TARGET_PAIR_ID });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("req-existing");
  });

  it("returns 200 with existing request when request exists in reverse direction", async () => {
    mockAuthenticatedUser();
    const existingRequest = {
      id: "req-reverse",
      couple_1_user_a: TARGET_USER_A,
      couple_1_user_b: TARGET_USER_B,
      couple_2_user_a: USER_ID,
      couple_2_user_b: PARTNER_ID,
      status: "INTEREST_PENDING",
    };
    setupInterestMocks({ existingRequests: [existingRequest] });

    const res = await request(app)
      .post("/connections/interest")
      .set("Authorization", "Bearer valid-jwt")
      .send({ target_pair_id: TARGET_PAIR_ID });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("req-reverse");
  });

  it("returns 403 when user is not linked with a partner", async () => {
    mockAuthenticatedUser();
    setupInterestMocks({ myProfile: { partner_id: null } });

    const res = await request(app)
      .post("/connections/interest")
      .set("Authorization", "Bearer valid-jwt")
      .send({ target_pair_id: TARGET_PAIR_ID });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/linked with a partner/i);
  });

  it("returns 400 when target_pair_id is missing", async () => {
    mockAuthenticatedUser();

    const res = await request(app)
      .post("/connections/interest")
      .set("Authorization", "Bearer valid-jwt")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/target_pair_id/i);
  });

  it("returns 404 when target couple does not exist", async () => {
    mockAuthenticatedUser();
    setupInterestMocks({ targetPair: null });

    const res = await request(app)
      .post("/connections/interest")
      .set("Authorization", "Bearer valid-jwt")
      .send({ target_pair_id: "nonexistent-pair" });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/target couple not found/i);
  });

  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();

    const res = await request(app)
      .post("/connections/interest")
      .send({ target_pair_id: TARGET_PAIR_ID });

    expect(res.status).toBe(401);
  });
});

// ─── POST /connections/:id/align ──────────────────────────────────────────────

const ALIGN_REQUEST_DATA = {
  id: REQUEST_ID,
  couple_1_user_a: USER_ID,
  couple_1_user_b: PARTNER_ID,
  status: "INTEREST_PENDING",
};

type AlignMockOptions = {
  requestData?: Record<string, unknown> | null;
  couple1ParticipantRows?: { interested: boolean }[];
  updatedStatus?: string;
};

function setupAlignMocks({
  requestData = ALIGN_REQUEST_DATA as Record<string, unknown> | null,
  couple1ParticipantRows = [{ interested: true }, { interested: false }],
  updatedStatus = "INTEREST_PENDING",
}: AlignMockOptions = {}) {
  let crCallCount = 0;
  let participantsCallCount = 0;

  mockFrom.mockImplementation((table: string) => {
    if (table === "connection_requests") {
      crCallCount++;
      if (crCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: requestData,
                error: requestData ? null : { message: "Not found" },
              }),
            }),
          }),
        };
      }
      // Subsequent calls: status update or final fetch
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...requestData, status: updatedStatus },
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "connection_request_participants") {
      participantsCallCount++;
      if (participantsCallCount === 1) {
        // update({interested: true}).eq().eq()
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      // select("interested").eq().in() — couple_1 participants check
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: couple1ParticipantRows,
              error: null,
            }),
          }),
        }),
      };
    }
  });
}

describe("POST /connections/:id/align", () => {
  it("returns 200 with INTEREST_PENDING when only this partner has aligned", async () => {
    mockAuthenticatedUser();
    setupAlignMocks({
      couple1ParticipantRows: [{ interested: true }, { interested: false }],
      updatedStatus: "INTEREST_PENDING",
    });

    const res = await request(app)
      .post(`/connections/${REQUEST_ID}/align`)
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
  });

  it("returns 200 with INTEREST_ALIGNED when both couple_1 partners have aligned", async () => {
    mockAuthenticatedUser();
    setupAlignMocks({
      couple1ParticipantRows: [{ interested: true }, { interested: true }],
      updatedStatus: "INTEREST_ALIGNED",
    });

    const res = await request(app)
      .post(`/connections/${REQUEST_ID}/align`)
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("INTEREST_ALIGNED");
  });

  it("returns 404 when request does not exist", async () => {
    mockAuthenticatedUser();
    setupAlignMocks({ requestData: null });

    const res = await request(app)
      .post(`/connections/${REQUEST_ID}/align`)
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("returns 403 when user is not in couple_1", async () => {
    mockAuthenticatedUser();
    setupAlignMocks({
      requestData: {
        id: REQUEST_ID,
        couple_1_user_a: "other-user-x",
        couple_1_user_b: "other-user-y",
        status: "INTEREST_PENDING",
      },
    });

    const res = await request(app)
      .post(`/connections/${REQUEST_ID}/align`)
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });

  it("returns 400 when request is not in INTEREST_PENDING status", async () => {
    mockAuthenticatedUser();
    setupAlignMocks({
      requestData: { ...ALIGN_REQUEST_DATA, status: "INTEREST_ALIGNED" },
    });

    const res = await request(app)
      .post(`/connections/${REQUEST_ID}/align`)
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/INTEREST_PENDING/);
  });

  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();

    const res = await request(app).post(`/connections/${REQUEST_ID}/align`);

    expect(res.status).toBe(401);
  });
});

// ─── POST /connections/:id/respond ────────────────────────────────────────────

const RESPOND_REQUEST_DATA = {
  id: REQUEST_ID,
  couple_1_user_a: "user-c1a",
  couple_1_user_b: "user-c1b",
  couple_2_user_a: USER_ID,
  couple_2_user_b: PARTNER_ID,
  status: "REQUEST_PENDING",
};

type RespondMockOptions = {
  requestData?: Record<string, unknown> | null;
  c2ParticipantRows?: { user_id: string; interested: boolean }[];
};

function setupRespondMocks({
  requestData = RESPOND_REQUEST_DATA as Record<string, unknown> | null,
  c2ParticipantRows = [
    { user_id: USER_ID, interested: true },
    { user_id: PARTNER_ID, interested: false },
  ],
}: RespondMockOptions = {}) {
  let crCallCount = 0;
  let participantsCallCount = 0;

  mockFrom.mockImplementation((table: string) => {
    if (table === "connection_requests") {
      crCallCount++;
      if (crCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: requestData,
                error: requestData ? null : { message: "Not found" },
              }),
            }),
          }),
        };
      }
      // update (decline or connect)
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    }

    if (table === "connection_request_participants") {
      participantsCallCount++;
      if (participantsCallCount === 1) {
        // update({interested: true}).eq().eq()
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      // select("user_id, interested").eq().in() — couple_2 check
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: c2ParticipantRows,
              error: null,
            }),
          }),
        }),
      };
    }
  });
}

describe("POST /connections/:id/respond", () => {
  it("returns 200 DECLINED when accept=false", async () => {
    mockAuthenticatedUser();
    setupRespondMocks();

    const res = await request(app)
      .post(`/connections/${REQUEST_ID}/respond`)
      .set("Authorization", "Bearer valid-jwt")
      .send({ accept: false });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("DECLINED");
  });

  it("returns 200 ACCEPTED when accept=true and partner has not yet responded", async () => {
    mockAuthenticatedUser();
    setupRespondMocks({
      c2ParticipantRows: [
        { user_id: USER_ID, interested: true },
        { user_id: PARTNER_ID, interested: false },
      ],
    });

    const res = await request(app)
      .post(`/connections/${REQUEST_ID}/respond`)
      .set("Authorization", "Bearer valid-jwt")
      .send({ accept: true });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ACCEPTED");
  });

  it("returns 200 CONNECTED when accept=true and partner already accepted", async () => {
    mockAuthenticatedUser();
    setupRespondMocks({
      c2ParticipantRows: [
        { user_id: USER_ID, interested: true },
        { user_id: PARTNER_ID, interested: true },
      ],
    });

    const res = await request(app)
      .post(`/connections/${REQUEST_ID}/respond`)
      .set("Authorization", "Bearer valid-jwt")
      .send({ accept: true });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CONNECTED");
  });

  it("returns 400 when accept is not a boolean", async () => {
    mockAuthenticatedUser();
    setupRespondMocks();

    const res = await request(app)
      .post(`/connections/${REQUEST_ID}/respond`)
      .set("Authorization", "Bearer valid-jwt")
      .send({ accept: "yes" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/accept/i);
  });

  it("returns 400 when accept is missing", async () => {
    mockAuthenticatedUser();
    setupRespondMocks();

    const res = await request(app)
      .post(`/connections/${REQUEST_ID}/respond`)
      .set("Authorization", "Bearer valid-jwt")
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 404 when request does not exist", async () => {
    mockAuthenticatedUser();
    setupRespondMocks({ requestData: null });

    const res = await request(app)
      .post(`/connections/${REQUEST_ID}/respond`)
      .set("Authorization", "Bearer valid-jwt")
      .send({ accept: true });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("returns 403 when user is not in couple_2", async () => {
    mockAuthenticatedUser();
    setupRespondMocks({
      requestData: {
        ...RESPOND_REQUEST_DATA,
        couple_2_user_a: "someone-else-a",
        couple_2_user_b: "someone-else-b",
      },
    });

    const res = await request(app)
      .post(`/connections/${REQUEST_ID}/respond`)
      .set("Authorization", "Bearer valid-jwt")
      .send({ accept: true });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });

  it("returns 400 when request is already CONNECTED", async () => {
    mockAuthenticatedUser();
    setupRespondMocks({
      requestData: { ...RESPOND_REQUEST_DATA, status: "CONNECTED" },
    });

    const res = await request(app)
      .post(`/connections/${REQUEST_ID}/respond`)
      .set("Authorization", "Bearer valid-jwt")
      .send({ accept: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already resolved/i);
  });

  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();

    const res = await request(app)
      .post(`/connections/${REQUEST_ID}/respond`)
      .send({ accept: true });

    expect(res.status).toBe(401);
  });
});

// ─── POST /connections/:id/veto ───────────────────────────────────────────────

const VETO_REQUEST_DATA = {
  id: REQUEST_ID,
  couple_1_user_a: USER_ID,
  couple_1_user_b: PARTNER_ID,
  status: "INTEREST_PENDING",
};

function setupVetoMocks({
  requestData = VETO_REQUEST_DATA as Record<string, unknown> | null,
} = {}) {
  let crCallCount = 0;

  mockFrom.mockImplementation((table: string) => {
    if (table === "connection_requests") {
      crCallCount++;
      if (crCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: requestData,
                error: requestData ? null : { message: "Not found" },
              }),
            }),
          }),
        };
      }
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    }
  });
}

describe("POST /connections/:id/veto", () => {
  it("returns 200 DECLINED when user is in couple_1 and status is INTEREST_PENDING", async () => {
    mockAuthenticatedUser();
    setupVetoMocks();

    const res = await request(app)
      .post(`/connections/${REQUEST_ID}/veto`)
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("DECLINED");
  });

  it("returns 404 when request does not exist", async () => {
    mockAuthenticatedUser();
    setupVetoMocks({ requestData: null });

    const res = await request(app)
      .post(`/connections/${REQUEST_ID}/veto`)
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("returns 403 when user is not in couple_1", async () => {
    mockAuthenticatedUser();
    setupVetoMocks({
      requestData: {
        ...VETO_REQUEST_DATA,
        couple_1_user_a: "other-x",
        couple_1_user_b: "other-y",
      },
    });

    const res = await request(app)
      .post(`/connections/${REQUEST_ID}/veto`)
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });

  it("returns 400 when request is not in INTEREST_PENDING status", async () => {
    mockAuthenticatedUser();
    setupVetoMocks({
      requestData: { ...VETO_REQUEST_DATA, status: "INTEREST_ALIGNED" },
    });

    const res = await request(app)
      .post(`/connections/${REQUEST_ID}/veto`)
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/INTEREST_PENDING/);
  });

  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();

    const res = await request(app).post(`/connections/${REQUEST_ID}/veto`);

    expect(res.status).toBe(401);
  });
});

// ─── GET /connections/interests ───────────────────────────────────────────────

type InterestsMockOptions = {
  couple1Requests?: Record<string, unknown>[];
  pairs?: Record<string, unknown>[];
};

function setupGetInterestsMocks({
  couple1Requests = [],
  pairs = [],
}: InterestsMockOptions = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "connection_requests") {
      return {
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockResolvedValue({ data: couple1Requests, error: null }),
        }),
      };
    }
    if (table === "pairs") {
      return {
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockResolvedValue({ data: pairs, error: null }),
        }),
      };
    }
  });
}

describe("GET /connections/interests", () => {
  it("returns empty array when user has no outbound requests", async () => {
    mockAuthenticatedUser();
    setupGetInterestsMocks({ couple1Requests: [] });

    const res = await request(app)
      .get("/connections/interests")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns pair IDs for couples the user has expressed interest in", async () => {
    mockAuthenticatedUser();
    setupGetInterestsMocks({
      couple1Requests: [
        {
          couple_2_user_a: TARGET_USER_A,
          couple_2_user_b: TARGET_USER_B,
        },
      ],
      pairs: [
        {
          id: TARGET_PAIR_ID,
          profile_id_1: TARGET_USER_A,
          profile_id_2: TARGET_USER_B,
        },
      ],
    });

    const res = await request(app)
      .get("/connections/interests")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body).toContain(TARGET_PAIR_ID);
  });

  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();

    const res = await request(app).get("/connections/interests");

    expect(res.status).toBe(401);
  });
});

// ─── GET /connections/partner-interests ───────────────────────────────────────

const PARTNER_INTEREST_REQUEST = {
  id: REQUEST_ID,
  couple_2_user_a: TARGET_USER_A,
  couple_2_user_b: TARGET_USER_B,
  created_at: "2026-01-01T00:00:00Z",
  status: "INTEREST_PENDING",
};

type PartnerInterestsMockOptions = {
  couple1Requests?: Record<string, unknown>[];
  myParticipantRows?: Record<string, unknown>[];
  profiles?: Record<string, unknown>[];
  tagRows?: Record<string, unknown>[];
  pairs?: Record<string, unknown>[];
};

function setupPartnerInterestsMocks({
  couple1Requests = [],
  myParticipantRows = [],
  profiles = [],
  tagRows = [],
  pairs = [],
}: PartnerInterestsMockOptions = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "connection_requests") {
      return {
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockResolvedValue({ data: couple1Requests, error: null }),
        }),
      };
    }
    if (table === "connection_request_participants") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq: vi
              .fn()
              .mockResolvedValue({ data: myParticipantRows, error: null }),
          }),
        }),
      };
    }
    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: profiles, error: null }),
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
    if (table === "pairs") {
      return {
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockResolvedValue({ data: pairs, error: null }),
        }),
      };
    }
  });
}

describe("GET /connections/partner-interests", () => {
  it("returns empty array when there are no pending partner interests", async () => {
    mockAuthenticatedUser();
    setupPartnerInterestsMocks({ couple1Requests: [] });

    const res = await request(app)
      .get("/connections/partner-interests")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns requests where partner has interested=true and current user has interested=false", async () => {
    mockAuthenticatedUser();
    setupPartnerInterestsMocks({
      couple1Requests: [PARTNER_INTEREST_REQUEST],
      myParticipantRows: [{ request_id: REQUEST_ID, interested: false }],
      profiles: [
        {
          id: TARGET_USER_A,
          display_name: "Alice",
          about_me: null,
          location: null,
        },
        {
          id: TARGET_USER_B,
          display_name: "Bob",
          about_me: null,
          location: null,
        },
      ],
      tagRows: [],
      pairs: [],
    });

    const res = await request(app)
      .get("/connections/partner-interests")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].request_id).toBe(REQUEST_ID);
    expect(res.body[0]).toHaveProperty("partner1");
    expect(res.body[0]).toHaveProperty("partner2");
    expect(res.body[0]).toHaveProperty("tags");
  });

  it("excludes requests where current user is the initiator (interested=true)", async () => {
    mockAuthenticatedUser();
    setupPartnerInterestsMocks({
      couple1Requests: [PARTNER_INTEREST_REQUEST],
      myParticipantRows: [{ request_id: REQUEST_ID, interested: true }],
    });

    const res = await request(app)
      .get("/connections/partner-interests")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();

    const res = await request(app).get("/connections/partner-interests");

    expect(res.status).toBe(401);
  });
});

// ─── GET /connections/inbound ─────────────────────────────────────────────────

type InboundMockOptions = {
  allInbound?: Record<string, unknown>[];
  c2Participants?: Record<string, unknown>[];
  myParticipantRows?: Record<string, unknown>[];
  profiles?: Record<string, unknown>[];
  tagRows?: Record<string, unknown>[];
  pairs?: Record<string, unknown>[];
};

function setupInboundMocks({
  allInbound = [],
  c2Participants = [],
  myParticipantRows = [],
  profiles = [],
  tagRows = [],
  pairs = [],
}: InboundMockOptions = {}) {
  let crCallCount = 0;
  let participantsCallCount = 0;

  mockFrom.mockImplementation((table: string) => {
    if (table === "connection_requests") {
      crCallCount++;
      if (crCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({ data: allInbound, error: null }),
          }),
        };
      }
      // update calls (INTEREST_ALIGNED → REQUEST_PENDING, or heal → CONNECTED)
      return {
        update: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    }

    if (table === "connection_request_participants") {
      participantsCallCount++;
      if (participantsCallCount === 1) {
        // heal check: select(...).in("request_id", ...)
        return {
          select: vi.fn().mockReturnValue({
            in: vi
              .fn()
              .mockResolvedValue({ data: c2Participants, error: null }),
          }),
        };
      }
      // my response: select(...).in(...).eq(...)
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: myParticipantRows,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: profiles, error: null }),
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

    if (table === "pairs") {
      return {
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockResolvedValue({ data: pairs, error: null }),
        }),
      };
    }
  });
}

const INBOUND_REQUEST = {
  id: REQUEST_ID,
  couple_1_user_a: TARGET_USER_A,
  couple_1_user_b: TARGET_USER_B,
  couple_2_user_a: USER_ID,
  couple_2_user_b: PARTNER_ID,
  status: "REQUEST_PENDING",
  created_at: "2026-01-01T00:00:00Z",
};

const INBOUND_PROFILES = [
  { id: TARGET_USER_A, display_name: "Alice", about_me: null, location: null },
  { id: TARGET_USER_B, display_name: "Bob", about_me: null, location: null },
];

describe("GET /connections/inbound", () => {
  it("returns empty array when user has no inbound requests", async () => {
    mockAuthenticatedUser();
    setupInboundMocks({ allInbound: [] });

    const res = await request(app)
      .get("/connections/inbound")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns REQUEST_PENDING inbound requests with my_response field", async () => {
    mockAuthenticatedUser();
    setupInboundMocks({
      allInbound: [INBOUND_REQUEST],
      c2Participants: [
        { user_id: USER_ID, interested: false },
        { user_id: PARTNER_ID, interested: false },
      ],
      myParticipantRows: [{ request_id: REQUEST_ID, interested: false }],
      profiles: INBOUND_PROFILES,
    });

    const res = await request(app)
      .get("/connections/inbound")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].request_id).toBe(REQUEST_ID);
    expect(res.body[0].my_response).toBeNull();
    expect(res.body[0]).toHaveProperty("partner1");
    expect(res.body[0]).toHaveProperty("partner2");
    expect(res.body[0]).toHaveProperty("tags");
  });

  it("seeds my_response=true when current user has already accepted", async () => {
    mockAuthenticatedUser();
    setupInboundMocks({
      allInbound: [INBOUND_REQUEST],
      c2Participants: [
        { user_id: USER_ID, interested: true },
        { user_id: PARTNER_ID, interested: false },
      ],
      myParticipantRows: [{ request_id: REQUEST_ID, interested: true }],
      profiles: INBOUND_PROFILES,
    });

    const res = await request(app)
      .get("/connections/inbound")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body[0].my_response).toBe(true);
  });

  it("auto-transitions to CONNECTED and returns empty when both couple_2 partners accepted", async () => {
    mockAuthenticatedUser();
    setupInboundMocks({
      allInbound: [INBOUND_REQUEST],
      // Both C2 partners have interested=true → heal triggers CONNECTED
      c2Participants: [
        { request_id: REQUEST_ID, user_id: USER_ID, interested: true },
        { request_id: REQUEST_ID, user_id: PARTNER_ID, interested: true },
      ],
    });

    const res = await request(app)
      .get("/connections/inbound")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("excludes DECLINED requests", async () => {
    mockAuthenticatedUser();
    setupInboundMocks({
      allInbound: [{ ...INBOUND_REQUEST, status: "DECLINED" }],
    });

    const res = await request(app)
      .get("/connections/inbound")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();

    const res = await request(app).get("/connections/inbound");

    expect(res.status).toBe(401);
  });
});

// ─── GET /connections/connected ───────────────────────────────────────────────

type ConnectedMockOptions = {
  allRequests?: Record<string, unknown>[];
  profiles?: Record<string, unknown>[];
  tagRows?: Record<string, unknown>[];
  pairs?: Record<string, unknown>[];
};

function setupConnectedMocks({
  allRequests = [],
  profiles = [],
  tagRows = [],
  pairs = [],
}: ConnectedMockOptions = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "connection_requests") {
      return {
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockResolvedValue({ data: allRequests, error: null }),
        }),
      };
    }
    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: profiles, error: null }),
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
    if (table === "pairs") {
      return {
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockResolvedValue({ data: pairs, error: null }),
        }),
      };
    }
  });
}

const CONNECTED_REQUEST = {
  id: REQUEST_ID,
  couple_1_user_a: USER_ID,
  couple_1_user_b: PARTNER_ID,
  couple_2_user_a: TARGET_USER_A,
  couple_2_user_b: TARGET_USER_B,
  status: "CONNECTED",
  created_at: "2026-01-01T00:00:00Z",
};

describe("GET /connections/connected", () => {
  it("returns empty array when user has no connected couples", async () => {
    mockAuthenticatedUser();
    setupConnectedMocks({ allRequests: [] });

    const res = await request(app)
      .get("/connections/connected")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns connected couple details for a CONNECTED request", async () => {
    mockAuthenticatedUser();
    setupConnectedMocks({
      allRequests: [CONNECTED_REQUEST],
      profiles: [
        {
          id: TARGET_USER_A,
          display_name: "Carol",
          about_me: null,
          location: "NYC",
        },
        {
          id: TARGET_USER_B,
          display_name: "Dave",
          about_me: null,
          location: "NYC",
        },
      ],
    });

    const res = await request(app)
      .get("/connections/connected")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].request_id).toBe(REQUEST_ID);
    expect(res.body[0]).toHaveProperty("partner1");
    expect(res.body[0]).toHaveProperty("partner2");
    expect(res.body[0]).toHaveProperty("tags");
  });

  it("shows the OTHER couple's details, not the current user's couple", async () => {
    mockAuthenticatedUser();
    setupConnectedMocks({
      allRequests: [CONNECTED_REQUEST],
      profiles: [
        {
          id: TARGET_USER_A,
          display_name: "Carol",
          about_me: null,
          location: null,
        },
        {
          id: TARGET_USER_B,
          display_name: "Dave",
          about_me: null,
          location: null,
        },
      ],
    });

    const res = await request(app)
      .get("/connections/connected")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    // partner1/partner2 should reflect the OTHER couple (Carol & Dave), not the current user
    const names = [
      res.body[0].partner1?.display_name,
      res.body[0].partner2?.display_name,
    ];
    expect(names).toContain("Carol");
    expect(names).toContain("Dave");
  });

  it("filters out non-CONNECTED requests", async () => {
    mockAuthenticatedUser();
    setupConnectedMocks({
      allRequests: [{ ...CONNECTED_REQUEST, status: "REQUEST_PENDING" }],
    });

    const res = await request(app)
      .get("/connections/connected")
      .set("Authorization", "Bearer valid-jwt");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();

    const res = await request(app).get("/connections/connected");

    expect(res.status).toBe(401);
  });
});
