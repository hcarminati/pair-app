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

const productionOrigin = process.env["CLIENT_ORIGIN"];
const netlifyAppName = process.env["NETLIFY_APP_NAME"];

const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    // Allow requests with no origin (e.g. server-to-server, curl)
    if (!origin) return callback(null, true);
    // Always allow localhost in dev
    if (!productionOrigin) return callback(null, origin === "http://localhost:5173");
    // Allow the production origin
    if (origin === productionOrigin) return callback(null, true);
    // Allow Netlify deploy previews for the same app
    if (
      netlifyAppName &&
      /^https:\/\/deploy-preview-\d+--/.test(origin) &&
      origin.endsWith(`.netlify.app`) &&
      origin.includes(`--${netlifyAppName}.netlify.app`)
    ) {
      return callback(null, true);
    }
    callback(null, false);
  },
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
