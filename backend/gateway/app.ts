import express from "express";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { proxyRouter } from "./routes/proxy.js";
import { requestId } from "./middleware/requestId.js";
import { rejectTraversal } from "./middleware/rejectTraversal.js";
import { globalRateLimit } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export const app = express();
app.set("trust proxy", env.TRUST_PROXY);
app.disable("x-powered-by");

// No body parser on purpose: request bodies are streamed straight through to the upstream.
app.use(requestId);
app.use(healthRouter);
app.use(globalRateLimit);
app.use(rejectTraversal);
app.use(proxyRouter);

app.use(notFoundHandler);
app.use(errorHandler);
