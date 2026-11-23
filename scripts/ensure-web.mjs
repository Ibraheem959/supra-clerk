import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const frontend = join(dirname(fileURLToPath(import.meta.url)), "../frontend");
const index = join(frontend, "dist/index.html");
if (existsSync(index)) process.exit(0);

const env = process.env;
const install = spawnSync("npm", ["ci", "--include=dev"], { cwd: frontend, stdio: "inherit", env });
if (install.status !== 0) process.exit(install.status ?? 1);
const build = spawnSync("npm", ["run", "build"], { cwd: frontend, stdio: "inherit", env });
process.exit(build.status ?? 0);
