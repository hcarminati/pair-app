import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../middleware/auth.js";

export const pairsRouter = Router();

const MAX_TAGS_PER_USER = 10;

// GET /pairs/me
// Returns the full couple profile: both partners' display names, about_me fields,
// locations, the shared about_us, pairs.location, and the union of both partners' tags.
pairsRouter.get("/me", verifyToken, async (_req: Request, res: Response) => {
  const user = res.locals["user"] as { id: string };

  // 1. Fetch current user's profile
  const { data: myProfile, error: myProfileError } = await supabase
    .from("profiles")
    .select("display_name, about_me, location, partner_id")
    .eq("id", user.id)
    .single();

  if (myProfileError || !myProfile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  if (myProfile.partner_id == null) {
    res.status(400).json({ error: "You are not currently paired" });
    return;
  }

  const partnerId = myProfile.partner_id as string;

  // 2. Fetch partner's profile
  const { data: partnerProfile, error: partnerError } = await supabase
    .from("profiles")
    .select("display_name, about_me, location")
    .eq("id", partnerId)
    .single();

  if (partnerError || !partnerProfile) {
    res.status(404).json({ error: "Partner profile not found" });
    return;
  }

  // 3. Fetch the pairs row
  const { data: pair, error: pairError } = await supabase
    .from("pairs")
    .select("id, about_us, location")
    .or(`profile_id_1.eq.${user.id},profile_id_2.eq.${user.id}`)
    .single();

  if (pairError || !pair) {
    res.status(404).json({ error: "Couple profile not found" });
    return;
  }

  // 4. Fetch all tags for both users in one query
  const { data: tagRows, error: tagsError } = await supabase
    .from("user_tags")
    .select("user_id, tags(label)")
    .in("user_id", [user.id, partnerId]);

  if (tagsError) {
    res.status(500).json({ error: "Failed to fetch tags" });
    return;
  }

  const rows = (tagRows ?? []) as unknown as {
    user_id: string;
    tags: { label: string } | null;
  }[];

  const partner1Tags = [
    ...new Set(
      rows
        .filter((r) => r.user_id === user.id)
        .map((r) => r.tags?.label)
        .filter((l): l is string => typeof l === "string"),
    ),
  ]
    .sort()
    .slice(0, MAX_TAGS_PER_USER);

  const partner2Tags = [
    ...new Set(
      rows
        .filter((r) => r.user_id === partnerId)
        .map((r) => r.tags?.label)
        .filter((l): l is string => typeof l === "string"),
    ),
  ]
    .sort()
    .slice(0, MAX_TAGS_PER_USER);

  const partner2Set = new Set(partner2Tags);
  const sharedTags = partner1Tags.filter((t) => partner2Set.has(t));

  res.status(200).json({
    pair_id: pair.id as string,
    about_us: pair.about_us as string | null,
    location: pair.location as string | null,
    partner1: {
      display_name: myProfile.display_name as string,
      about_me: myProfile.about_me as string | null,
      location: myProfile.location as string | null,
      tags: partner1Tags,
    },
    partner2: {
      display_name: partnerProfile.display_name as string,
      about_me: partnerProfile.about_me as string | null,
      location: partnerProfile.location as string | null,
      tags: partner2Tags,
    },
    tags: sharedTags,
  });
});
