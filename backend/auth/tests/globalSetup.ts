import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestProject } from "vitest/node";

/**
 * Starts a throwaway mongod and redis-server for the test run (they must be on PATH).
 * To use existing instances instead, set TEST_MONGO_URI and TEST_REDIS_URL
 * (the tests wipe the data in them, so never point these at a real database).
 */

const children: ChildProcess[] = [];
let dataDir: string | undefined;

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });

const waitForPort = async (port: number, name: string) => {
  for (let i = 0; i < 100; i++) {
    const ok = await new Promise<boolean>((resolve) => {
      const s = net.connect(port, "127.0.0.1", () => (s.destroy(), resolve(true)));
      s.on("error", () => resolve(false));
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${name} did not start on port ${port}`);
};

const start = (cmd: string, args: string[]) => {
  const child = spawn(cmd, args, { stdio: "ignore" });
  child.on("error", (err) => {
    throw new Error(`Could not start ${cmd} (is it installed and on PATH?): ${err.message}`);
  });
  children.push(child);
};

export default async function setup(project: TestProject) {
  let mongoUri = process.env.TEST_MONGO_URI;
  let redisUrl = process.env.TEST_REDIS_URL;

  if (!mongoUri) {
    dataDir = mkdtempSync(join(tmpdir(), "auth-test-mongo-"));
    const port = await freePort();
    start("mongod", ["--dbpath", dataDir, "--port", String(port), "--bind_ip", "127.0.0.1"]);
    await waitForPort(port, "mongod");
    mongoUri = `mongodb://127.0.0.1:${port}/auth_test`;
  }
  if (!redisUrl) {
    const port = await freePort();
    start("redis-server", ["--port", String(port), "--save", "", "--appendonly", "no"]);
    await waitForPort(port, "redis-server");
    redisUrl = `redis://127.0.0.1:${port}`;
  }

  project.provide("mongoUri", mongoUri);
  project.provide("redisUrl", redisUrl);

  return () => {
    children.forEach((c) => c.kill("SIGTERM"));
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
    redisUrl: string;
  }
}
