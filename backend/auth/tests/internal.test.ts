import { afterEach, describe, expect, it, vi } from "vitest";
import { RefreshToken } from "../models/RefreshToken.js";
import { User } from "../models/User.js";
import { INTERNAL, api, collectorLogin, login, registerRecycler } from "./helpers.js";

afterEach(() => vi.unstubAllGlobals());

describe("user sync (auth -> user service)", () => {
  it("posts new accounts to the user service with the internal key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const res = await registerRecycler("rec@example.com");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://user.test/internal/users");
    expect(init.headers["X-Internal-Key"]).toBe(INTERNAL["X-Internal-Key"]);
    expect(JSON.parse(init.body)).toEqual({
      userId: res.body.user.id, role: "RECYCLER", name: "Rec Co", email: "rec@example.com",
    });
  });

  it("syncs a collector only when first created", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await collectorLogin("col@example.com");
    await collectorLogin("col@example.com");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never fails sign-up when the user service is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await registerRecycler()).status).toBe(201);
  });
});

describe("PATCH /internal/users/:id/status", () => {
  it("requires the internal key", async () => {
    const { body } = await registerRecycler();
    const url = `/internal/users/${body.user.id}/status`;
    expect((await api().patch(url).send({ isActive: false })).status).toBe(401);
    expect((await api().patch(url).set("X-Internal-Key", "wrong").send({ isActive: false })).status).toBe(401);
  });

  it("deactivation blocks login and revokes sessions; reactivation restores it", async () => {
    const { body } = await registerRecycler();
    const url = `/internal/users/${body.user.id}/status`;
    expect((await api().patch(url).set(INTERNAL).send({ isActive: false })).status).toBe(200);
    expect((await User.findById(body.user.id))!.isActive).toBe(false);
    expect(await RefreshToken.countDocuments({ userId: body.user.id })).toBe(0);
    expect((await login()).status).toBe(401);

    await api().patch(url).set(INTERNAL).send({ isActive: true });
    expect((await login()).status).toBe(200);
  });

  it("validates id and body, 404s unknown users", async () => {
    expect((await api().patch("/internal/users/xyz/status").set(INTERNAL).send({ isActive: false })).status).toBe(400);
    expect((await api().patch("/internal/users/000000000000000000000000/status").set(INTERNAL).send({ isActive: false })).status).toBe(404);
    const { body } = await registerRecycler();
    expect((await api().patch(`/internal/users/${body.user.id}/status`).set(INTERNAL).send({ isActive: "no" })).status).toBe(400);
  });
});
