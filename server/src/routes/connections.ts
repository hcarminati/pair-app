import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../middleware/auth.js";

export const connectionsRouter = Router();

// GET /connections/interests
// Returns an array of pair IDs that the requesting user's couple has already
// expressed interest in (i.e. requests where the user is in couple_1).
connectionsRouter.get(
  "/interests",
  verifyToken,
  async (req: Request, res: Response) => {
    const user = res.locals["user"] as { id: string };

    const { data: requests } = await supabase
      .from("connection_requests")
      .select("couple_2_user_a, couple_2_user_b")
      .or(`couple_1_user_a.eq.${user.id},couple_1_user_b.eq.${user.id}`);

    if (!requests || requests.length === 0) {
      res.status(200).json([]);
      return;
    }

    const targetUserIds = [
      ...new Set(
        requests.flatMap((r) => [
          r.couple_2_user_a as string,
          r.couple_2_user_b as string,
        ]),
      ),
    ];

    const { data: pairs } = await supabase
      .from("pairs")
      .select("id, profile_id_1, profile_id_2")
      .or(
        `profile_id_1.in.(${targetUserIds.join(",")}),profile_id_2.in.(${targetUserIds.join(",")})`,
      );

    const interestedPairIds: string[] = [];
    for (const r of requests) {
      const userA = r.couple_2_user_a as string;
      const userB = r.couple_2_user_b as string;
      const match = (pairs ?? []).find((p) => {
        const p1 = p.profile_id_1 as string;
        const p2 = p.profile_id_2 as string;
        return (p1 === userA && p2 === userB) || (p1 === userB && p2 === userA);
      });
      if (match) interestedPairIds.push(match.id as string);
    }

    res.status(200).json(interestedPairIds);
  },
);

// GET /connections/partner-interests
// Returns INTEREST_PENDING requests where the current user is in couple_1 but
// has not yet set interested = true. These are couples the partner flagged but
// the current user hasn't weighed in on.
connectionsRouter.get(
  "/partner-interests",
  verifyToken,
  async (req: Request, res: Response) => {
    const user = res.locals["user"] as { id: string };

    // 1. Find INTEREST_PENDING requests where user is in couple_1; filter
    //    status in application code (avoids .or() + .eq() chaining issues)
    const { data: allCouple1Requests } = await supabase
      .from("connection_requests")
      .select("id, couple_2_user_a, couple_2_user_b, created_at, status")
      .or(`couple_1_user_a.eq.${user.id},couple_1_user_b.eq.${user.id}`);

    const requests = (allCouple1Requests ?? []).filter(
      (r) => r.status === "INTEREST_PENDING",
    );

    if (requests.length === 0) {
      res.status(200).json([]);
      return;
    }

    const requestIds = requests.map((r) => r.id as string);

    // 2. Filter to only requests where the current user hasn't aligned yet
    const { data: myParticipants } = await supabase
      .from("connection_request_participants")
      .select("request_id, interested")
      .in("request_id", requestIds)
      .eq("user_id", user.id);

    const pendingIds = new Set(
      (myParticipants ?? [])
        .filter((p) => p.interested === false)
        .map((p) => p.request_id as string),
    );

    const pendingRequests = requests.filter((r) =>
      pendingIds.has(r.id as string),
    );

    if (pendingRequests.length === 0) {
      res.status(200).json([]);
      return;
    }

    // 3. Fetch target couple details
    const targetUserIds = [
      ...new Set(
        pendingRequests.flatMap((r) => [
          r.couple_2_user_a as string,
          r.couple_2_user_b as string,
        ]),
      ),
    ];

    const [{ data: profiles }, { data: tagRows }, { data: pairs }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, about_me, location")
          .in("id", targetUserIds),
        supabase
          .from("user_tags")
          .select("user_id, tags(label)")
          .in("user_id", targetUserIds),
        supabase
          .from("pairs")
          .select("id, profile_id_1, profile_id_2, about_us, location")
          .or(
            `profile_id_1.in.(${targetUserIds.join(",")}),profile_id_2.in.(${targetUserIds.join(",")})`,
          ),
      ]);

    type ProfileRow = {
      id: string;
      display_name: string;
      about_me: string | null;
      location: string | null;
    };
    const profileMap = new Map<string, ProfileRow>(
      (profiles ?? []).map((p) => [
        p.id as string,
        {
          id: p.id as string,
          display_name: p.display_name as string,
          about_me: (p.about_me as string | null) ?? null,
          location: (p.location as string | null) ?? null,
        },
      ]),
    );

    const tagsByUser = new Map<string, string[]>();
    for (const row of (tagRows ?? []) as unknown as {
      user_id: string;
      tags: { label: string } | null;
    }[]) {
      if (!row.tags?.label) continue;
      const existing = tagsByUser.get(row.user_id);
      if (existing) existing.push(row.tags.label);
      else tagsByUser.set(row.user_id, [row.tags.label]);
    }

    const results = pendingRequests.map((r) => {
      const userAId = r.couple_2_user_a as string;
      const userBId = r.couple_2_user_b as string;
      const profileA = profileMap.get(userAId) ?? null;
      const profileB = profileMap.get(userBId) ?? null;
      const tagsA = tagsByUser.get(userAId) ?? [];
      const tagsB = tagsByUser.get(userBId) ?? [];
      const allTags = [...new Set([...tagsA, ...tagsB])];

      const pair = (pairs ?? []).find((p) => {
        const p1 = p.profile_id_1 as string;
        const p2 = p.profile_id_2 as string;
        return (
          (p1 === userAId && p2 === userBId) ||
          (p1 === userBId && p2 === userAId)
        );
      });

      return {
        request_id: r.id as string,
        pair_id: (pair?.id as string | undefined) ?? null,
        about_us: (pair?.about_us as string | null) ?? null,
        location: (pair?.location as string | null) ?? null,
        tags: allTags,
        partner1: profileA
          ? {
              display_name: profileA.display_name,
              about_me: profileA.about_me,
              location: profileA.location,
              tags: tagsA,
            }
          : null,
        partner2: profileB
          ? {
              display_name: profileB.display_name,
              about_me: profileB.about_me,
              location: profileB.location,
              tags: tagsB,
            }
          : null,
        created_at: r.created_at as string,
      };
    });

    res.status(200).json(results);
  },
);

