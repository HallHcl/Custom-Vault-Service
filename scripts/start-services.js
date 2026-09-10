import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const backendDir = path.join(rootDir, "backend");
const frontendDir = path.join(rootDir, "frontend");

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
};

console.log(`${colors.bold}${colors.blue}========================================${colors.reset}`);
console.log(`${colors.bold}${colors.green}  Starting Custom Vault Service (QQM)  ${colors.reset}`);
console.log(`${colors.bold}${colors.blue}========================================${colors.reset}\n`);

// 1. Ensure PostgreSQL is running via Docker Compose
console.log(`${colors.cyan}[db]${colors.reset} Checking and starting PostgreSQL container (port 5433)...`);
try {
  execSync("docker compose up -d db", { cwd: rootDir, stdio: "inherit", shell: true });
  console.log(`${colors.green}[db] PostgreSQL container is ready.${colors.reset}\n`);
} catch (err) {
  console.error(`${colors.red}[db] Failed to start Docker DB container. Ensure Docker Desktop is running.${colors.reset}`);
  console.warn(`${colors.yellow}Continuing to start application services...${colors.reset}\n`);
}

// 2. Run Database Migrations
console.log(`${colors.cyan}[db]${colors.reset} Running database migrations...`);
try {
  execSync("npm run migrate", { cwd: backendDir, stdio: "inherit", shell: true });
  console.log(`${colors.green}[db] Migrations up to date.${colors.reset}\n`);
} catch (err) {
  console.warn(`${colors.yellow}[db] Migration check skipped or failed. Continuing...${colors.reset}\n`);
}

// 3. Helper to attach prefixed logging
function setupPrefixStream(stream, prefixColor, prefixText, targetStream = process.stdout) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      targetStream.write(`${prefixColor}[${prefixText}]${colors.reset} ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (buffer.length > 0) {
      targetStream.write(`${prefixColor}[${prefixText}]${colors.reset} ${buffer}\n`);
      buffer = "";
    }
  });
}

// 4. Start Backend
console.log(`${colors.cyan}[backend]${colors.reset} Starting backend (http://localhost:4000)...`);
const backendProc = spawn("npm", ["run", "dev"], {
  cwd: backendDir,
  shell: true,
  stdio: ["inherit", "pipe", "pipe"],
});
setupPrefixStream(backendProc.stdout, colors.cyan, "backend", process.stdout);
setupPrefixStream(backendProc.stderr, colors.cyan, "backend", process.stderr);

// 5. Start Frontend
console.log(`${colors.magenta}[frontend]${colors.reset} Starting frontend (http://localhost:5173)...`);
const frontendProc = spawn("npm", ["run", "dev"], {
  cwd: frontendDir,
  shell: true,
  stdio: ["inherit", "pipe", "pipe"],
});
setupPrefixStream(frontendProc.stdout, colors.magenta, "frontend", process.stdout);
setupPrefixStream(frontendProc.stderr, colors.magenta, "frontend", process.stderr);

console.log(`\n${colors.bold}${colors.green}All services launched!${colors.reset}`);
console.log(`- Frontend: ${colors.bold}http://localhost:5173${colors.reset}`);
console.log(`- Backend:  ${colors.bold}http://localhost:4000${colors.reset}`);
console.log(`- Swagger:  ${colors.bold}http://localhost:4000/api/docs${colors.reset}`);
console.log(`- Health:   ${colors.bold}http://localhost:4000/health${colors.reset}\n`);

// 6. Graceful shutdown handling
function cleanup() {
  console.log(`\n${colors.yellow}Shutting down services...${colors.reset}`);
  if (process.platform === "win32") {
    if (backendProc.pid) {
      try {
        execSync(`taskkill /pid ${backendProc.pid} /T /F`, { stdio: "ignore" });
      } catch {}
    }
    if (frontendProc.pid) {
      try {
        execSync(`taskkill /pid ${frontendProc.pid} /T /F`, { stdio: "ignore" });
      } catch {}
    }
  } else {
    backendProc.kill("SIGINT");
    frontendProc.kill("SIGINT");
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
