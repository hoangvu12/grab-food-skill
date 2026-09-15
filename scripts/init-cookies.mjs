#!/usr/bin/env node
// Agent-friendly cookie setup for GrabFood.
//
// Interactive mode (agent asks user for input):
//   node scripts/init-cookies.mjs
//
// Non-interactive mode (agent pipes in the cookie string):
//   node scripts/init-cookies.mjs "grabid-openid-authn-ck=...; passenger_authn_token=...; ..."
//
// Verify cookies work:
//   node scripts/init-cookies.mjs --verify

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const CONFIG_DIR = join(homedir(), ".grab-food");
const CONFIG_PATH = join(CONFIG_DIR, "cookies.json");

const args = process.argv.slice(2);

if (args.includes("--verify")) {
  if (!existsSync(CONFIG_PATH)) {
    console.error("No cookies file found at " + CONFIG_PATH);
    process.exit(1);
  }
  const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  const cookies = cfg.cookies;
  if (!cookies) {
    console.error("cookies.json exists but has no 'cookies' field");
    process.exit(1);
  }
  console.log("Cookies file found. Validating against GrabFood API...");
  const res = await fetch(
    "https://portal.grab.com/foodweb/guest/v2/category?latlng=21.0285,105.8542&categoryShortcutID=5047&offset=0&pageSize=1",
    {
      headers: {
        accept: "application/json",
        "x-country-code": "VN",
        "x-gfc-country": "VN",
        cookie: cookies,
      },
      referrer: "https://food.grab.com/",
    }
  );
  if (res.ok) {
    const data = await res.json();
    const total = data?.searchResult?.totalCount || 0;
    console.log(`Verified: ${total} restaurants found. Cookies work.`);
    process.exit(0);
  } else {
    console.error(`Validation failed: HTTP ${res.status} ${res.statusText}`);
    console.error("Cookies are expired or invalid. Re-run this script to refresh.");
    process.exit(1);
  }
}

const rawFromArg = args.find((a) => !a.startsWith("--"));

if (rawFromArg) {
  // Non-interactive: agent passes cookies as arg
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify({ cookies: rawFromArg }, null, 2), "utf8");
  console.log("Saved to " + CONFIG_PATH);
  process.exit(0);
}

// Interactive mode
const rl = createInterface({ input: process.stdin, output: process.stdout });
function ask(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

console.log("");
console.log("To use GrabFood from the CLI, you need 3 cookies from food.grab.com:");
console.log("");
console.log("  1. Open https://food.grab.com in a browser");
console.log("  2. Open DevTools (F12) -> Application -> Cookies -> portal.grab.com");
console.log("  3. Copy the full Value of each cookie:");
console.log("     - grabid-openid-authn-ck");
console.log("     - passenger_authn_token");
console.log("     - passenger_authn_token_jti");
console.log("");
console.log("Paste them together as one string:");
console.log('  grabid-openid-authn-ck=...; passenger_authn_token=...; passenger_authn_token_jti=...');
console.log("");

const raw = (await ask("Paste cookie string (or press Enter to skip): ")).trim();

if (!raw) {
  console.log("\nSkipped. Set GRAB_COOKIES env var or re-run this script.");
  rl.close();
  process.exit(0);
}

mkdirSync(CONFIG_DIR, { recursive: true });
writeFileSync(CONFIG_PATH, JSON.stringify({ cookies: raw }, null, 2), "utf8");
console.log("\nSaved to " + CONFIG_PATH);

// Auto-verify
console.log("Verifying cookies...");
const res = await fetch(
  "https://portal.grab.com/foodweb/guest/v2/category?latlng=21.0285,105.8542&categoryShortcutID=5047&offset=0&pageSize=1",
  {
    headers: {
      accept: "application/json",
      "x-country-code": "VN",
      "x-gfc-country": "VN",
      cookie: raw,
    },
    referrer: "https://food.grab.com/",
  }
);

if (res.ok) {
  const body = await res.json();
  const total = body?.searchResult?.totalCount || 0;
  console.log("OK - " + total + " restaurants found. Ready to use.\n");
  console.log("Try: node scripts/grab-food.mjs nearby 'LAT,LNG'");
} else {
  console.warn("WARNING: HTTP " + res.status + " - cookies may be expired or incomplete.");
  console.warn("Re-check the cookie values and run this script again.");
}

rl.close();