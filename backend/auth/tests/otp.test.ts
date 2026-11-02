import { describe, expect, it } from "vitest";
import { Otp } from "../models/Otp.js";
import { User } from "../models/User.js";
import { api, bearer, collectorLogin, registerRecycler } from "./helpers.js";
import { lastMail, mailsOf } from "./mailbox.js";

const request = (email: string) => api().post("/auth/otp/request").send({ email });
const verify = (email: string, code: string, name?: string) =>
  api().post("/auth/otp/verify").send({ email, code, name });

describe("collector OTP login", () => {
  it("emails a 6-digit code and returns a generic 202", async () => {
    const res = await request("col@example.com");
    expect(res.status).toBe(202);
    expect(lastMail("otp", "col@example.com")!.code).toMatch(/^\d{6}$/);
  });

  it("creates the collector on first verify and sends a welcome email", async () => {
    await request("col@example.com");
    const res = await verify("col@example.com", lastMail("otp")!.code!, "Col Lector");
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: "col@example.com", role: "COLLECTOR", name: "Col Lector" });
    expect(res.body.refreshToken).toBeTruthy();
    expect(mailsOf("welcome", "col@example.com")).toHaveLength(1);
  });

  it("defaults the name to the email prefix", async () => {
    const res = await collectorLogin("jane@example.com");
    expect(res.body.user.name).toBe("jane");
  });

  it("logs an existing collector in without creating a duplicate", async () => {
    await collectorLogin("col@example.com");
    const res = await collectorLogin("col@example.com");
    expect(res.status).toBe(200);
    expect(await User.countDocuments({ email: "col@example.com" })).toBe(1);
    expect(mailsOf("welcome")).toHaveLength(1);
  });

  it("issues tokens that work on authenticated routes", async () => {
    const { body } = await collectorLogin();
    expect((await api().get("/auth/me").set(bearer(body.accessToken))).status).toBe(200);
  });

  it("codes are single-use", async () => {
    await request("col@example.com");
    const code = lastMail("otp")!.code!;
    expect((await verify("col@example.com", code)).status).toBe(200);
    expect((await verify("col@example.com", code)).status).toBe(401);
  });

  it("only one of several concurrent verifications succeeds", async () => {
    await request("col@example.com");
    const code = lastMail("otp")!.code!;
    const results = await Promise.all(Array.from({ length: 5 }, () => verify("col@example.com", code)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await User.countDocuments({ email: "col@example.com" })).toBe(1);
  });

  it("a new code replaces the previous one", async () => {
    await request("col@example.com");
    const first = lastMail("otp")!.code!;
    await request("col@example.com");
    const second = lastMail("otp")!.code!;
    if (first !== second) expect((await verify("col@example.com", first)).status).toBe(401);
    expect((await verify("col@example.com", second)).status).toBe(200);
  });

  it("rejects wrong codes, then locks out after 5 attempts even for the right code", async () => {
    await request("col@example.com");
    const code = lastMail("otp")!.code!;
    const wrong = code === "111111" ? "222222" : "111111";
    for (let i = 0; i < 5; i++) expect((await verify("col@example.com", wrong)).status).toBe(401);
    expect((await verify("col@example.com", code)).status).toBe(401);
    expect(await Otp.countDocuments()).toBe(0);
  });

  it("rejects expired codes", async () => {
    await request("col@example.com");
    const code = lastMail("otp")!.code!;
    await Otp.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    expect((await verify("col@example.com", code)).status).toBe(401);
  });

  it("stores only an HMAC of the code", async () => {
    await request("col@example.com");
    const code = lastMail("otp")!.code!;
    const stored = await Otp.findOne();
    expect(JSON.stringify(stored)).not.toContain(code);
  });

  it("does not reveal account existence: recyclers get the same 202 but no code", async () => {
    await registerRecycler("rec@example.com");
    const res = await request("rec@example.com");
    expect(res.status).toBe(202);
    expect(res.body).toEqual((await request("new@example.com")).body);
    expect(mailsOf("otp", "rec@example.com")).toHaveLength(0);
    expect(await Otp.countDocuments({ email: "rec@example.com" })).toBe(0);
  });

  it("validates input", async () => {
    expect((await request("not-an-email")).status).toBe(400);
    expect((await verify("col@example.com", "12345")).status).toBe(400);
    expect((await verify("col@example.com", "abcdef")).status).toBe(400);
  });

  it("does not let a code for an unregistered email be used on another email", async () => {
    await request("a@example.com");
    const code = lastMail("otp", "a@example.com")!.code!;
    expect((await verify("b@example.com", code)).status).toBe(401);
  });
});
