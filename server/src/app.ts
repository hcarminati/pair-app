import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { couplesRouter } from "./routes/couples.js";
import { discoveryRouter } from "./routes/discovery.js";
import { pairsRouter } from "./routes/pairs.js";
import { profilesRouter } from "./routes/profiles.js";
import { usersRouter } from "./routes/users.js";
import { errorHandler } from "./middleware/errorHandler.js";

if (process.env["NODE_ENV"] === "production" && !process.env["CLIENT_ORIGIN"]) {
  throw new Error("CLIENT_ORIGIN must be set in production");
}

const corsOptions = {
  origin: process.env["CLIENT_ORIGIN"] ?? "http://localhost:5173",
};

const app = express();
app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());

app.get("/health", (_, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/couples", couplesRouter);
app.use("/discovery", discoveryRouter);
app.use("/pairs", pairsRouter);
app.use("/profiles", profilesRouter);
app.use("/users", usersRouter);

app.use(errorHandler);

export { app };
