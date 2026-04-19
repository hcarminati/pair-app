import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../middleware/auth.js";

export const discoveryRouter = Router();

// GET /discovery
// Returns couples ranked by shared tag count with the requesting couple.
// Excludes: own couple, incomplete couples, already-connected couples.
// Requires the requesting user to be linked with a partner (403 otherwise).
discoveryRouter.get("/", verifyToken, async (req: Request, res: Response) => {
  const user = res.locals["user"] as { id: string };

  // 1. Verify user is paired
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("partner_id")
    .eq("id", user.id)
    .single();

  if (!myProfile || myProfile.partner_id == null) {
    res
      .status(403)
      .json({ error: "You must be linked with a partner to browse discovery" });
    return;
  }

  const partnerId = myProfile.partner_id as string;

  // 2. Get my pair row
  const { data: myPair } = await supabase
    .from("pairs")
    .select("id")
    .or(`profile_id_1.eq.${user.id},profile_id_2.eq.${user.id}`)
    .single();

  if (!myPair) {
    res.status(404).json({ error: "Couple profile not found" });
    return;
  }

  // 3. Get my couple's union of tags
  const { data: myTagRows, error: myTagsError } = await supabase
    .from("user_tags")
    .select("tags(label)")
    .in("user_id", [user.id, partnerId]);

  if (myTagsError) {
    res.status(500).json({ error: "Failed to fetch tags" });
    return;
  }

  const myTags = new Set(
    (
      (myTagRows ?? []) as unknown as {
        tags: { label: string } | null;
      }[]
    )
      .map((r) => r.tags?.label)
      .filter((l): l is string => typeof l === "string"),
  );

  // 4. Find all connection requests involving our couple (any status) to exclude
  //    from discovery — a couple already in any stage of the flow should not
  //    appear in Discover.
  const { data: connectedRequests } = await supabase
    .from("connection_requests")
    .select(
      "couple_1_user_a, couple_1_user_b, couple_2_user_a, couple_2_user_b",
    )
    .or(
      `couple_1_user_a.eq.${user.id},couple_1_user_b.eq.${user.id},couple_2_user_a.eq.${user.id},couple_2_user_b.eq.${user.id}`,
    );

  const connectedUserIds = new Set<string>();
  const myIds = new Set([user.id, partnerId]);
  for (const req of connectedRequests ?? []) {
    const c1 = [req.couple_1_user_a as string, req.couple_1_user_b as string];
    const c2 = [req.couple_2_user_a as string, req.couple_2_user_b as string];
    if (c1.some((id) => myIds.has(id))) {
      c2.forEach((id) => connectedUserIds.add(id));
    } else {
      c1.forEach((id) => connectedUserIds.add(id));
    }
  }

  // 5. Fetch all other pairs
  const { data: allPairs, error: pairsError } = await supabase
    .from("pairs")
    .select("id, about_us, location, profile_id_1, profile_id_2")
    .neq("id", myPair.id as string);

  if (pairsError) {
    res.status(500).json({ error: "Failed to fetch discovery feed" });
    return;
  }

  if (!allPairs || allPairs.length === 0) {
    res.status(200).json([]);
    return;
  }

  // 6. Filter out already-connected couples
  const eligiblePairs = allPairs.filter((pair) => {
    const p1 = pair.profile_id_1 as string;
    const p2 = pair.profile_id_2 as string;
    return !connectedUserIds.has(p1) && !connectedUserIds.has(p2);
  });

  if (eligiblePairs.length === 0) {
    res.status(200).json([]);
    return;
  }

  // 7. Batch-fetch profiles and tags for all candidate users
  const candidateUserIds = eligiblePairs.flatMap((p) => [
    p.profile_id_1 as string,
    p.profile_id_2 as string,
  ]);

  const [{ data: profiles }, { data: tagRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, about_me, location")
      .in("id", candidateUserIds),
    supabase
      .from("user_tags")
      .select("user_id, tags(label)")
      .in("user_id", candidateUserIds),
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
    const label = row.tags.label;
    const existing = tagsByUser.get(row.user_id);
    if (existing) {
      existing.push(label);
    } else {
      tagsByUser.set(row.user_id, [label]);
    }
  }

  // 8. Build results — exclude incomplete couples (missing profile for either partner)
  const results = eligiblePairs
    .filter(
      (pair) =>
        profileMap.has(pair.profile_id_1 as string) &&
        profileMap.has(pair.profile_id_2 as string),
    )
    .map((pair) => {
      const p1Id = pair.profile_id_1 as string;
      const p2Id = pair.profile_id_2 as string;
      const p1 = profileMap.get(p1Id)!;
      const p2 = profileMap.get(p2Id)!;
      const p1Tags = tagsByUser.get(p1Id) ?? [];
      const p2Tags = tagsByUser.get(p2Id) ?? [];
      const allPairTags = [...new Set([...p1Tags, ...p2Tags])];
      const matchingTags = allPairTags.filter((t) => myTags.has(t));

      return {
        pair_id: pair.id as string,
        about_us: (pair.about_us as string | null) ?? null,
        location: (pair.location as string | null) ?? null,
        tags: allPairTags,
        matching_tags: matchingTags,
        shared_count: matchingTags.length,
        partner1: {
          display_name: p1.display_name,
          about_me: p1.about_me,
          location: p1.location,
          tags: p1Tags,
        },
        partner2: {
          display_name: p2.display_name,
          about_me: p2.about_me,
          location: p2.location,
          tags: p2Tags,
        },
      };
    })
    .sort((a, b) => b.shared_count - a.shared_count);

  // 9. Apply tag filter if specified (OR logic — couple must have at least one filter tag)
  const rawTags =
    typeof req.query["tags"] === "string" ? req.query["tags"] : "";
  const filterTags = rawTags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

  // 10. Apply location filter if specified (case-insensitive substring match)
  const locationFilter =
    typeof req.query["location"] === "string"
      ? req.query["location"].trim().toLowerCase()
      : "";

  const filtered = results
    .filter(
      (r) =>
        filterTags.length === 0 ||
        filterTags.some((ft) => r.tags.includes(ft)),
    )
    .filter(
      (r) =>
        locationFilter.length === 0 ||
        (r.location ?? "").toLowerCase().includes(locationFilter),
    );

  res.status(200).json(filtered);
});
