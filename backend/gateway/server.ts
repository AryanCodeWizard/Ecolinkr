import { env } from "./config/env.js";
import { app } from "./app.js";

const server = app.listen(env.PORT, () => {
  console.log(`Gateway service is running on port ${env.PORT}`);
});

server.on("error", (err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