// POST /connections/:id/align
// The second partner in couple_1 sets their interested = true on an existing
// INTEREST_PENDING request. If both couple_1 partners are now interested,
// the request transitions to INTEREST_ALIGNED.
connectionsRouter.post(
  "/:id/align",
  verifyToken,
  async (req: Request, res: Response) => {
    const user = res.locals["user"] as { id: string };
    const requestId = req.params["id"];

    // 1. Fetch the request by ID only, then verify membership and status in code
    //    (avoids chaining .eq + .or which can behave unexpectedly in some
    //    PostgREST versions)
    const { data: request } = await supabase
      .from("connection_requests")
      .select("id, couple_1_user_a, couple_1_user_b, status")
      .eq("id", requestId)
      .single();

    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const isCouple1 =
      (request.couple_1_user_a as string) === user.id ||
      (request.couple_1_user_b as string) === user.id;

    if (!isCouple1) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    if (request.status !== "INTEREST_PENDING") {
      res
        .status(400)
        .json({ error: "Request is not in INTEREST_PENDING status" });
      return;
    }

    // 2. Set current user's interested = true
    const { error: updateError } = await supabase
      .from("connection_request_participants")
      .update({ interested: true })
      .eq("request_id", requestId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("align update error:", JSON.stringify(updateError));
      res.status(500).json({ error: "Failed to record interest" });
      return;
    }

    // 3. Check if both couple_1 partners are now interested
    const couple1Ids = [
      request.couple_1_user_a as string,
      request.couple_1_user_b as string,
    ];
    const { data: couple1Participants } = await supabase
      .from("connection_request_participants")
      .select("interested")
      .eq("request_id", requestId)
      .in("user_id", couple1Ids);

    const bothInterested =
      (couple1Participants ?? []).length === 2 &&
      (couple1Participants ?? []).every((p) => p.interested === true);

    if (bothInterested) {
      const { error: statusError } = await supabase
        .from("connection_requests")
        .update({ status: "INTEREST_ALIGNED" })
        .eq("id", requestId);

      if (statusError) {
        console.error("align status error:", JSON.stringify(statusError));
        res.status(500).json({ error: "Failed to update request status" });
        return;
      }
    }

    const { data: updatedRequest } = await supabase
      .from("connection_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    res.status(200).json(updatedRequest);
  },
);

// GET /connections/inbound
// Returns requests where the current user is in couple_2 and the status is
// INTEREST_ALIGNED or REQUEST_PENDING. INTEREST_ALIGNED requests are
// automatically transitioned to REQUEST_PENDING (couple 2 has now received them).
connectionsRouter.get(
  "/inbound",
  verifyToken,
  async (req: Request, res: Response) => {
    const user = res.locals["user"] as { id: string };

    // 1. Find requests where user is in couple_2; filter status in application
    //    code to avoid chaining .or() + .in() which can behave unexpectedly
    const { data: allInbound } = await supabase
      .from("connection_requests")
      .select(
        "id, couple_1_user_a, couple_1_user_b, couple_2_user_a, couple_2_user_b, status, created_at",
      )
      .or(`couple_2_user_a.eq.${user.id},couple_2_user_b.eq.${user.id}`);

    const requests = (allInbound ?? []).filter(
      (r) =>
        r.status === "INTEREST_PENDING" ||
        r.status === "INTEREST_ALIGNED" ||
        r.status === "REQUEST_PENDING",
    );

    if (requests.length === 0) {
      res.status(200).json([]);
      return;
    }

    // 2a. Auto-transition any INTEREST_ALIGNED requests to REQUEST_PENDING
    const alignedIds = requests
      .filter((r) => r.status === "INTEREST_ALIGNED")
      .map((r) => r.id as string);

    if (alignedIds.length > 0) {
      await supabase
        .from("connection_requests")
        .update({ status: "REQUEST_PENDING" })
        .in("id", alignedIds);
    }

    // 2b. For any non-resolved request, check if both couple_2 partners have
    //     already accepted (interested = true). If so, auto-transition to
    //     CONNECTED — this recovers from inconsistent states where respond
    //     returned ACCEPTED for both partners.
    const allRequestIds = requests.map((r) => r.id as string);

    const { data: allC2Participants } = await supabase
      .from("connection_request_participants")
      .select("request_id, user_id, interested")
      .in("request_id", allRequestIds);

    const nowConnectedIds: string[] = [];
    for (const r of requests) {
      const c2a = r.couple_2_user_a as string;
      const c2b = r.couple_2_user_b as string;
      const c2Rows = (allC2Participants ?? []).filter(
        (p) =>
          (p.request_id as string) === (r.id as string) &&
          ((p.user_id as string) === c2a || (p.user_id as string) === c2b),
      );
      const bothAccepted =
        c2Rows.length === 2 && c2Rows.every((p) => p.interested === true);
      if (bothAccepted) nowConnectedIds.push(r.id as string);
    }

    if (nowConnectedIds.length > 0) {
      await supabase
        .from("connection_requests")
        .update({ status: "CONNECTED" })
        .in("id", nowConnectedIds);

      // Exclude now-connected requests from the inbound list
      const connectedSet = new Set(nowConnectedIds);
      requests.splice(
        0,
        requests.length,
        ...requests.filter((r) => !connectedSet.has(r.id as string)),
      );

      if (requests.length === 0) {
        res.status(200).json([]);
        return;
      }
    }

    // 3. Fetch requesting couple details (couple_1)
    const requestingUserIds = [
      ...new Set(
        requests.flatMap((r) => [
          r.couple_1_user_a as string,
          r.couple_1_user_b as string,
        ]),
      ),
    ];

    const requestIds = requests.map((r) => r.id as string);

    const [
      { data: profiles },
      { data: tagRows },
      { data: pairs },
      { data: myParticipantRows },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, about_me, location")
        .in("id", requestingUserIds),
      supabase
        .from("user_tags")
        .select("user_id, tags(label)")
        .in("user_id", requestingUserIds),
      supabase
        .from("pairs")
        .select("id, profile_id_1, profile_id_2, about_us, location")
        .or(
          `profile_id_1.in.(${requestingUserIds.join(",")}),profile_id_2.in.(${requestingUserIds.join(",")})`,
        ),
      supabase
        .from("connection_request_participants")
        .select("request_id, interested")
        .in("request_id", requestIds)
        .eq("user_id", user.id),
    ]);

    // Map request_id → current user's interested value (null = no row yet)
    const myResponseMap = new Map<string, boolean>(
      (myParticipantRows ?? []).map((p) => [
        p.request_id as string,
        p.interested as boolean,
      ]),
    );

    type ProfileRow = {
      id: string;
      display_name: string;
      about_me: string | null;
      location: string | null;
    };
    const profileMap = new Map<string, ProfileRow>(
      (profiles ?? []).map((p) => [
        p.id as string,
        {
          id: p.id as string,
          display_name: p.display_name as string,
          about_me: (p.about_me as string | null) ?? null,
          location: (p.location as string | null) ?? null,
        },
      ]),
    );

    const tagsByUser = new Map<string, string[]>();
    for (const row of (tagRows ?? []) as unknown as {
      user_id: string;
      tags: { label: string } | null;
    }[]) {
      if (!row.tags?.label) continue;
      const existing = tagsByUser.get(row.user_id);
      if (existing) existing.push(row.tags.label);
      else tagsByUser.set(row.user_id, [row.tags.label]);
    }

    const results = requests.map((r) => {
      const userAId = r.couple_1_user_a as string;
      const userBId = r.couple_1_user_b as string;
      const profileA = profileMap.get(userAId) ?? null;
      const profileB = profileMap.get(userBId) ?? null;
      const tagsA = tagsByUser.get(userAId) ?? [];
      const tagsB = tagsByUser.get(userBId) ?? [];
      const allTags = [...new Set([...tagsA, ...tagsB])];

      const pair = (pairs ?? []).find((p) => {
        const p1 = p.profile_id_1 as string;
        const p2 = p.profile_id_2 as string;
        return (
          (p1 === userAId && p2 === userBId) ||
          (p1 === userBId && p2 === userAId)
        );
      });

      return {
        request_id: r.id as string,
        pair_id: (pair?.id as string | undefined) ?? null,
        about_us: (pair?.about_us as string | null) ?? null,
        location: (pair?.location as string | null) ?? null,
        tags: allTags,
        partner1: profileA
          ? {
              display_name: profileA.display_name,
              about_me: profileA.about_me,
              location: profileA.location,
              tags: tagsA,
            }
          : null,
        partner2: profileB
          ? {
              display_name: profileB.display_name,
              about_me: profileB.about_me,
              location: profileB.location,
              tags: tagsB,
            }
          : null,
        created_at: r.created_at as string,
        // null = not yet responded, true = accepted
        // (false is never meaningful here — declined requests are excluded by status filter)
        my_response: myResponseMap.get(r.id as string) === true ? true : null,
      };
    });

    res.status(200).json(results);
  },
);

