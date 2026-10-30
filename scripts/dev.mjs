import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverDirectory = path.join(rootDirectory, "apps/twenty-server");
const crmDirectory = path.join(rootDirectory, "apps/twenty-crm");
const composeFile = "compose.yaml";
const stagingRemote = "avm-staging";
const childProcesses = new Map();
let isShuttingDown = false;
let resolveShutdown;

const shutdownComplete = new Promise((resolve) => {
  resolveShutdown = resolve;
});

function getTwentyPort() {
  const envFile = path.join(serverDirectory, ".env");

  if (!existsSync(envFile)) {
    return 3000;
  }

  const portLine = readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .find((line) => line.startsWith("TWENTY_PORT="));
  const port = Number(portLine?.slice("TWENTY_PORT=".length));

  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 3000;
}

function runOnce(label, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), {
      cwd,
      stdio: "inherit",
    });

    child.once("error", (error) => {
      reject(new Error(`${label} could not start: ${error.message}`));
    });

    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} failed${signal ? ` with signal ${signal}` : ` (exit ${code})`}`));
    });
  });
}

function checkQuietly(label, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), {
      cwd,
      stdio: "ignore",
    });

    child.once("error", (error) => {
      reject(new Error(`${label} could not start: ${error.message}`));
    });

    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} failed (exit ${code})`));
    });
  });
}

function startLongRunning(label, args, cwd) {
  const child = spawn(args[0], args.slice(1), {
    cwd,
    detached: process.platform !== "win32",
    stdio: "inherit",
  });

  childProcesses.set(label, child);

  child.once("error", (error) => {
    console.error(`[dev] ${label} could not start: ${error.message}`);
    void shutdown(1);
  });

  child.once("exit", (code, signal) => {
    childProcesses.delete(label);

    if (!isShuttingDown) {
      console.error(`[dev] ${label} stopped${signal ? ` after ${signal}` : ` (exit ${code})`}`);
      void shutdown(code === 0 ? 1 : (code ?? 1));
    }
  });

  return child;
}

function signalProcessTree(child, signal) {
  if (!child.pid) {
    return;
  }

  try {
    process.kill(process.platform === "win32" ? child.pid : -child.pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") {
      console.error(`[dev] Could not stop child process: ${error.message}`);
    }
  }
}

async function stopComposeServices() {
  try {
    await runOnce(
      "Twenty Compose shutdown",
      ["docker", "compose", "--file", composeFile, "stop"],
      serverDirectory,
    );
  } catch (error) {
    console.error(`[dev] ${error.message}`);
  }
}

async function shutdown(exitCode) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  for (const child of childProcesses.values()) {
    signalProcessTree(child, "SIGINT");
  }

  await new Promise((resolve) => setTimeout(resolve, 1500));

  for (const child of childProcesses.values()) {
    signalProcessTree(child, "SIGTERM");
  }

  await stopComposeServices();
  process.exitCode = exitCode;
  resolveShutdown();
}

function assertTwentyNodeVersion() {
  const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);

  if (major < 24 || (major === 24 && minor < 5)) {
    throw new Error(
      `Twenty app development requires Node.js 24.5 or newer; ` +
        `this process uses ${process.versions.node}. Run \`nvm use\` ` +
        `from the project root (or activate Node.js 24.5+).`,
    );
  }
}

async function main() {
  assertTwentyNodeVersion();

  if (!existsSync(path.join(crmDirectory, "node_modules"))) {
    throw new Error(
      "Twenty CRM dependencies are missing. Run `corepack enable` and " +
        "`corepack yarn install` in apps/twenty-crm first.",
    );
  }

  await runOnce("Twenty CLI check", ["twenty", "--version"], crmDirectory);

  console.log("[dev] Starting the existing app and backend dev tasks with Turbo.");
  startLongRunning("Turbo dev tasks", ["pnpm", "exec", "turbo", "dev"], rootDirectory);

  if (!existsSync(path.join(serverDirectory, ".env"))) {
    console.log("[dev] Creating private local credentials for Twenty Compose.");
    await runOnce("Twenty local setup", ["./scripts/setup.sh"], serverDirectory);
  }

  console.log("[dev] Starting the Twenty server, database, and Redis.");
  await runOnce(
    "Twenty Compose startup",
    ["docker", "compose", "--file", composeFile, "up", "--detach", "--wait"],
    serverDirectory,
  );

  const stagingAuthStatus = ["twenty", "auth", "status", "--remote", stagingRemote, "--no-input"];

  try {
    await checkQuietly("Twenty staging authentication check", stagingAuthStatus, crmDirectory);
  } catch {
    console.log(
      `[dev] No authenticated ${stagingRemote} profile found. ` +
        "Opening browser sign-in for the staging workspace.",
    );

    try {
      await runOnce(
        "Twenty staging sign-in",
        [
          "twenty",
          "auth",
          "login",
          "--url",
          `http://localhost:${getTwentyPort()}`,
          "--name",
          stagingRemote,
          "--use",
        ],
        crmDirectory,
      );
      await checkQuietly("Twenty staging authentication check", stagingAuthStatus, crmDirectory);
    } catch {
      throw new Error(
        `Could not authenticate the CLI to staging. Finish the browser sign-in ` +
          `or run \`twenty auth login --url http://localhost:${getTwentyPort()} ` +
          `--name ${stagingRemote} --use\` manually. The watcher is pinned to ` +
          `the ${stagingRemote} remote to prevent syncing this schema to another ` +
          `workspace.`,
      );
    }
  }

  console.log(
    `[dev] Twenty is ready at http://localhost:${getTwentyPort()}. ` +
      "Starting the CRM schema watcher.",
  );
  startLongRunning(
    "Twenty CRM dev watcher",
    ["twenty", "app", "dev", "--remote", stagingRemote, "--create", "--no-delete"],
    crmDirectory,
  );

  await shutdownComplete;
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));

main().catch(async (error) => {
  console.error(`[dev] ${error.message}`);
  await shutdown(1);
});
