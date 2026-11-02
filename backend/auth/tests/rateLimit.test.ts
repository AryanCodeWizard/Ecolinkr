import { describe, expect, it } from "vitest";
import { redis } from "../config/redis.js";
import { api, PASSWORD, registerRecycler } from "./helpers.js";

const loginAttempt = (email: string, ip = "1.1.1.1") =>
  api().post("/auth/login").set("X-Forwarded-For", ip).send({ email, password: "wrong-password" });

describe("rate limiting", () => {
  it("limits login attempts per email (5 per window) regardless of IP, case or whitespace", async () => {
    for (let i = 0; i < 5; i++) expect((await loginAttempt("v@example.com", `10.0.0.${i}`)).status).toBe(401);
    const blocked = await loginAttempt("V@Example.com", "10.0.0.99");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(blocked.headers["ratelimit-limit"]).toBe("5");
    expect(blocked.headers["ratelimit-remaining"]).toBe("0");
  });

  it("does not affect other emails", async () => {
    for (let i = 0; i < 6; i++) await loginAttempt("v@example.com");
    expect((await loginAttempt("other@example.com")).status).toBe(401);
  });

  it("limits login attempts per IP (30 per window) across different emails", async () => {
    for (let i = 0; i < 30; i++) expect((await loginAttempt(`u${i}@example.com`, "2.2.2.2")).status).toBe(401);
    expect((await loginAttempt("u31@example.com", "2.2.2.2")).status).toBe(429);
    expect((await loginAttempt("u32@example.com", "3.3.3.3")).status).toBe(401);
  });

  it("limits registrations per email (3) and OTP requests per email (3)", async () => {
    for (let i = 0; i < 3; i++) await registerRecycler("r@example.com");
    expect((await registerRecycler("r@example.com")).status).toBe(429);

    const otp = () => api().post("/auth/otp/request").send({ email: "c@example.com" });
    for (let i = 0; i < 3; i++) expect((await otp()).status).toBe(202);
    expect((await otp()).status).toBe(429);
  });

  it("limits forgot-password per email (3 per hour)", async () => {
    const forgot = () => api().post("/auth/password/forgot").send({ email: "r@example.com" });
    for (let i = 0; i < 3; i++) expect((await forgot()).status).toBe(202);
    expect((await forgot()).status).toBe(429);
  });

  it("limits password changes per user (5 per window)", async () => {
    const { body } = await registerRecycler();
    const auth = { Authorization: `Bearer ${body.accessToken}` };
    const change = () =>
      api().post("/auth/password/change").set(auth).send({ currentPassword: "wrong-password", newPassword: "NewPass12345!" });
    for (let i = 0; i < 5; i++) expect((await change()).status).toBe(401);
    expect((await change()).status).toBe(429);
  });

  it("skips the email limit when no email is supplied", async () => {
    for (let i = 0; i < 6; i++) expect((await api().post("/auth/login").send({})).status).toBe(400);
  });

  it("sets an expiring counter in Redis", async () => {
    await loginAttempt("v@example.com");
    const keys = await redis.keys("rl:login:*");
    expect(keys.sort()).toEqual(["rl:login:email:v@example.com", "rl:login:ip:1.1.1.1"]);
    expect(await redis.pttl("rl:login:email:v@example.com")).toBeGreaterThan(0);
  });

  it("a successful login still counts toward the limit but works until it", async () => {
    await registerRecycler();
    for (let i = 0; i < 5; i++) {
      expect((await api().post("/auth/login").send({ email: "rec@example.com", password: PASSWORD })).status).toBe(200);
    }
    expect((await api().post("/auth/login").send({ email: "rec@example.com", password: PASSWORD })).status).toBe(429);
  });

  it("fails open when Redis is unavailable", async () => {
    await registerRecycler();
    redis.disconnect(); // keep this test last: Redis stays down for the rest of this file
    const res = await api().post("/auth/login").send({ email: "rec@example.com", password: PASSWORD });
    expect(res.status).toBe(200);
  });
});
