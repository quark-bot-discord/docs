#!/usr/bin/env node
// Regenerates the two reference tables that go stale fastest:
//
//   logs/types.mdx     <- SERVERLOG_TYPES in quark-constants
//   commands/list.mdx  <- commands.json emitted by commands-webserver
//
// Only the text between the GENERATED markers in each page is replaced, so the
// prose around the tables can be edited by hand.
//
// Usage, from the docs repo, with the other repos checked out next to it:
//
//   node scripts/generate-reference.mjs
//   node scripts/generate-reference.mjs --constants ../constants --commands ../commands-webserver
//
// constants must be built (dist/index.js) and commands-webserver must have a
// commands.json (emitted by its build).

import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return resolve(root, i === -1 ? fallback : process.argv[i + 1]);
};
const constantsDir = arg("constants", "../constants");
const commandsDir = arg("commands", "../commands-webserver");

const require = createRequire(import.meta.url);
const constants = require(resolve(constantsDir, "dist/index.js"));
const commands = JSON.parse(
  readFileSync(resolve(commandsDir, "commands.json"), "utf8"),
);
const discordTitles = JSON.parse(
  readFileSync(resolve(here, "discord-titles.json"), "utf8"),
);

// ---------------------------------------------------------------------------
// Log types
// ---------------------------------------------------------------------------

// The label each category has on the dashboard's Channels tab.
const CATEGORY_LABELS = {
  categoryMembers: "Members",
  categoryText: "Messages",
  categoryVoice: "Voice",
  categoryActions: "Actions",
  categoryChannels: "Channels",
  categoryServer: "Server",
  categoryRoles: "Roles",
  categoryQuark: "Quark Events",
  categoryModlog: "Modlogs",
};

// Log types that are only ever built from an audit log entry, so they are
// never sent unless Quark has View Audit Log. Checked against the handlers in
// serverlog (src/handlers/client/guildAuditLogEntryCreate.ts and the events
// that call fetchAuditLogs without catching a missing permission).
//
// This is NOT the same list as AUDIT_LOG_DEPENDENT_TYPES in database-tools:
// soundboard and AutoMod rule logs (93-98) are sent from their own gateway
// events and only lose the executor, while bulk delete (3), Thread Delete (11),
// Bot Added (57) and Thread Updated (87) do depend on the audit log.
const NEEDS_AUDIT_LOG = new Set([
  39, 40, 41, 42, 43, 31, 32, 33, 44, 45, 50, 53, 27, 28, 29, 47, 48, 49, 79,
  80, 81, 82, 83, 84, 85, 30, 52, 25, 46, 24, 36, 37, 38, 65, 66, 67, 90, 91,
  92, 14, 22, 54, 59, 60, 61, 3, 11, 57, 87,
]);

const WITHOUT_AUDIT_LOG = "Without View Audit Log, sent without who did it";
const NOTES = {
  0: "Sent to the Files channel. A separate log when a Files channel is set, or when an attachment is removed by editing a message",
  3: "Attaches a text file of the deleted messages",
  16: "Moderator shown on Quark Pro",
  19: "Moderator shown on Quark Pro",
  20: "Moderator shown on Quark Pro",
  21: "Moderator shown on Quark Pro",
  33: "Shows gradient and holographic colours",
  34: "Not currently sent",
  35: "Not currently sent",
  55: 'Says "Someone" when Discord does not say who boosted',
  56: 'Says "Someone" when Discord does not say who stopped boosting',
  69: "Also records Active Ignore requests. Those are logged even when this type is switched off",
  88: "Several voice events close together, sent as one log",
  93: WITHOUT_AUDIT_LOG,
  94: WITHOUT_AUDIT_LOG,
  95: WITHOUT_AUDIT_LOG,
  96: WITHOUT_AUDIT_LOG,
  97: WITHOUT_AUDIT_LOG,
  98: WITHOUT_AUDIT_LOG,
  100: "Several reaction removals close together, sent as one log",
  101: "What an automation rule did. A rule's moderation actions are logged even when this type is switched off",
};

// In EXCLUDED_IGNORE_BOT, but the note would mislead: a Rule Action log is
// Quark reporting what a rule did, so it has no executor for the bot rules to
// apply to.
const NO_BOT_NOTE = new Set([101]);

const alwaysLogsBots = new Set(constants.EXCLUDED_IGNORE_BOT);

