import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../middleware/auth.js";

export const profilesRouter = Router();

// GET /profiles/me
profilesRouter.get("/me", verifyToken, async (_req: Request, res: Response) => {
  const user = res.locals["user"] as { id: string; email?: string };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, about_me, location")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const { data: userTags, error: tagsError } = await supabase
    .from("user_tags")
    .select("tags(label)")
    .eq("user_id", user.id);

  if (tagsError) {
    res.status(500).json({ error: "Failed to fetch tags" });
    return;
  }

  const tags = (userTags ?? [])
    .map((ut) => (ut.tags as unknown as { label: string } | null)?.label)
    .filter((label): label is string => typeof label === "string");

  res.status(200).json({
    display_name: profile.display_name as string,
    about_me: profile.about_me as string | null,
    location: profile.location as string | null,
    email: user.email ?? null,
    tags,
  });
});

// PATCH /profiles/me
profilesRouter.patch(
  "/me",
  verifyToken,
  async (req: Request, res: Response) => {
    const user = res.locals["user"] as { id: string };
    const { display_name, about_me, location, tags } = req.body as {
      display_name?: string;
      about_me?: string;
      location?: string;
      tags?: unknown;
    };

    if (!Array.isArray(tags)) {
      res.status(400).json({ error: "tags must be an array" });
      return;
    }

    // Normalize and deduplicate tags
    const normalized = [
      ...new Set(
        (tags as unknown[])
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0),
      ),
    ];

    if (normalized.length > 10) {
      res.status(422).json({ error: "Cannot have more than 10 tags" });
      return;
    }

    // Update profile fields
    const profileUpdate: Record<string, string | undefined> = {};
    if (display_name !== undefined)
      profileUpdate["display_name"] = display_name;
    if (about_me !== undefined) profileUpdate["about_me"] = about_me;
    if (location !== undefined) profileUpdate["location"] = location;

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user.id);

    if (profileError) {
      res.status(500).json({ error: "Failed to update profile" });
      return;
    }

    // Delete all existing user_tags for this user
    const { error: deleteError } = await supabase
      .from("user_tags")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      res.status(500).json({ error: "Failed to update tags" });
      return;
    }

    if (normalized.length > 0) {
      const tagIds: string[] = [];

      for (const label of normalized) {
        const { data: existing } = await supabase
          .from("tags")
          .select("id")
          .eq("label", label)
          .single();

        if (existing) {
          tagIds.push(existing.id as string);
        } else {
          const { data: inserted, error: insertTagError } = await supabase
            .from("tags")
            .insert({ label, is_custom: true })
            .select("id")
            .single();

          if (insertTagError || !inserted) {
            res.status(500).json({ error: "Failed to update tags" });
            return;
          }
          tagIds.push(inserted.id as string);
        }
      }

      const { error: insertUserTagsError } = await supabase
        .from("user_tags")
        .insert(tagIds.map((tag_id) => ({ user_id: user.id, tag_id })));

      if (insertUserTagsError) {
        res.status(500).json({ error: "Failed to update tags" });
        return;
      }
    }

    res.status(200).json({ message: "Profile updated successfully" });
  },
);
