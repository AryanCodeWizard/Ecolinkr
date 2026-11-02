import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const token = (payload: object = { sub: "u1", role: "COLLECTOR" }, secret = process.env.JWT_ACCESS_SECRET!) =>
  jwt.sign(payload, secret, { expiresIn: 60 });
const bearer = (t = token()) => ({ Authorization: `Bearer ${t}` });

/** A fake backend that echoes what it received, so tests can see what the gateway forwarded. */
function fakeService(name: string) {
  const a = express();
  a.use(express.json());
  a.get("/health", (_req, res) => void res.json({ service: name, status: "running" }));
  a.get("/auth/slow", (_req, res) => void setTimeout(() => res.json({}), 2000).unref());
  a.all(/.*/, (req, res) => {
    res.status(req.query.status ? Number(req.query.status) : 200).json({
      service: name, method: req.method, url: req.originalUrl, headers: req.headers, body: req.body,
    });
  });
  return a;
}

const servers: Server[] = [];
const listen = (a: express.Express) =>
  new Promise<string>((resolve) => {
    const s = a.listen(0, "127.0.0.1", () => {
      servers.push(s);
      resolve(`http://127.0.0.1:${(s.address() as AddressInfo).port}`);
    });
  });

let api: () => request.Test | any;
let authUrl: string;

beforeAll(async () => {
  authUrl = await listen(fakeService("auth"));
  process.env.AUTH_SERVICE_URL = authUrl;
  process.env.USER_SERVICE_URL = await listen(fakeService("user"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { app } = await import("../app.js");
  api = () => request(app);
});

afterAll(() => servers.forEach((s) => s.close()));

describe("routing", () => {
  it("forwards /auth/* to the auth service with path, query, method and body intact", async () => {
    const res = await api().post("/auth/login?x=1").send({ email: "a@b.co" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      service: "auth", method: "POST", url: "/auth/login?x=1", body: { email: "a@b.co" },
    });
  });

  it("forwards /users/* to the user service and passes the Authorization header through", async () => {
    const t = token();
    const res = await api().get("/users/me").set(bearer(t));
    expect(res.body).toMatchObject({ service: "user", url: "/users/me" });
    expect(res.body.headers.authorization).toBe(`Bearer ${t}`);
  });

  it("relays upstream status codes and bodies unchanged", async () => {
    const res = await api().get("/auth/anything?status=409");
    expect(res.status).toBe(409);
    expect(res.body.service).toBe("auth");
  });

  it("does not expose /internal/* or unknown paths", async () => {
    for (const p of ["/internal/users", "/nope"]) {
      expect((await api().get(p).set(bearer())).status).toBe(404);
    }
    const res = await api().post("/internal/users").send({});
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("rejects dot-segment and malformed paths, including encoded ones", async () => {
    for (const p of ["/users/%2e%2e/internal/users", "/users/%2E%2E%2Finternal", "/auth/%5c..%5cx"]) {
      const res = await api().get(p).set(bearer());
      expect(res.status).toBe(400);
      expect(res.body.service).toBeUndefined();
    }
    expect((await api().get("/users/%E0%A4%A").set(bearer())).status).toBe(400);
  });

  it("strips a client-supplied X-Internal-Key", async () => {
    const res = await api().get("/auth/me").set("X-Internal-Key", "stolen");
    expect(res.body.headers["x-internal-key"]).toBeUndefined();
  });
});

describe("gateway JWT check", () => {
  it("rejects missing, malformed, wrong-secret and expired tokens on /users without calling the upstream", async () => {
    const bad = [
      undefined,
      "Bearer nonsense",
      `Bearer ${token(undefined, "x".repeat(20))}`,
      `Bearer ${jwt.sign({ sub: "u" }, process.env.JWT_ACCESS_SECRET!, { expiresIn: -10 })}`,
    ];
    for (const h of bad) {
      const req = api().get("/users/me");
      const res = await (h ? req.set("Authorization", h) : req);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
      expect(res.body.service).toBeUndefined();
    }
  });

  it("leaves /auth/* open so login and registration work", async () => {
    expect((await api().post("/auth/register").send({})).status).toBe(200);
  });
});

describe("request tracing and client IP", () => {
  it("sets a fresh request id, forwards it and ignores a client-supplied one", async () => {
    const res = await api().get("/auth/x").set("X-Request-Id", "forged");
    const id = res.headers["x-request-id"];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.headers["x-request-id"]).toBe(id);
  });

  it("forwards the caller's IP rather than a spoofed X-Forwarded-For chain", async () => {
    const res = await api().get("/auth/x").set("X-Forwarded-For", "6.6.6.6, 203.0.113.9");
    expect(res.body.headers["x-forwarded-for"]).toBe("203.0.113.9");
  });
});

describe("upstream failures", () => {
  it("returns 504 when the upstream is too slow", async () => {
    const res = await api().get("/auth/slow");
    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe("UPSTREAM_TIMEOUT");
  });

  it("returns 502 when the upstream is down", async () => {
    const dead = express();
    const url = await listen(dead);
    servers.pop()!.close();
    vi.resetModules();
    process.env.AUTH_SERVICE_URL = url;
    const { app } = await import("../app.js");
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("UPSTREAM_UNAVAILABLE");
    process.env.AUTH_SERVICE_URL = authUrl;
  });
});

describe("health", () => {
  it("/health reports the gateway itself", async () => {
    expect((await api().get("/health")).body).toEqual({ service: "gateway", status: "running" });
  });

  it("/health/services reports each upstream", async () => {
    const res = await api().get("/health/services");
    expect(res.status).toBe(200);
    expect(res.body.services).toEqual({ auth: "up", user: "up" });
  });
});

describe("rate limiting", () => {
  it("returns 429 with Retry-After details past the limit, per client IP", async () => {
    const hit = (ip: string) => api().get("/auth/x").set("X-Forwarded-For", ip);
    let last: any;
    for (let i = 0; i < 51; i++) last = await hit("198.51.100.1");
    expect(last.status).toBe(429);
    expect(last.body.error).toMatchObject({ code: "RATE_LIMITED" });
    expect(last.body.error.details.retryAfterSec).toBeGreaterThan(0);
    expect((await hit("198.51.100.2")).status).toBe(200);
  });

  it("does not rate limit /health", async () => {
    for (let i = 0; i < 60; i++) expect((await api().get("/health").set("X-Forwarded-For", "198.51.100.1")).status).toBe(200);
  });
});
