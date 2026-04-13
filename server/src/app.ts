import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { couplesRouter } from "./routes/couples.js";
import { pairsRouter } from "./routes/pairs.js";
import { profilesRouter } from "./routes/profiles.js";
import { usersRouter } from "./routes/users.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
app.use(
  cors({ origin: process.env["CLIENT_ORIGIN"] ?? "http://localhost:5173" }),
);
app.use(express.json());

app.get("/health", (_, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/couples", couplesRouter);
app.use("/pairs", pairsRouter);
app.use("/profiles", profilesRouter);
app.use("/users", usersRouter);

app.use(errorHandler);

export { app };
