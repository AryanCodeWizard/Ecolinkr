import { describe, expect, it } from "vitest";
import { RefreshToken } from "../models/RefreshToken.js";
import { api, bearer, collectorLogin, registerRecycler, signToken } from "./helpers.js";

const refresh = (refreshToken: string) => api().post("/auth/refresh").send({ refreshToken });

describe("POST /auth/refresh", () => {
  it("rotates: returns a new pair and the old token stops working", async () => {
    const { body: first } = await registerRecycler();
    const res = await refresh(first.refreshToken);
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(first.refreshToken);
    expect(res.body.accessToken).toBeTruthy();
    expect((await refresh(first.refreshToken)).status).toBe(401);
  });

  it("detects reuse and revokes the whole family", async () => {
    const { body: first } = await registerRecycler();
    const { body: second } = await refresh(first.refreshToken);
    expect((await refresh(first.refreshToken)).status).toBe(401); // replay
    expect((await refresh(second.refreshToken)).status).toBe(401); // descendant is dead too
    expect(await RefreshToken.countDocuments()).toBe(0);
  });

  it("only revokes the compromised session, not the user's other sessions", async () => {
    await registerRecycler();
    const a = (await api().post("/auth/login").send({ email: "rec@example.com", password: "Password123!" })).body;
    const b = (await api().post("/auth/login").send({ email: "rec@example.com", password: "Password123!" })).body;
    await refresh(a.refreshToken);
    await refresh(a.refreshToken); // replay session A
    expect((await refresh(b.refreshToken)).status).toBe(200);
  });

  it("lets exactly one of several concurrent refreshes win", async () => {
    const { body } = await registerRecycler();
    const results = await Promise.all(Array.from({ length: 6 }, () => refresh(body.refreshToken)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it("rejects expired tokens", async () => {
    const { body } = await registerRecycler();
    await RefreshToken.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    expect((await refresh(body.refreshToken)).status).toBe(401);
  });

  it("rejects unknown tokens and validates the body", async () => {
    expect((await refresh("not-a-real-token")).status).toBe(401);
    expect((await api().post("/auth/refresh").send({})).status).toBe(400);
  });

  it("stores only a hash of the token", async () => {
    const { body } = await registerRecycler();
    const stored = await RefreshToken.findOne();
    expect(stored!.tokenHash).not.toBe(body.refreshToken);
    expect(JSON.stringify(stored)).not.toContain(body.refreshToken);
  });
});

describe("POST /auth/logout", () => {
  it("invalidates the refresh token and is idempotent", async () => {
    const { body } = await registerRecycler();
    expect((await api().post("/auth/logout").send({ refreshToken: body.refreshToken })).status).toBe(204);
    expect((await api().post("/auth/logout").send({ refreshToken: body.refreshToken })).status).toBe(204);
    expect((await refresh(body.refreshToken)).status).toBe(401);
  });

  it("returns 204 even for an unknown token", async () => {
    expect((await api().post("/auth/logout").send({ refreshToken: "unknown" })).status).toBe(204);
  });
});

describe("requireAuth / requireRole", () => {
  it("rejects a missing, malformed, wrongly signed or expired access token", async () => {
    const { body } = await registerRecycler();
    const payload = { sub: body.user.id, role: "RECYCLER" };
    const cases = [
      {},
      { Authorization: "Token abc" },
      bearer("garbage"),
      bearer(signToken(payload, { secret: "some-other-secret-0123456789" })),
      bearer(signToken(payload, { expiresIn: -10 })),
    ];
    for (const headers of cases) {
      const res = await api().get("/auth/me").set(headers);
      expect(res.status).toBe(401);
    }
  });

  it("rejects an unsigned (alg=none) token", async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const forged = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "x", role: "ADMIN" })}.`;
    expect((await api().get("/auth/me").set(bearer(forged))).status).toBe(401);
  });
});
