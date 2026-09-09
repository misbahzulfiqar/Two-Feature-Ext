import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { createConnection } from "node:net";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REDIS_DIR = path.join(ROOT, "tools", "redis");
const REDIS_EXE = path.join(REDIS_DIR, "redis-server.exe");
const REDIS_ZIP = path.join(REDIS_DIR, "Redis-x64-5.0.14.1.zip");
const REDIS_DOWNLOAD =
  "https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip";
const HOST = "127.0.0.1";
const PORT = 6379;

function pingRedis(timeoutMs) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: HOST, port: PORT });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);
    socket.on("connect", () => {
      socket.write("PING\r\n");
    });
    socket.on("data", (buf) => {
      clearTimeout(timer);
      const ok = buf.toString().includes("PONG");
      socket.destroy();
      resolve(ok);
    });
    socket.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

async function waitForRedis(attempts) {
  for (let i = 0; i < attempts; i += 1) {
    if (await pingRedis(500)) {
      return true;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });
  }
  return false;
}

function windowsTar() {
  return path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      windowsHide: true,
      shell: false,
    });
    child.on("error", reject);
    child.on("close", resolve);
  });
}

async function extractZip() {
  const tarPath = windowsTar();
  if (existsSync(tarPath)) {
    const code = await run(tarPath, ["-xf", REDIS_ZIP, "-C", REDIS_DIR]);
    if (code === 0 && existsSync(REDIS_EXE)) {
      return;
    }
  }
  const code = await run("powershell.exe", [
    "-NoProfile",
    "-Command",
    `Expand-Archive -LiteralPath '${REDIS_ZIP.replaceAll("'", "''")}' -DestinationPath '${REDIS_DIR.replaceAll("'", "''")}' -Force`,
  ]);
  if (code !== 0 || !existsSync(REDIS_EXE)) {
    throw new Error("Failed to extract redis-server.exe");
  }
}

async function downloadZip() {
  mkdirSync(REDIS_DIR, { recursive: true });
  if (existsSync(REDIS_EXE)) {
    return;
  }
  if (!existsSync(REDIS_ZIP)) {
    console.log("Downloading portable Redis for Windows (no installer)...");
    const response = await fetch(REDIS_DOWNLOAD);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download Redis (${response.status})`);
    }
    await pipeline(response.body, createWriteStream(REDIS_ZIP));
  }
  await extractZip();
}

function startRedis() {
  const child = spawn(REDIS_EXE, ["--port", String(PORT), "--bind", HOST], {
    cwd: REDIS_DIR,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

async function main() {
  if (await pingRedis(800)) {
    console.log(`Redis already running at redis://${HOST}:${PORT}`);
    return;
  }
  if (process.platform !== "win32") {
    throw new Error("This helper only starts a portable Windows Redis. Use redis-server or Docker instead.");
  }
  await downloadZip();
  startRedis();
  if (!(await waitForRedis(20))) {
    throw new Error("redis-server started but did not accept connections on 6379");
  }
  console.log(`Redis listening at redis://${HOST}:${PORT}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
