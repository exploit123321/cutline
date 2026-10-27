import { existsSync } from "node:fs";

/** Node 22 reads .env natively; no dotenv dependency needed. */
export function loadEnv(path = ".env"): void {
  if (existsSync(path)) process.loadEnvFile(path);
}
