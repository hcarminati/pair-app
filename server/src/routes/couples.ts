import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../middleware/auth.js";
import { hashToken } from "../lib/tokenHash.js";

export const couplesRouter = Router();

couplesRouter.post(
  "/invite",
  verifyToken,
  async (_req: Request, res: Response) => {
    const user = res.locals["user"] as { id: string };

    const { data: profile } = await supabase
      .from("profiles")
      .select("partner_id")
      .eq("id", user.id)
      .single();

    if (profile?.partner_id !== null) {
      res
        .status(400)
        .json({ error: "You are already paired with a partner" });
      return;
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + 72 * 60 * 60 * 1000,
    ).toISOString();

    const { error } = await supabase.from("invite_tokens").insert({
      token_hash: hashToken(token),
      created_by: user.id,
      expires_at: expiresAt,
    });

    if (error) {
      res.status(500).json({ error: "Failed to create invite token" });
      return;
    }

    res.status(201).json({ token, expires_at: expiresAt });
  },
);

couplesRouter.post(
  "/link",
  verifyToken,
  async (req: Request, res: Response) => {
    const user = res.locals["user"] as { id: string };
    const { token } = req.body as { token?: string };

    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }

    const { data: tokenRow, error: fetchError } = await supabase
      .from("invite_tokens")
      .select("id, created_by, used_by, expires_at")
      .eq("token_hash", hashToken(token))
      .single();

    if (fetchError || !tokenRow) {
      res.status(404).json({ error: "Invite token not found" });
      return;
    }

    if (tokenRow.created_by === user.id) {
      res.status(400).json({ error: "You cannot use your own invite token" });
      return;
    }

    if (tokenRow.used_by !== null) {
      res.status(400).json({ error: "Invite token has already been used" });
      return;
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      res.status(400).json({ error: "Invite token has expired" });
      return;
    }

    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("partner_id")
      .eq("id", tokenRow.created_by)
      .single();

    if (creatorProfile?.partner_id !== null) {
      res.status(400).json({
        error: "This invite token belongs to a user who is already paired",
      });
      return;
    }

    await supabase
      .from("invite_tokens")
      .update({ used_by: user.id, used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    await supabase
      .from("profiles")
      .update({ partner_id: tokenRow.created_by })
      .eq("id", user.id);

    await supabase
      .from("profiles")
      .update({ partner_id: user.id })
      .eq("id", tokenRow.created_by);

    await supabase.from("pairs").insert({
      profile_id_1: tokenRow.created_by,
      profile_id_2: user.id,
    });

    res.status(200).json({ message: "Successfully linked accounts" });
  },
);
