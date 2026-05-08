import fs from "node:fs";
import path from "node:path";

export function loadEnv() {
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

export function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg.startsWith("--")) {
      const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s, 2);
      const key = normalizeArgKey(rawKey);
      const next = argv[index + 1];
      if (inlineValue !== undefined) {
        parsed[key] = coerceArgValue(inlineValue);
      } else if (!next || next === "--" || next.startsWith("--")) {
        parsed[key] = true;
      } else {
        parsed[key] = coerceArgValue(next);
        index += 1;
      }
    } else {
      parsed._.push(arg);
    }
  }
  return parsed;
}

export function readStringArg(args, name, env = process.env) {
  const key = normalizeArgKey(name);
  const value = args[key] ?? env[npmConfigKey(key)];
  if (value === undefined || value === true || value === false) return undefined;
  if (typeof value === "string" && ["", "true", "false"].includes(value.trim().toLowerCase())) return undefined;
  return String(value);
}

export function readBooleanFlag(args, name, argv = [], env = process.env) {
  const key = normalizeArgKey(name);
  if (hasRawFlag(argv, key)) return true;
  const value = args[key] ?? env[npmConfigKey(key)];
  if (value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return !["", "0", "false", "no", "off"].includes(value.trim().toLowerCase());
  }
  return Boolean(value);
}

export function hasRawFlag(argv, name) {
  const normalizedName = normalizeArgKey(name);
  return argv.some((arg) => {
    if (!arg.startsWith("--")) return false;
    const rawKey = arg.slice(2).split("=", 1)[0];
    return normalizeArgKey(rawKey) === normalizedName;
  });
}

function normalizeArgKey(key) {
  return key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function npmConfigKey(key) {
  return `npm_config_${key.replace(/-/g, "_")}`;
}

function coerceArgValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}
