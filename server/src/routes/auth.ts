import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../lib/supabase.js";

export const authRouter = Router();

authRouter.post("/register", async (req: Request, res: Response) => {
  const { displayName, email, password, inviteToken } = req.body as {
    displayName?: string;
    email?: string;
    password?: string;
    inviteToken?: string;
  };

  if (!displayName || !email || !password) {
    res.status(400).json({ error: "displayName, email, and password are required" });
    return;
  }

  if (inviteToken) {
    const { data: tokenRow, error: tokenError } = await supabase
      .from("invite_tokens")
      .select("id, created_by, used_by, expires_at")
      .eq("token", inviteToken)
      .single();

    if (tokenError || !tokenRow) {
      res.status(400).json({ error: "Invite token is invalid" });
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

    const { data: creatorData } = await supabase.auth.admin.getUserById(
      tokenRow.created_by,
    );
    if (creatorData.user?.email?.toLowerCase() === email.toLowerCase()) {
      res.status(400).json({ error: "You cannot use your own invite token" });
      return;
    }

    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("partner_id")
      .eq("id", tokenRow.created_by)
      .single();

    if (creatorProfile?.partner_id !== null) {
      res.status(400).json({ error: "This invite token belongs to a user who is already paired" });
      return;
    }
  }

  const { data: createData, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError) {
    if (
      createError.message.toLowerCase().includes("already registered") ||
      createError.message.toLowerCase().includes("already been registered")
    ) {
      res.status(409).json({ error: "An account with that email already exists." });
      return;
    }
    res.status(400).json({ error: createError.message });
    return;
  }

  const user = createData.user;

  await supabase.from("profiles").insert({
    id: user.id,
    display_name: displayName,
  });

  if (inviteToken) {
    const { data: tokenRow } = await supabase
      .from("invite_tokens")
      .select("id, created_by")
      .eq("token", inviteToken)
      .single();

    if (tokenRow) {
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
    }
  }

  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.session) {
    res.status(500).json({ error: "Account created but failed to sign in" });
    return;
  }

  res.status(201).json({
    user: { id: user.id, email: user.email },
    session: {
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
    },
  });
});

authRouter.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  res.status(200).json({
    user: { id: data.user.id, email: data.user.email },
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  });
});

authRouter.post("/refresh", async (req: Request, res: Response) => {
  const { refresh_token } = req.body as { refresh_token?: string };

  if (!refresh_token) {
    res.status(400).json({ error: "refresh_token is required" });
    return;
  }

  const { data, error } = await supabase.auth.refreshSession({ refresh_token });

  if (error || !data.session) {
    res.status(401).json({ error: "Session expired. Please log in again." });
    return;
  }

  res.status(200).json({
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  });
});
