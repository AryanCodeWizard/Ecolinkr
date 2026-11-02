import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestProject } from "vitest/node";

/**
 * Starts a throwaway mongod for the test run (it must be on PATH).
 * To use an existing instance instead, set TEST_MONGO_URI (the tests wipe its data).
 */

let child: ChildProcess | undefined;
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

const waitForPort = async (port: number) => {
  for (let i = 0; i < 100; i++) {
    const ok = await new Promise<boolean>((resolve) => {
      const s = net.connect(port, "127.0.0.1", () => (s.destroy(), resolve(true)));
      s.on("error", () => resolve(false));
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`mongod did not start on port ${port}`);
};

export default async function setup(project: TestProject) {
  let mongoUri = process.env.TEST_MONGO_URI;

  if (!mongoUri) {
    dataDir = mkdtempSync(join(tmpdir(), "user-test-mongo-"));
    const port = await freePort();
    child = spawn("mongod", ["--dbpath", dataDir, "--port", String(port), "--bind_ip", "127.0.0.1"], {
      stdio: "ignore",
    });
    child.on("error", (err) => {
      throw new Error(`Could not start mongod (is it installed and on PATH?): ${err.message}`);
    });
    await waitForPort(port);
    mongoUri = `mongodb://127.0.0.1:${port}/user_test`;
  }

  project.provide("mongoUri", mongoUri);

  return () => {
    child?.kill("SIGTERM");
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