// POST /connections/:id/respond
// A member of couple_2 accepts or declines an inbound request.
// accept=true  → sets user's interested=true; if all 4 participants are now
//                interested → CONNECTED
// accept=false → immediately → DECLINED
connectionsRouter.post(
  "/:id/respond",
  verifyToken,
  async (req: Request, res: Response) => {
    const user = res.locals["user"] as { id: string };
    const requestId = req.params["id"];
    const { accept } = req.body as { accept?: boolean };

    if (typeof accept !== "boolean") {
      res.status(400).json({ error: "accept (boolean) is required" });
      return;
    }

    // 1. Fetch request by ID; verify user is in couple_2 in application code
    const { data: request } = await supabase
      .from("connection_requests")
      .select(
        "id, couple_1_user_a, couple_1_user_b, couple_2_user_a, couple_2_user_b, status",
      )
      .eq("id", requestId)
      .single();

    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const isCouple2 =
      (request.couple_2_user_a as string) === user.id ||
      (request.couple_2_user_b as string) === user.id;

    if (!isCouple2) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const status = request.status as string;
    if (status === "CONNECTED" || status === "DECLINED") {
      res.status(400).json({ error: "Request is already resolved" });
      return;
    }

    // 2. Decline fast-path
    if (!accept) {
      const { error: declineError } = await supabase
        .from("connection_requests")
        .update({ status: "DECLINED" })
        .eq("id", requestId);

      if (declineError) {
        console.error("decline error:", JSON.stringify(declineError));
        res.status(500).json({ error: "Failed to decline request" });
        return;
      }

      res.status(200).json({ status: "DECLINED" });
      return;
    }

    // 3. Accept: set this user's interested = true
    const { error: updateError } = await supabase
      .from("connection_request_participants")
      .update({ interested: true })
      .eq("request_id", requestId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("respond update error:", JSON.stringify(updateError));
      res.status(500).json({ error: "Failed to record response" });
      return;
    }

    // 4. Re-read both couple_2 participant rows and check if both have accepted.
    //    Querying both (not just the other) matches the pattern used in /align
    //    and avoids any ID-mismatch or race-condition blind spot.
    const c2a = request.couple_2_user_a as string;
    const c2b = request.couple_2_user_b as string;

    const { data: c2Rows } = await supabase
      .from("connection_request_participants")
      .select("user_id, interested")
      .eq("request_id", requestId)
      .in("user_id", [c2a, c2b]);

    const bothAccepted =
      (c2Rows ?? []).length === 2 &&
      (c2Rows ?? []).every((p) => p.interested === true);

    if (bothAccepted) {
      const { error: connectError } = await supabase
        .from("connection_requests")
        .update({ status: "CONNECTED" })
        .eq("id", requestId);

      if (connectError) {
        console.error("connect error:", JSON.stringify(connectError));
        res.status(500).json({ error: "Failed to connect" });
        return;
      }

      res.status(200).json({ status: "CONNECTED" });
      return;
    }

    res.status(200).json({ status: "ACCEPTED" });
  },
);

