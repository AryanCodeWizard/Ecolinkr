import { Router } from "express";
import proxy from "express-http-proxy";
import { env } from "../config/env.js";
import { routes } from "../config/services.js";
import { verifyJwt } from "../middleware/verifyJwt.js";

const TIMEOUT_CODES = new Set(["ETIMEDOUT", "ESOCKETTIMEDOUT", "ECONNRESET"]) // the proxy aborts a timed-out request, surfacing as ECONNRESET;

export const proxyRouter = Router();

for (const route of routes) {
  const forward = proxy(route.target, {
    timeout: env.UPSTREAM_TIMEOUT_MS,
    // Mounted under a prefix, so rebuild the full original path (and query string).
    proxyReqPathResolver: (req) => req.originalUrl,
    proxyReqOptDecorator: (opts, req) => {
      opts.headers = {
        ...opts.headers,
        "x-request-id": req.id,
        // Upstreams (TRUST_PROXY=1) take the real client IP from here; never trust the client's own value.
        "x-forwarded-for": req.ip ?? "",
      };
      // Internal-only credential: must never be injectable from outside.
      delete (opts.headers as Record<string, unknown>)["x-internal-key"];
      return opts;
    },
    proxyErrorHandler: (err: NodeJS.ErrnoException, res) => {
      const timedOut = TIMEOUT_CODES.has(err.code ?? "");
      console.error(`[${route.name}] upstream error: ${err.code ?? err.message}`);
      res.status(timedOut ? 504 : 502).json({
        error: {
          code: timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE",
          message: `${route.name} service is ${timedOut ? "taking too long to respond" : "unavailable"}`,
        },
      });
    },
  });
  proxyRouter.use(route.prefix, ...(route.requireAuth ? [verifyJwt] : []), forward);
}
