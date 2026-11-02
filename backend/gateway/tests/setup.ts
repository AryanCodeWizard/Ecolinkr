Object.assign(process.env, {
  NODE_ENV: "test",
  JWT_ACCESS_SECRET: "test-access-secret-0123456789",
  UPSTREAM_TIMEOUT_MS: "500",
  RATE_LIMIT_PER_MINUTE: "50",
  TRUST_PROXY: "1", // lets tests set the client IP via X-Forwarded-For
});
