import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../middleware/auth.js";

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

    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    if (profile.partner_id != null) {
      res
        .status(400)
        .json({ error: "You are already paired with a partner" });
      return;
    }

    // Delete any stale tokens (used or expired) for this user
    await supabase
      .from("invite_tokens")
      .delete()
      .eq("created_by", user.id)
      .or(`used_by.not.is.null,expires_at.lt.${new Date().toISOString()}`);

    // Return an existing valid token if one exists
    const { data: existing } = await supabase
      .from("invite_tokens")
      .select("token, expires_at")
      .eq("created_by", user.id)
      .is("used_by", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      res.status(200).json({ token: existing.token, expires_at: existing.expires_at });
      return;
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + 72 * 60 * 60 * 1000,
    ).toISOString();

    const { error } = await supabase.from("invite_tokens").insert({
      token,
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
      .eq("token", token)
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

    if (creatorProfile?.partner_id != null) {
      res.status(400).json({
        error: "This invite token belongs to a user who is already paired",
      });
      return;
    }

    const { error: markUsedError } = await supabase
      .from("invite_tokens")
      .update({ used_by: user.id, used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    if (markUsedError) {
      console.error("link error (mark token used):", JSON.stringify(markUsedError));
      res.status(500).json({ error: "Failed to link accounts" });
      return;
    }

    const { error: linkError } = await supabase.rpc("link_partners", {
      user_a: user.id,
      user_b: tokenRow.created_by,
    });

    if (linkError) {
      console.error("link error:", JSON.stringify(linkError));
      res.status(500).json({ error: "Failed to link accounts" });
      return;
    }

    res.status(200).json({ message: "Successfully linked accounts" });
  },
);

couplesRouter.delete(
  "/link",
  verifyToken,
  async (_req: Request, res: Response) => {
    const user = res.locals["user"] as { id: string };

    const { data: profile } = await supabase
      .from("profiles")
      .select("partner_id")
      .eq("id", user.id)
      .single();

    if (profile?.partner_id == null) {
      res.status(400).json({ error: "You are not currently paired" });
      return;
    }

    const partnerId = profile.partner_id as string;

    await supabase
      .from("profiles")
      .update({ partner_id: null })
      .eq("id", user.id);

    await supabase
      .from("profiles")
      .update({ partner_id: null })
      .eq("id", partnerId);

    await supabase
      .from("pairs")
      .delete()
      .or(`profile_id_1.eq.${user.id},profile_id_2.eq.${user.id}`);

    res.status(204).send();
  },
);
