import { env } from "./env.js";

export interface Route {
  /** Public path prefix; forwarded to the upstream unchanged. */
  prefix: string;
  name: string;
  target: string;
  /** Gateway rejects requests without a valid access token. Otherwise the upstream decides. */
  requireAuth: boolean;
}

// Only what is public is listed: /internal/* on every service is deliberately unreachable.
export const routes: Route[] = [
  { prefix: "/auth", name: "auth", target: env.AUTH_SERVICE_URL, requireAuth: false },
  { prefix: "/users", name: "user", target: env.USER_SERVICE_URL, requireAuth: true },
];
