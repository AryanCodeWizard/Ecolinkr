import { describe, expect, it } from "vitest";
import { User } from "../models/User.js";
import { api, bearer, login, PASSWORD, registerRecycler } from "./helpers.js";
import { lastMail, mailsOf } from "./mailbox.js";

describe("POST /auth/register", () => {
  it("creates a recycler and returns tokens", async () => {
    const res = await registerRecycler("Rec@Example.com");
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: "rec@example.com", role: "RECYCLER", name: "Rec Co" });
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("stores a bcrypt hash, never the password", async () => {
    await registerRecycler();
    const user = await User.findOne({ email: "rec@example.com" }).select("+passwordHash");
    expect(user!.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(user!.passwordHash).not.toContain(PASSWORD);
  });

  it("sends a welcome email, and no login alert for the first device", async () => {
    await registerRecycler();
    expect(mailsOf("welcome", "rec@example.com")).toHaveLength(1);
    expect(mailsOf("loginAlert")).toHaveLength(0);
  });

  it("returns 409 for a duplicate email, case-insensitively", async () => {
    await registerRecycler("dup@example.com");
    const res = await registerRecycler("DUP@example.com");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it.each([
    ["short password", { name: "A", email: "a@b.co", password: "short" }],
    ["bad email", { name: "A", email: "nope", password: PASSWORD }],
    ["missing name", { email: "a@b.co", password: PASSWORD }],
    ["admin role", { name: "A", email: "a@b.co", password: PASSWORD, role: "ADMIN" }],
    ["collector role", { name: "A", email: "a@b.co", password: PASSWORD, role: "COLLECTOR" }],
  ])("rejects %s with 400", async (_label, body) => {
    const res = await api().post("/auth/register").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });
});

describe("POST /auth/login", () => {
  it("logs in with correct credentials", async () => {
    await registerRecycler();
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it("is case-insensitive on email", async () => {
    await registerRecycler();
    expect((await login("REC@EXAMPLE.COM")).status).toBe(200);
  });

  it("returns the same 401 for a wrong password and an unknown email", async () => {
    await registerRecycler();
    const wrong = await login("rec@example.com", "wrong-password");
    const unknown = await login("ghost@example.com");
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("rejects deactivated users", async () => {
    await registerRecycler();
    await User.updateOne({ email: "rec@example.com" }, { isActive: false });
    expect((await login()).status).toBe(401);
  });

  it("access token works on a protected route", async () => {
    await registerRecycler();
    const { body } = await login();
    const me = await api().get("/auth/me").set(bearer(body.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ sub: body.user.id, role: "RECYCLER" });
  });
});

describe("new-device sign-in alerts", () => {
  const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
  const CHROME_NEWER = CHROME.replace("120.0.0.0", "121.0.6167.85");
  const FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";

  const loginAs = (headers: Record<string, string>) => {
    let r = api().post("/auth/login");
    for (const [k, v] of Object.entries(headers)) r = r.set(k, v);
    return r.send({ email: "rec@example.com", password: PASSWORD });
  };

  async function registerOn(headers: Record<string, string>) {
    let r = api().post("/auth/register");
    for (const [k, v] of Object.entries(headers)) r = r.set(k, v);
    return r.send({ name: "Rec", email: "rec@example.com", password: PASSWORD });
  }

  it("does not alert for the same device, an updated browser, or a new IP", async () => {
    await registerOn({ "User-Agent": CHROME });
    await loginAs({ "User-Agent": CHROME });
    await loginAs({ "User-Agent": CHROME_NEWER });
    await loginAs({ "User-Agent": CHROME, "X-Forwarded-For": "5.5.5.5" });
    expect(mailsOf("loginAlert")).toHaveLength(0);
  });

  it("alerts once for a new browser, with its IP and user agent", async () => {
    await registerOn({ "User-Agent": CHROME });
    await loginAs({ "User-Agent": FIREFOX, "X-Forwarded-For": "7.7.7.7" });
    await loginAs({ "User-Agent": FIREFOX });
    const alerts = mailsOf("loginAlert", "rec@example.com");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].ctx).toMatchObject({ ip: "7.7.7.7", userAgent: FIREFOX });
  });

  it("prefers X-Device-Id over the user agent", async () => {
    await registerOn({ "User-Agent": "okhttp/4.12", "X-Device-Id": "device-1" });
    await loginAs({ "User-Agent": "Other/1.0", "X-Device-Id": "device-1" });
    expect(mailsOf("loginAlert")).toHaveLength(0);
    await loginAs({ "User-Agent": "okhttp/4.12", "X-Device-Id": "device-2" });
    expect(mailsOf("loginAlert")).toHaveLength(1);
  });

  it("ignores an oversized X-Device-Id and falls back to the user agent", async () => {
    await registerOn({ "User-Agent": CHROME });
    await loginAs({ "User-Agent": CHROME, "X-Device-Id": "x".repeat(200) });
    expect(mailsOf("loginAlert")).toHaveLength(0);
  });

  it("still logs in when the email goes to the right address", async () => {
    await registerOn({ "User-Agent": CHROME });
    const res = await loginAs({ "User-Agent": FIREFOX });
    expect(res.status).toBe(200);
    expect(lastMail("loginAlert")!.to).toBe("rec@example.com");
  });
});
