#!/usr/bin/env node

// Reads GrabFood cookies from ~/.grab-food/cookies.json
// Run: node scripts/init-cookies.mjs   (one-time setup)

import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_DIR = join(homedir(), ".grab-food");
const CONFIG_PATH = join(CONFIG_DIR, "cookies.json");

let COOKIES = process.env.GRAB_COOKIES;

if (!COOKIES) {
  if (existsSync(CONFIG_PATH)) {
    try {
      const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
      COOKIES = cfg.cookies;
    } catch (err) {
      console.error(`Failed to read ${CONFIG_PATH}: ${err.message}`);
      process.exit(2);
    }
  }
}

if (!COOKIES) {
  console.error("No GrabFood cookies found.");
  console.error("Set GRAB_COOKIES env var, or run: node scripts/init-cookies.mjs");
  process.exit(2);
}

const BASE = "https://portal.grab.com/foodweb/guest/v2";

const COMMON_HEADERS = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en",
  "cache-control": "no-cache",
  pragma: "no-cache",
  priority: "u=1, i",
  "x-country-code": "VN",
  "x-gfc-country": "VN",
  "x-grab-web-app-version": "r7QcvLgfvvXwls2thqHJt",
  cookie: COOKIES,
};

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));
const [command, ...rest] = positional;

if (!command || !["nearby", "menu"].includes(command)) {
  console.error("Usage:");
  console.error("  node scripts/grab-food.mjs nearby <latlng> [--category=5047] [--offset=0] [--pageSize=32] [--raw]");
  console.error("  node scripts/grab-food.mjs menu <merchantID> <latlng> [--raw]");
  process.exit(2);
}

function getFlag(name, fallback) {
  const f = args.find((a) => a.startsWith(`--${name}=`));
  return f ? f.split("=").slice(1).join("=") : fallback;
}

function handleAuthError(status) {
  if (status === 401 || status === 403) {
    console.error("");
    console.error("Cookies expired. Ask the user to refresh them via:");
    console.error("  node scripts/init-cookies.mjs");
    console.error("");
    console.error("Or manually set GRAB_COOKIES env var with the three cookie values.");
  }
}

async function main() {
  if (command === "nearby") {
    const latlng = rest[0];
    if (!latlng) {
      console.error("Missing latlng. Usage: node grab-food.mjs nearby <latlng>");
      process.exit(2);
    }
    const categoryShortcutID = getFlag("category", "5047");
    const offset = getFlag("offset", "0");
    const pageSize = getFlag("pageSize", "32");

    const url = `${BASE}/category?latlng=${encodeURIComponent(latlng)}&categoryShortcutID=${categoryShortcutID}&offset=${offset}&pageSize=${pageSize}`;

    const res = await fetch(url, {
      method: "GET",
      headers: COMMON_HEADERS,
      referrer: "https://food.grab.com/",
    });

    if (!res.ok) {
      console.error(`HTTP ${res.status} ${res.statusText}`);
      handleAuthError(res.status);
      const text = await res.text();
      if (text) console.error(text.slice(0, 500));
      process.exit(1);
    }

    const data = await res.json();

    if (flags.has("--raw")) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    const total = data?.searchResult?.totalCount || 0;
    const merchants = data?.searchResult?.searchMerchants || [];
    console.log(`Total: ${total} | Showing ${merchants.length} (offset=${offset}):\n`);
    for (const m of merchants) {
      const b = m.merchantBrief || {};
      console.log(`  ID:     ${m.id}`);
      console.log(`  Name:   ${b.merchantName || m.address?.name || "N/A"}`);
      console.log(`  Branch: ${m.branchName || "N/A"}`);
      console.log(`  Cuisine: ${Array.isArray(b.cuisine) ? b.cuisine.join(", ") : "N/A"}`);
      console.log(`  Dist:   ${b.distanceInKm ? b.distanceInKm + " km" : "N/A"}`);
      console.log(`  ETA:    ${m.estimatedDeliveryTime ? m.estimatedDeliveryTime + " min" : "N/A"}`);
      console.log(`  Rating: ${b.rating ? b.rating + "/5 (" + b.vote_count + " votes)" : "N/A"}`);
      console.log(`  Fee:    ${m.estimatedDeliveryFee?.priceDisplay || "N/A"}`);
      if (b.promo?.hasPromo) console.log(`  Promo:  ${b.displayInfo?.additionalText || "Yes"}`);
      console.log("");
    }
  }

  if (command === "menu") {
    const [merchantID, latlng] = rest;
    if (!merchantID || !latlng) {
      console.error("Missing args. Usage: node grab-food.mjs menu <merchantID> <latlng>");
      process.exit(2);
    }

    const url = `${BASE}/merchants/${encodeURIComponent(merchantID)}?latlng=${encodeURIComponent(latlng)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: COMMON_HEADERS,
      referrer: "https://food.grab.com/",
    });

    if (!res.ok) {
      console.error(`HTTP ${res.status} ${res.statusText}`);
      handleAuthError(res.status);
      const text = await res.text();
      if (text) console.error(text.slice(0, 500));
      process.exit(1);
    }

    const data = await res.json();

    if (flags.has("--raw")) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    const merchant = data?.merchant;
    const name = merchant?.name || merchantID;
    const address = merchant?.address;
    const categories = merchant?.menu?.categories || [];

    console.log(`${name}`);
    if (address) {
      console.log(`${address.combined_address || address.street || ""}, ${address.city || ""}\n`);
    }

    for (const cat of categories) {
      console.log(`  ── ${cat.name} ──`);
      for (const item of cat.items || []) {
        const price = item.priceInMinorUnit
          ? `${(item.priceInMinorUnit / 1000).toFixed(0)}.${String(item.priceInMinorUnit % 1000).padStart(3, "0")}₫`
          : "N/A";
        console.log(`    ${item.name}  (${price})`);
        if (item.description) {
          console.log(`      ${item.description.slice(0, 120)}${item.description.length > 120 ? "..." : ""}`);
        }
      }
      console.log("");
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});