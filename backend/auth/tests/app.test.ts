import { describe, expect, it } from "vitest";
import { api } from "./helpers.js";

describe("app basics", () => {
  it("GET /health reports the service is running", async () => {
    const res = await api().get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ service: "auth", status: "running" });
  });

  it("returns a JSON 404 for unknown routes", async () => {
    const res = await api().get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await api().post("/auth/login").set("Content-Type", "application/json").send("{bad");
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Invalid JSON body");
  });

  it("rejects oversized bodies", async () => {
    const res = await api().post("/auth/login").send({ email: "a@b.co", password: "x".repeat(200_000) });
    expect(res.status).toBe(413);
  });
});
