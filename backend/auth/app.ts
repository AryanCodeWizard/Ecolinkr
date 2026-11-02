import express from "express";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.routes.js";
import { internalRouter } from "./routes/internal.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export const app = express();
app.set("trust proxy", env.TRUST_PROXY);

app.use(express.json({ limit: "100kb" }));

app.use(healthRouter);
app.use("/auth", authRouter);
app.use("/internal", internalRouter);

app.use(notFoundHandler);
app.use(errorHandler);
