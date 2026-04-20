import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../middleware/auth.js";

export const messagesRouter = Router();

function isParticipant(
  request: {
    couple_1_user_a: unknown;
    couple_1_user_b: unknown;
    couple_2_user_a: unknown;
    couple_2_user_b: unknown;
  },
  userId: string,
): boolean {
  return (
    (request.couple_1_user_a as string) === userId ||
    (request.couple_1_user_b as string) === userId ||
    (request.couple_2_user_a as string) === userId ||
    (request.couple_2_user_b as string) === userId
  );
}

// GET /messages/:request_id
// Returns all messages for a CONNECTED connection request, ordered chronologically.
// Only participants of the connection may read messages.
messagesRouter.get(
  "/:request_id",
  verifyToken,
  async (req: Request, res: Response) => {
    const user = res.locals["user"] as { id: string };
    const { request_id } = req.params;

    const { data: connectionRequest, error: requestError } = await supabase
      .from("connection_requests")
      .select(
        "id, couple_1_user_a, couple_1_user_b, couple_2_user_a, couple_2_user_b, status",
      )
      .eq("id", request_id)
      .single();

    if (requestError || !connectionRequest) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    if ((connectionRequest.status as string) !== "CONNECTED") {
      res.status(403).json({ error: "Connection is not in CONNECTED status" });
      return;
    }

    if (!isParticipant(connectionRequest, user.id)) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id, request_id, sender_id, content, created_at")
      .eq("request_id", request_id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("messages fetch error:", JSON.stringify(messagesError));
      res.status(500).json({ error: "Failed to fetch messages" });
      return;
    }

    res.status(200).json(messages ?? []);
  },
);

// POST /messages/:request_id
// Creates a new message in a CONNECTED connection thread.
// Only participants may post. sender_id is always taken from the JWT.
messagesRouter.post(
  "/:request_id",
  verifyToken,
  async (req: Request, res: Response) => {
    const user = res.locals["user"] as { id: string };
    const { request_id } = req.params;
    const { content } = req.body as { content?: string };

    if (!content || content.trim() === "") {
      res.status(400).json({ error: "content is required and cannot be empty" });
      return;
    }

    const { data: connectionRequest, error: requestError } = await supabase
      .from("connection_requests")
      .select(
        "id, couple_1_user_a, couple_1_user_b, couple_2_user_a, couple_2_user_b, status",
      )
      .eq("id", request_id)
      .single();

    if (requestError || !connectionRequest) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    if ((connectionRequest.status as string) !== "CONNECTED") {
      res.status(403).json({ error: "Connection is not in CONNECTED status" });
      return;
    }

    if (!isParticipant(connectionRequest, user.id)) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const { data: message, error: insertError } = await supabase
      .from("messages")
      .insert({
        request_id,
        sender_id: user.id,
        content: content.trim(),
      })
      .select()
      .single();

    if (insertError || !message) {
      console.error("message insert error:", JSON.stringify(insertError));
      res.status(500).json({ error: "Failed to send message" });
      return;
    }

    res.status(201).json(message);
  },
);