// GET /connections/connected
// Returns CONNECTED requests where the current user is a participant (either couple).
connectionsRouter.get(
  "/connected",
  verifyToken,
  async (req: Request, res: Response) => {
    const user = res.locals["user"] as { id: string };

    // Fetch all requests where user is in couple_1 or couple_2; filter CONNECTED in JS
    const { data: allRequests } = await supabase
      .from("connection_requests")
      .select(
        "id, couple_1_user_a, couple_1_user_b, couple_2_user_a, couple_2_user_b, status, created_at",
      )
      .or(
        `couple_1_user_a.eq.${user.id},couple_1_user_b.eq.${user.id},couple_2_user_a.eq.${user.id},couple_2_user_b.eq.${user.id}`,
      );

    const requests = (allRequests ?? []).filter(
      (r) => r.status === "CONNECTED",
    );

    if (requests.length === 0) {
      res.status(200).json([]);
      return;
    }

    // Gather all OTHER couple's user IDs (not the current user's couple)
    const otherUserIds = [
      ...new Set(
        requests.flatMap((r) => {
          const isCouple1 =
            (r.couple_1_user_a as string) === user.id ||
            (r.couple_1_user_b as string) === user.id;
          return isCouple1
            ? [r.couple_2_user_a as string, r.couple_2_user_b as string]
            : [r.couple_1_user_a as string, r.couple_1_user_b as string];
        }),
      ),
    ];

    const requestIds = requests.map((r) => r.id as string);

    const [{ data: profiles }, { data: tagRows }, { data: pairs }, { data: messages }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, about_me, location")
          .in("id", otherUserIds),
        supabase
          .from("user_tags")
          .select("user_id, tags(label)")
          .in("user_id", otherUserIds),
        supabase
          .from("pairs")
          .select("id, profile_id_1, profile_id_2, about_us, location")
          .or(
            `profile_id_1.in.(${otherUserIds.join(",")}),profile_id_2.in.(${otherUserIds.join(",")})`,
          ),
        supabase
          .from("messages")
          .select("request_id, content, created_at")
          .in("request_id", requestIds)
          .order("created_at", { ascending: false }),
      ]);

    type MessageRow = { request_id: string; content: string; created_at: string };
    const latestMessageByRequest = new Map<string, { content: string; created_at: string }>();
    for (const msg of (messages ?? []) as MessageRow[]) {
      if (!latestMessageByRequest.has(msg.request_id)) {
        latestMessageByRequest.set(msg.request_id, {
          content: msg.content,
          created_at: msg.created_at,
        });
      }
    }

    type ProfileRow = {
      id: string;
      display_name: string;
      about_me: string | null;
      location: string | null;
    };
    const profileMap = new Map<string, ProfileRow>(
      (profiles ?? []).map((p) => [
        p.id as string,
        {
          id: p.id as string,
          display_name: p.display_name as string,
          about_me: (p.about_me as string | null) ?? null,
          location: (p.location as string | null) ?? null,
        },
      ]),
    );

    const tagsByUser = new Map<string, string[]>();
    for (const row of (tagRows ?? []) as unknown as {
      user_id: string;
      tags: { label: string } | null;
    }[]) {
      if (!row.tags?.label) continue;
      const existing = tagsByUser.get(row.user_id);
      if (existing) existing.push(row.tags.label);
      else tagsByUser.set(row.user_id, [row.tags.label]);
    }

    const results = requests.map((r) => {
      const isCouple1 =
        (r.couple_1_user_a as string) === user.id ||
        (r.couple_1_user_b as string) === user.id;
      const userAId = isCouple1
        ? (r.couple_2_user_a as string)
        : (r.couple_1_user_a as string);
      const userBId = isCouple1
        ? (r.couple_2_user_b as string)
        : (r.couple_1_user_b as string);

      const profileA = profileMap.get(userAId) ?? null;
      const profileB = profileMap.get(userBId) ?? null;
      const tagsA = tagsByUser.get(userAId) ?? [];
      const tagsB = tagsByUser.get(userBId) ?? [];
      const allTags = [...new Set([...tagsA, ...tagsB])];

      const pair = (pairs ?? []).find((p) => {
        const p1 = p.profile_id_1 as string;
        const p2 = p.profile_id_2 as string;
        return (
          (p1 === userAId && p2 === userBId) ||
          (p1 === userBId && p2 === userAId)
        );
      });

      return {
        request_id: r.id as string,
        pair_id: (pair?.id as string | undefined) ?? null,
        about_us: (pair?.about_us as string | null) ?? null,
        location: (pair?.location as string | null) ?? null,
        tags: allTags,
        partner1: profileA
          ? {
              display_name: profileA.display_name,
              about_me: profileA.about_me,
              location: profileA.location,
              tags: tagsA,
            }
          : null,
        partner2: profileB
          ? {
              display_name: profileB.display_name,
              about_me: profileB.about_me,
              location: profileB.location,
              tags: tagsB,
            }
          : null,
        created_at: r.created_at as string,
        latest_message: latestMessageByRequest.get(r.id as string) ?? null,
      };
    });

    res.status(200).json(results);
  },
);

