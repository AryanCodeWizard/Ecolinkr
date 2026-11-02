import { describe, expect, it } from "vitest";
import { PasswordReset } from "../models/PasswordReset.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { api, bearer, collectorLogin, login, PASSWORD, registerRecycler, tokenFromResetLink } from "./helpers.js";
import { lastMail, mailsOf } from "./mailbox.js";

const forgot = (email: string) => api().post("/auth/password/forgot").send({ email });
const reset = (token: string, newPassword: string) =>
  api().post("/auth/password/reset").send({ token, newPassword });
const NEW_PASSWORD = "BrandNewPass456!";

async function requestResetToken(email = "rec@example.com") {
  await forgot(email);
  return tokenFromResetLink(lastMail("passwordReset", email)!.link!);
}

describe("POST /auth/password/forgot", () => {
  it("emails a reset link to the frontend URL", async () => {
    await registerRecycler();
    const res = await forgot("rec@example.com");
    expect(res.status).toBe(202);
    const mail = lastMail("passwordReset", "rec@example.com")!;
    expect(mail.link!.startsWith("http://localhost:5173/reset-password?token=")).toBe(true);
  });

  it("gives an identical response for known and unknown emails (no enumeration)", async () => {
    await registerRecycler();
    const known = await forgot("rec@example.com");
    const unknown = await forgot("ghost@example.com");
    expect(known.status).toBe(unknown.status);
    expect(known.body).toEqual(unknown.body);
    expect(mailsOf("passwordReset")).toHaveLength(1);
  });

  it("sends nothing to OTP-only collectors (no password to reset)", async () => {
    await collectorLogin("col@example.com");
    expect((await forgot("col@example.com")).status).toBe(202);
    expect(mailsOf("passwordReset")).toHaveLength(0);
  });

  it("only the latest link works", async () => {
    await registerRecycler();
    const first = await requestResetToken();
    const second = await requestResetToken();
    expect((await reset(first, NEW_PASSWORD)).status).toBe(400);
    expect((await reset(second, NEW_PASSWORD)).status).toBe(200);
  });

  it("stores only a hash of the token", async () => {
    await registerRecycler();
    const token = await requestResetToken();
    expect(JSON.stringify(await PasswordReset.findOne())).not.toContain(token);
  });

  it("validates the email", async () => {
    expect((await forgot("nope")).status).toBe(400);
  });
});

describe("POST /auth/password/reset", () => {
  it("sets the new password, ends every session and notifies the user", async () => {
    const { body: session } = await registerRecycler();
    const token = await requestResetToken();
    const res = await reset(token, NEW_PASSWORD);
    expect(res.status).toBe(200);

    expect((await login("rec@example.com", PASSWORD)).status).toBe(401);
    expect((await login("rec@example.com", NEW_PASSWORD)).status).toBe(200);
    expect((await api().post("/auth/refresh").send({ refreshToken: session.refreshToken })).status).toBe(401);
    expect(mailsOf("passwordChanged", "rec@example.com")).toHaveLength(1);
  });

  it("tokens are single-use", async () => {
    await registerRecycler();
    const token = await requestResetToken();
    expect((await reset(token, NEW_PASSWORD)).status).toBe(200);
    expect((await reset(token, "AnotherPass789!")).status).toBe(400);
    expect((await login("rec@example.com", NEW_PASSWORD)).status).toBe(200);
  });

  it("only one of several concurrent resets succeeds", async () => {
    await registerRecycler();
    const token = await requestResetToken();
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => reset(token, `ConcurrentPass${i}!`)),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it("rejects expired, invalid and malformed requests", async () => {
    await registerRecycler();
    const token = await requestResetToken();
    expect((await reset("garbage", NEW_PASSWORD)).status).toBe(400);
    expect((await reset(token, "short")).status).toBe(400);
    expect((await api().post("/auth/password/reset").send({})).status).toBe(400);
    await PasswordReset.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    expect((await reset(token, NEW_PASSWORD)).status).toBe(400);
    // the original password is untouched by all of the above
    expect((await login()).status).toBe(200);
  });

  it("rejects a token for a deactivated user", async () => {
    await registerRecycler();
    const token = await requestResetToken();
    const { User } = await import("../models/User.js");
    await User.updateOne({ email: "rec@example.com" }, { isActive: false });
    expect((await reset(token, NEW_PASSWORD)).status).toBe(400);
  });
});

describe("POST /auth/password/change", () => {
  const change = (accessToken: string, currentPassword: string, newPassword: string) =>
    api().post("/auth/password/change").set(bearer(accessToken)).send({ currentPassword, newPassword });

  it("requires authentication", async () => {
    expect((await api().post("/auth/password/change").send({})).status).toBe(401);
  });

  it("changes the password, keeps this session alive and signs out the others", async () => {
    await registerRecycler();
    const a = (await login()).body;
    const b = (await login()).body;
    const res = await change(a.accessToken, PASSWORD, NEW_PASSWORD);
    expect(res.status).toBe(200);

    expect((await api().post("/auth/refresh").send({ refreshToken: b.refreshToken })).status).toBe(401);
    expect((await api().post("/auth/refresh").send({ refreshToken: a.refreshToken })).status).toBe(401);
    expect((await api().post("/auth/refresh").send({ refreshToken: res.body.refreshToken })).status).toBe(200);
    expect((await login("rec@example.com", NEW_PASSWORD)).status).toBe(200);
    expect((await login("rec@example.com", PASSWORD)).status).toBe(401);
    expect(mailsOf("passwordChanged", "rec@example.com")).toHaveLength(1);
  });

  it("rejects a wrong current password", async () => {
    const { body } = await registerRecycler();
    const res = await change(body.accessToken, "wrong-password", NEW_PASSWORD);
    expect(res.status).toBe(401);
    expect((await login()).status).toBe(200);
  });

  it("rejects an unchanged or too-short new password", async () => {
    const { body } = await registerRecycler();
    expect((await change(body.accessToken, PASSWORD, PASSWORD)).status).toBe(400);
    expect((await change(body.accessToken, PASSWORD, "short")).status).toBe(400);
  });

  it("cancels pending reset links", async () => {
    const { body } = await registerRecycler();
    const token = await requestResetToken();
    await change(body.accessToken, PASSWORD, NEW_PASSWORD);
    expect((await reset(token, "AnotherPass789!")).status).toBe(400);
  });

  it("returns 400 for accounts without a password (OTP collectors)", async () => {
    const { body } = await collectorLogin();
    const res = await change(body.accessToken, "whatever", NEW_PASSWORD);
    expect(res.status).toBe(400);
    expect(await RefreshToken.countDocuments()).toBeGreaterThan(0); // sessions untouched
  });
});
