import { Router } from "express";
import { routes } from "../config/services.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ service: "gateway", status: "running" });
});

// Deep check: asks every upstream's /health. Returns 503 if any is down.
healthRouter.get("/health/services", async (_req, res) => {
  const results = await Promise.all(
    routes.map(async (r) => {
      try {
        const up = await fetch(`${r.target}/health`, { signal: AbortSignal.timeout(2000) });
        return [r.name, up.ok ? "up" : "down"] as const;
      } catch {
        return [r.name, "down"] as const;
      }
    }),
  );
  const services = Object.fromEntries(results);
  const ok = results.every(([, s]) => s === "up");
  res.status(ok ? 200 : 503).json({ service: "gateway", status: ok ? "running" : "degraded", services });
});
