import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserProfile } from "../models/UserProfile.js";
import { INTERNAL, api, as, signToken, newId } from "./helpers.js";

const address = { line1: "12 MG Road", city: "Pune", state: "MH", pincode: "411001" };

describe("health", () => {
  it("reports running", async () => {
    expect((await api().get("/health")).body).toEqual({ service: "user", status: "running" });
  });
});

describe("authentication", () => {
  it("rejects missing, malformed, wrong-secret, expired and role-less tokens", async () => {
    const bad = [
      undefined,
      "Bearer nonsense",
      `Bearer ${signToken({ sub: newId(), role: "COLLECTOR" }, { secret: "x".repeat(20) })}`,
      `Bearer ${signToken({ sub: newId(), role: "COLLECTOR" }, { expiresIn: -10 })}`,
      `Bearer ${signToken({ sub: newId() })}`,
      `Bearer ${signToken({ sub: newId(), role: "SUPERUSER" })}`,
    ];
    for (const header of bad) {
      const req = api().get("/users/me");
      const res = await (header ? req.set("Authorization", header) : req);
      expect(res.status).toBe(401);
    }
  });
});

describe("GET/PATCH /users/me", () => {
  it("creates the profile on first access with defaults", async () => {
    const { sub, headers } = as("COLLECTOR");
    const res = await api().get("/users/me").set(headers);
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({ userId: sub, role: "COLLECTOR", language: "en", isActive: true });
  });

  it("does not create duplicates under concurrent first access", async () => {
    const { headers } = as("RECYCLER");
    const results = await Promise.all(Array.from({ length: 5 }, () => api().get("/users/me").set(headers)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(await UserProfile.countDocuments()).toBe(1);
  });

  it("PATCH updates provided fields and keeps the rest", async () => {
    const { headers } = as("COLLECTOR");
    await api().patch("/users/me").set(headers)
      .send({ name: "Collie", phone: "+919876543210", language: "hi", address });
    const res = await api().patch("/users/me").set(headers).send({ language: "en" });
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({
      name: "Collie", phone: "+919876543210", language: "en", address,
    });
  });

  it.each([
    ["bad phone", { phone: "123" }],
    ["bad pincode", { address: { ...address, pincode: "12" } }],
    ["bad language", { language: "english" }],
    ["empty body", {}],
    ["role escalation", { role: "ADMIN", name: "Evil" }],
    ["userId override", { userId: "000000000000000000000000" }],
    ["self-reactivation", { isActive: true }],
  ])("rejects %s with 400", async (_label, body) => {
    const res = await api().patch("/users/me").set(as("COLLECTOR").headers).send(body);
    expect(res.status).toBe(400);
  });

  it("role comes from the token and cannot be changed", async () => {
    const { sub, headers } = as("COLLECTOR");
    await api().patch("/users/me").set(headers).send({ role: "ADMIN" });
    expect((await UserProfile.findOne({ userId: sub }))?.role ?? "COLLECTOR").toBe("COLLECTOR");
  });

  it("users only see their own profile", async () => {
    const a = as("COLLECTOR");
    const b = as("COLLECTOR");
    await api().patch("/users/me").set(a.headers).send({ phone: "9876543210" });
    const res = await api().get("/users/me").set(b.headers);
    expect(res.body.profile.userId).toBe(b.sub);
    expect(res.body.profile.phone).toBeUndefined();
  });

  it("blocks deactivated accounts", async () => {
    const { sub, headers } = as("COLLECTOR");
    await api().get("/users/me").set(headers);
    await UserProfile.updateOne({ userId: sub }, { isActive: false });
    expect((await api().get("/users/me").set(headers)).status).toBe(403);
    expect((await api().patch("/users/me").set(headers).send({ name: "x" })).status).toBe(403);
  });
});

describe("POST /internal/users (from auth)", () => {
  const body = () => ({ userId: newId(), role: "RECYCLER", name: "Rec Co", email: "rec@example.com" });

  it("requires the internal key", async () => {
    expect((await api().post("/internal/users").send(body())).status).toBe(401);
    expect((await api().post("/internal/users").set("X-Internal-Key", "nope").send(body())).status).toBe(401);
    // a user's JWT is not an internal credential
    expect((await api().post("/internal/users").set(as("ADMIN").headers).send(body())).status).toBe(401);
  });

  it("creates the profile, and replays do not overwrite user edits", async () => {
    const b = body();
    expect((await api().post("/internal/users").set(INTERNAL).send(b)).status).toBe(204);
    expect(await UserProfile.findOne({ userId: b.userId })).toMatchObject({
      role: "RECYCLER", name: "Rec Co", email: "rec@example.com", isActive: true,
    });
    await UserProfile.updateOne({ userId: b.userId }, { name: "Edited" });
    await api().post("/internal/users").set(INTERNAL).send(b);
    expect(await UserProfile.countDocuments()).toBe(1);
    expect((await UserProfile.findOne({ userId: b.userId }))!.name).toBe("Edited");
  });

  it("validates the body", async () => {
    for (const bad of [{ ...body(), role: "X" }, { ...body(), userId: "1" }, { ...body(), extra: 1 }, {}]) {
      expect((await api().post("/internal/users").set(INTERNAL).send(bad)).status).toBe(400);
    }
  });
});

describe("admin endpoints", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("are forbidden to non-admins", async () => {
    const { headers } = as("RECYCLER");
    const id = newId();
    expect((await api().get("/users").set(headers)).status).toBe(403);
    expect((await api().get(`/users/${id}`).set(headers)).status).toBe(403);
    expect((await api().patch(`/users/${id}/status`).set(headers).send({ isActive: false })).status).toBe(403);
  });

  it("list paginates and filters by role/status", async () => {
    const admin = as("ADMIN");
    const c1 = as("COLLECTOR"), c2 = as("COLLECTOR"), r1 = as("RECYCLER");
    for (const u of [c1, c2, r1]) await api().get("/users/me").set(u.headers);
    await UserProfile.updateOne({ userId: c2.sub }, { isActive: false });

    const all = await api().get("/users").set(admin.headers);
    expect(all.body).toMatchObject({ total: 3, page: 1, limit: 20 });
    expect((await api().get("/users?role=COLLECTOR").set(admin.headers)).body.total).toBe(2);
    expect((await api().get("/users?isActive=false").set(admin.headers)).body.items[0].userId).toBe(c2.sub);
    const page = await api().get("/users?limit=2&page=2").set(admin.headers);
    expect(page.body.items).toHaveLength(1);
    expect((await api().get("/users?limit=1000").set(admin.headers)).status).toBe(400);
    expect((await api().get("/users?role=NOPE").set(admin.headers)).status).toBe(400);
  });

  it("get returns a user, 404 when unknown, 400 on a malformed id", async () => {
    const admin = as("ADMIN");
    const u = as("COLLECTOR");
    await api().get("/users/me").set(u.headers);
    expect((await api().get(`/users/${u.sub}`).set(admin.headers)).body.profile.userId).toBe(u.sub);
    expect((await api().get(`/users/${newId()}`).set(admin.headers)).status).toBe(404);
    expect((await api().get("/users/not-an-id").set(admin.headers)).status).toBe(400);
  });

  it("deactivates and reactivates a user, but not oneself", async () => {
    const admin = as("ADMIN");
    const u = as("COLLECTOR");
    await api().get("/users/me").set(u.headers);

    const off = await api().patch(`/users/${u.sub}/status`).set(admin.headers).send({ isActive: false });
    expect(off.body.profile.isActive).toBe(false);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`http://auth.test/internal/users/${u.sub}/status`);
    expect(init.headers["X-Internal-Key"]).toBe(INTERNAL["X-Internal-Key"]);
    expect(JSON.parse(init.body)).toEqual({ isActive: false });
    expect((await api().get("/users/me").set(u.headers)).status).toBe(403);

    const on = await api().patch(`/users/${u.sub}/status`).set(admin.headers).send({ isActive: true });
    expect(on.body.profile.isActive).toBe(true);
    expect((await api().get("/users/me").set(u.headers)).status).toBe(200);

    expect((await api().patch(`/users/${admin.sub}/status`).set(admin.headers).send({ isActive: false })).status).toBe(400);
    expect((await api().patch(`/users/${u.sub}/status`).set(admin.headers).send({ isActive: "no" })).status).toBe(400);
    expect((await api().patch(`/users/${newId()}/status`).set(admin.headers).send({ isActive: false })).status).toBe(404);
  });

  it("does not change the profile when the auth service rejects or is down", async () => {
    const admin = as("ADMIN");
    const u = as("COLLECTOR");
    await api().get("/users/me").set(u.headers);
    const url = `/users/${u.sub}/status`;

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    expect((await api().patch(url).set(admin.headers).send({ isActive: false })).status).toBe(502);
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect((await api().patch(url).set(admin.headers).send({ isActive: false })).status).toBe(502);
    expect((await UserProfile.findOne({ userId: u.sub }))!.isActive).toBe(true);
  });
});
