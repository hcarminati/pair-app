import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../middleware/auth.js";
import { normalizeTag } from "../../../shared/validation.js";

export const usersRouter = Router();

const MAX_TAGS = 10;

usersRouter.get(
  "/me/interests",
  verifyToken,
  async (_req: Request, res: Response) => {
    const user = res.locals["user"] as { id: string };

    const { data, error } = await supabase
      .from("user_tags")
      .select("tags(label)")
      .eq("user_id", user.id);

    if (error) {
      res.status(500).json({ error: "Failed to fetch interests" });
      return;
    }

    const tags = (data ?? []).map(
      (row) => (row.tags as unknown as { label: string }).label,
    );
    res.status(200).json({ tags });
  },
);

usersRouter.patch(
  "/me/interests",
  verifyToken,
  async (req: Request, res: Response) => {
    const user = res.locals["user"] as { id: string };
    const { tags } = req.body as { tags?: unknown };

    if (!Array.isArray(tags)) {
      res.status(400).json({ error: "tags must be an array" });
      return;
    }

    const normalized = [
      ...new Set(
        (tags as unknown[])
          .filter((t): t is string => typeof t === "string")
          .map(normalizeTag)
          .filter((t) => t.length > 0),
      ),
    ];

    if (normalized.length > MAX_TAGS) {
      res.status(422).json({ error: `Cannot save more than ${MAX_TAGS} tags` });
      return;
    }

    if (normalized.length === 0) {
      res.status(200).json({ tags: [] });
      return;
    }

    // Upsert tags (get or create by label)
    const { data: tagRows, error: upsertError } = await supabase
      .from("tags")
      .upsert(
        normalized.map((label) => ({ label, is_custom: false })),
        { onConflict: "label" },
      )
      .select("id, label");

    if (upsertError || !tagRows) {
      console.error(
        "interests error (upsert tags):",
        JSON.stringify(upsertError),
      );
      res.status(500).json({ error: "Failed to save interests" });
      return;
    }

    // Replace user_tags: delete existing then insert new
    const { error: deleteError } = await supabase
      .from("user_tags")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      console.error(
        "interests error (delete user_tags):",
        JSON.stringify(deleteError),
      );
      res.status(500).json({ error: "Failed to save interests" });
      return;
    }

    const { error: insertError } = await supabase
      .from("user_tags")
      .insert(tagRows.map((t) => ({ user_id: user.id, tag_id: t.id })));

    if (insertError) {
      console.error(
        "interests error (insert user_tags):",
        JSON.stringify(insertError),
      );
      res.status(500).json({ error: "Failed to save interests" });
      return;
    }

    res.status(200).json({ tags: tagRows.map((t) => t.label) });
  },
);