function logTypesTable() {
  const rows = [];
  for (const [categoryKey, category] of Object.entries(
    constants.SERVERLOG_TYPES,
  )) {
    const label = CATEGORY_LABELS[categoryKey];
    if (!label) throw new Error(`No label for category ${categoryKey}`);
    for (const log of [...category.logs]
      .filter((l) => !l.disabled)
      .sort((a, b) => a.id - b.id)) {
      const notes = [];
      if (alwaysLogsBots.has(log.id) && !NO_BOT_NOTE.has(log.id))
        notes.push("Always logged for bots");
      if (NOTES[log.id]) notes.push(NOTES[log.id]);
      rows.push(
        `| ${log.id} | ${log.name} | ${discordTitles[log.id] ?? log.name} | ${label} | ${
          NEEDS_AUDIT_LOG.has(log.id) ? "Yes" : ""
        } | ${notes.join(". ")} |`,
      );
    }
  }
  const categories = Object.keys(constants.SERVERLOG_TYPES).length;
  return [
    `{/* Generated by scripts/generate-reference.mjs - do not edit by hand. */}`,
    "",
    `Quark has **${rows.length} log types** in ${categories} categories.`,
    "",
    "| ID | Name on the dashboard | Title in Discord | Category | Needs View Audit Log | Notes |",
    "| -: | --- | --- | --- | :-: | --- |",
    ...rows,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const PERMISSION_NAMES = [
  [1n << 1n, "Kick Members"],
  [1n << 2n, "Ban Members"],
  [1n << 3n, "Administrator"],
  [1n << 4n, "Manage Channels"],
  [1n << 5n, "Manage Server"],
  [1n << 13n, "Manage Messages"],
  [1n << 40n, "Timeout Members"],
];

function decodePermissions(raw) {
  if (raw === undefined || raw === null) return "Everyone";
  let bits = BigInt(raw);
  const names = [];
  for (const [bit, name] of PERMISSION_NAMES) {
    if (bits & bit) {
      names.push(name);
      bits &= ~bit;
    }
  }
  if (bits !== 0n) throw new Error(`Unknown permission bits in ${raw}`);
  return names.join(" and ");
}

const OPTION_TYPES = {
  3: "text",
  4: "whole number",
  5: "true / false",
  6: "user",
  10: "number",
};

function describeOption(option) {
  const parts = [OPTION_TYPES[option.type] ?? `type ${option.type}`];
  parts.push(option.required ? "required" : "optional");
  if (option.min_value !== undefined && option.max_value !== undefined)
    parts.push(`${option.min_value} to ${option.max_value}`);
  if (option.max_length !== undefined)
    parts.push(`up to ${option.max_length} characters`);
  if (option.choices?.length && option.choices.length <= 5)
    parts.push(option.choices.map((c) => `\`${c.value}\``).join(", "));
  return `\`${option.name}\` (${parts.join(", ")})`;
}

// Discord gives message menu commands no description, so they are kept here.
// Add an entry when one is added.
const MESSAGE_MENU_DESCRIPTIONS = {
  "See initial reactors": "Show who first added each reaction to a message",
  "Get IDs": "List the IDs in a log",
  "Report log issue": "Send a log that looks wrong to Quark's developers",
};

function describeCommand(command) {
  if (command.description) return command.description;
  const description = MESSAGE_MENU_DESCRIPTIONS[command.name];
  if (!description)
    throw new Error(
      `No description for "${command.name}". Add one to MESSAGE_MENU_DESCRIPTIONS`,
    );
  return description;
}

function commandsTable() {
  const rows = [];
  for (const command of commands) {
    const isContextMenu = command.type === 3;
    const name = isContextMenu
      ? `**${command.name}** (message menu)`
      : `\`/${command.name}\``;
    const options = command.options ?? [];
    const subcommands = options.filter((o) => o.type === 1);
    if (subcommands.length) {
      for (const sub of subcommands) {
        rows.push(
          `| \`/${command.name} ${sub.name}\` | ${sub.description} | ${decodePermissions(
            command.default_member_permissions,
          )} | ${(sub.options ?? []).map(describeOption).join("<br />") || "None"} |`,
        );
      }
      continue;
    }
    rows.push(
      `| ${name} | ${describeCommand(command)} | ${decodePermissions(command.default_member_permissions)} | ${
        options.map(describeOption).join("<br />") || "None"
      } |`,
    );
  }
  return [
    `{/* ${commands.length} commands. Generated by scripts/generate-reference.mjs - do not edit by hand. */}`,
    "",
    "| Command | What it does | Who can use it by default | Options |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

// ---------------------------------------------------------------------------

function replaceGenerated(file, content) {
  const path = resolve(root, file);
  const before = readFileSync(path, "utf8");
  const pattern =
    /(\{\/\* GENERATED:START \*\/\}\n)[\s\S]*?(\{\/\* GENERATED:END \*\/\})/;
  if (!pattern.test(before))
    throw new Error(`${file} has no GENERATED markers`);
  const after = before.replace(pattern, (_, start, end) => `${start}${content}\n${end}`);
  writeFileSync(path, after);
  console.log(`${file}: ${after === before ? "unchanged" : "updated"}`);
}

replaceGenerated("logs/types.mdx", logTypesTable());
replaceGenerated("commands/list.mdx", commandsTable());
