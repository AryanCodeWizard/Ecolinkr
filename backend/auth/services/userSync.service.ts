import { env } from "../config/env.js";

// Tells the user service about a newly created account. Best-effort: the user service also
// creates a profile on first access, so a failure here must never fail sign-up.
export async function syncUser(u: { id: string; role: string; name: string; email?: string | null }) {
  try {
    const res = await fetch(`${env.USER_SERVICE_URL}/internal/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": env.INTERNAL_API_KEY },
      body: JSON.stringify({ userId: u.id, role: u.role, name: u.name, email: u.email ?? undefined }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) console.error(`User sync failed: ${res.status}`);
  } catch (err) {
    console.error("User sync failed:", err);
  }
}
