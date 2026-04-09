import { Router } from "express";
import type { Request, Response } from "express";
import { supabase, supabaseAuthClient } from "../lib/supabase.js";
import { verifyToken } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/register", async (req: Request, res: Response) => {
  const { displayName, email, password } = req.body as {
    displayName?: string;
    email?: string;
    password?: string;
  };

  if (!displayName || !email || !password) {
    res
      .status(400)
      .json({ error: "displayName, email, and password are required" });
    return;
  }

  // matches shared/validation.ts MIN_PASSWORD_LENGTH but cannot import from shared/ due to tsconfig.json,
  // so we manually duplicate the check here
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const { data: createData, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // bypasses email verification
    });

  if (createError) {
    if (
      createError.message.toLowerCase().includes("already registered") ||
      createError.message.toLowerCase().includes("already been registered")
    ) {
      res
        .status(409)
        .json({ error: "An account with that email already exists." });
      return;
    }
    res.status(400).json({ error: createError.message });
    return;
  }

  const user = createData.user;

  const { error: profileError } = await supabase.from("profiles").insert({
    id: user.id,
    display_name: displayName,
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(user.id);
    res.status(500).json({ error: "Registration failed. Please try again." });
    return;
  }

  const { data: signInData, error: signInError } =
    await supabaseAuthClient.auth.signInWithPassword({ email, password });

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

  const { data, error } = await supabaseAuthClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("partner_id")
    .eq("id", data.user.id)
    .single();

  res.status(200).json({
    user: { id: data.user.id, email: data.user.email },
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
    partnerId: profileData?.partner_id ?? null,
  });
});

authRouter.post("/logout", verifyToken, async (req: Request, res: Response) => {
  const token = req.headers["authorization"]!.slice(7);
  const { error } = await supabase.auth.admin.signOut(token);
  if (error) {
    res.status(500).json({ error: "Failed to log out" });
    return;
  }
  res.status(204).send();
});

authRouter.get("/me", verifyToken, async (_req: Request, res: Response) => {
  const user = res.locals["user"] as { id: string };
  const { data: profile } = await supabase
    .from("profiles")
    .select("partner_id")
    .eq("id", user.id)
    .single();
  res.status(200).json({ partnerId: profile?.partner_id ?? null });
});

authRouter.post("/refresh", async (req: Request, res: Response) => {
  const { refresh_token } = req.body as { refresh_token?: string };

  if (!refresh_token) {
    res.status(400).json({ error: "refresh_token is required" });
    return;
  }

  const { data, error } = await supabaseAuthClient.auth.refreshSession({
    refresh_token,
  });

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