// POST /connections/:id/veto
// A member of couple_1 vetoes their partner's interest, transitioning the
// request to DECLINED. Only valid while the request is INTEREST_PENDING.
connectionsRouter.post(
  "/:id/veto",
  verifyToken,
  async (req: Request, res: Response) => {
    const user = res.locals["user"] as { id: string };
    const requestId = req.params["id"];

    const { data: request } = await supabase
      .from("connection_requests")
      .select("id, couple_1_user_a, couple_1_user_b, status")
      .eq("id", requestId)
      .single();

    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const isCouple1 =
      (request.couple_1_user_a as string) === user.id ||
      (request.couple_1_user_b as string) === user.id;

    if (!isCouple1) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    if (request.status !== "INTEREST_PENDING") {
      res
        .status(400)
        .json({ error: "Request is not in INTEREST_PENDING status" });
      return;
    }

    const { error: vetoError } = await supabase
      .from("connection_requests")
      .update({ status: "DECLINED" })
      .eq("id", requestId);

    if (vetoError) {
      console.error("veto error:", JSON.stringify(vetoError));
      res.status(500).json({ error: "Failed to veto request" });
      return;
    }

    res.status(200).json({ status: "DECLINED" });
  },
);

// POST /connections/interest
// Express interest in another couple. Creates a connection_requests row with
// status INTEREST_PENDING and sets the initiating partner's interested = true
// in connection_request_participants.
// If a request already exists between the two couples (any direction, any status),
// returns the existing request without creating a duplicate.
connectionsRouter.post(
  "/interest",
  verifyToken,
  async (req: Request, res: Response) => {
    const user = res.locals["user"] as { id: string };
    const { target_pair_id } = req.body as { target_pair_id?: string };

    if (!target_pair_id) {
      res.status(400).json({ error: "target_pair_id is required" });
      return;
    }

    // 1. Verify user is linked with a partner
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("partner_id")
      .eq("id", user.id)
      .single();

    if (!myProfile || myProfile.partner_id == null) {
      res.status(403).json({
        error: "You must be linked with a partner to express interest",
      });
      return;
    }

    const partnerId = myProfile.partner_id as string;

    // 2. Get my pair record
    const { data: myPair } = await supabase
      .from("pairs")
      .select("id")
      .or(`profile_id_1.eq.${user.id},profile_id_2.eq.${user.id}`)
      .single();

    if (!myPair) {
      res.status(404).json({ error: "Couple profile not found" });
      return;
    }

    // 3. Get target pair record (validates it exists)
    const { data: targetPair, error: targetPairError } = await supabase
      .from("pairs")
      .select("id, profile_id_1, profile_id_2")
      .eq("id", target_pair_id)
      .single();

    if (targetPairError || !targetPair) {
      res.status(404).json({ error: "Target couple not found" });
      return;
    }

    if ((targetPair.id as string) === (myPair.id as string)) {
      res
        .status(400)
        .json({ error: "You cannot express interest in your own couple" });
      return;
    }

    const targetUserA = targetPair.profile_id_1 as string;
    const targetUserB = targetPair.profile_id_2 as string;

    // 4. Check for any existing request between these two couples (either direction)
    const { data: myRequests } = await supabase
      .from("connection_requests")
      .select("*")
      .or(
        `couple_1_user_a.eq.${user.id},couple_1_user_b.eq.${user.id},couple_2_user_a.eq.${user.id},couple_2_user_b.eq.${user.id}`,
      );

    const myUserIds = new Set([user.id, partnerId]);
    const targetUserIds = new Set([targetUserA, targetUserB]);

    const existing = (myRequests ?? []).find((r) => {
      const c1 = new Set([
        r.couple_1_user_a as string,
        r.couple_1_user_b as string,
      ]);
      const c2 = new Set([
        r.couple_2_user_a as string,
        r.couple_2_user_b as string,
      ]);
      const c1isMe = [...c1].every((id) => myUserIds.has(id));
      const c2isTarget = [...c2].every((id) => targetUserIds.has(id));
      const c1isTarget = [...c1].every((id) => targetUserIds.has(id));
      const c2isMe = [...c2].every((id) => myUserIds.has(id));
      return (c1isMe && c2isTarget) || (c1isTarget && c2isMe);
    });

    if (existing) {
      res.status(200).json(existing);
      return;
    }

    // 5. Create the connection_requests row
    const { data: newRequest, error: insertError } = await supabase
      .from("connection_requests")
      .insert({
        couple_1_user_a: user.id,
        couple_1_user_b: partnerId,
        couple_2_user_a: targetUserA,
        couple_2_user_b: targetUserB,
        status: "INTEREST_PENDING",
      })
      .select()
      .single();

    if (insertError || !newRequest) {
      console.error("interest insert error:", JSON.stringify(insertError));
      res.status(500).json({ error: "Failed to create connection request" });
      return;
    }

    const requestId = newRequest.id as string;

    // 6. Create participant rows for all 4 users; initiating partner is interested = true
    const { error: participantsError } = await supabase
      .from("connection_request_participants")
      .insert([
        { request_id: requestId, user_id: user.id, interested: true },
        { request_id: requestId, user_id: partnerId, interested: false },
        { request_id: requestId, user_id: targetUserA, interested: false },
        { request_id: requestId, user_id: targetUserB, interested: false },
      ]);

    if (participantsError) {
      console.error(
        "participants insert error:",
        JSON.stringify(participantsError),
      );
      res.status(500).json({ error: "Failed to create connection request" });
      return;
    }

    res.status(201).json(newRequest);
  },
);
