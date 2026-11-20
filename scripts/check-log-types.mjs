#!/usr/bin/env node
/**
 * CI guard: the public log types table (`logs/types.mdx`) and the hand-kept
 * `scripts/discord-titles.json` must cover every log type in the constants
 * repo's latest `main`. Fails naming the missing ones; fix by running
 * `node scripts/generate-reference.mjs` and adding a title for new types.
 * In CI the workflow's GIT_CONFIG_* insteadOf rewrites are the git auth.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const REF = process.env.LOG_TYPES_GUARD_REF || "main";
const dir = mkdtempSync(path.join(tmpdir(), "constants-main-"));
try {
  execFileSync("git", ["clone", "--quiet", "--depth", "1", "--branch", REF, "https://github.com/quark-bot-discord/constants.git", dir], {
    stdio: ["ignore", "ignore", "pipe"],
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  const C = await import(pathToFileURL(path.join(dir, "dist", "index.js")).href);
  const titles = JSON.parse(readFileSync(path.join(here, "discord-titles.json"), "utf8"));
  const mdx = readFileSync(path.join(here, "..", "logs", "types.mdx"), "utf8");
  const problems = [];
  for (const data of Object.values(C.SERVERLOG_TYPES)) {
    for (const log of data.logs) {
      if (log.disabled) continue;
      if (!(String(log.id) in titles)) problems.push(`discord-titles.json lacks ${log.id} "${log.name}"`);
      if (!mdx.includes(`| ${log.id} | ${log.name} |`)) problems.push(`logs/types.mdx lacks the row for ${log.id} "${log.name}"`);
    }
  }
  if (problems.length) {
    console.error(`check-log-types: FAILED against quark-constants ${REF}`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exitCode = 1;
  } else console.log("check-log-types: ok");
} catch (error) {
  console.error(`check-log-types: could not run (${String(error.stderr || error.message).trim()})`);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
