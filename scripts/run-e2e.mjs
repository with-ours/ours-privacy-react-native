#!/usr/bin/env node

/**
 * E2E test runner for the Ours Privacy React Native SDK.
 *
 * Orchestrates: clear captures → start capture server → wait for events →
 * run assertions → report results.
 *
 * The Demo app must already be running with E2E_AUTOFIRE=true in .env.
 * This script handles the capture + assertion side.
 *
 * Usage:
 *   node scripts/run-e2e.mjs [--timeout 30] [--dir tmp/captures]
 *
 * Typical workflow:
 *   1. Set Demo/.env: E2E_AUTOFIRE=true, OURSPRIVACY_SERVER_URL=http://...
 *   2. Start the capture server + run e2e:
 *        npm run e2e
 *   3. Launch the Demo app (separate terminal):
 *        - iOS:     npx react-native run-ios --simulator="iPhone 16 Pro"
 *        - Android: adb shell am start -n com.example/.MainActivity
 *
 * Or use the platform-specific shortcuts:
 *   npm run e2e:ios      # runs capture server, waits, asserts
 *   npm run e2e:android  # same, for Android emulator
 */

import {spawn, execSync} from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const getArgValue = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index === -1 || index === args.length - 1 ? fallback : args[index + 1];
};

const captureDir = path.resolve(getArgValue("--dir", "tmp/captures"));
const timeoutSecs = Number.parseInt(getArgValue("--timeout", "30"), 10);

// Expected events from the auto-fire sequence (in rough order)
const EXPECTED_EVENTS = [
  "$deep_link_opened",  // cold-start
  "button_pressed",
  "$identify",
  "defaults_updated",
  // should_not_appear is ABSENT (opt-out)
  "$opt_in",
  "after_opt_in",
  "$deep_link_opened",  // warm-start
  "post_deep_link",
  "after_set_visitor_id",
  "after_reset",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function clearCaptures() {
  try {
    const entries = await fs.readdir(captureDir);
    for (const entry of entries) {
      if (entry.endsWith(".json")) {
        await fs.unlink(path.join(captureDir, entry));
      }
    }
  } catch {
    // Directory may not exist yet
  }
  await fs.mkdir(captureDir, {recursive: true});
}

async function getCapturedEvents() {
  try {
    const entries = await fs.readdir(captureDir);
    const jsonFiles = entries.filter((e) => e.endsWith(".json")).sort();
    const events = [];
    for (const f of jsonFiles) {
      const contents = await fs.readFile(path.join(captureDir, f), "utf8");
      const capture = JSON.parse(contents);
      if (capture.jsonBody && Array.isArray(capture.jsonBody.data)) {
        for (const event of capture.jsonBody.data) {
          if (event && event.event) events.push(event.event);
        }
      }
    }
    return events;
  } catch {
    return [];
  }
}

function startCaptureServer() {
  const child = spawn("node", ["scripts/capture-ingest.mjs"], {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: path.resolve("."),
  });
  child.stdout.on("data", (d) => process.stdout.write(d));
  child.stderr.on("data", (d) => process.stderr.write(d));
  return child;
}

async function waitForEvents(timeoutMs) {
  const start = Date.now();
  const requiredUnique = new Set(EXPECTED_EVENTS);

  process.stdout.write(`\nWaiting for ${requiredUnique.size} unique event types (timeout: ${timeoutMs / 1000}s)...\n`);

  while (Date.now() - start < timeoutMs) {
    const events = await getCapturedEvents();
    const seen = new Set(events);
    const missing = [...requiredUnique].filter((e) => !seen.has(e));

    if (missing.length === 0) {
      // All expected events received — wait a bit more for any stragglers
      await sleep(2000);
      console.log(`All expected events received in ${((Date.now() - start) / 1000).toFixed(1)}s`);
      return true;
    }

    await sleep(1000);
  }

  const events = await getCapturedEvents();
  const seen = new Set(events);
  const missing = [...requiredUnique].filter((e) => !seen.has(e));
  console.error(`\nTimeout after ${timeoutMs / 1000}s. Missing events: ${missing.join(", ")}`);
  console.error(`Received events: ${events.join(", ") || "(none)"}`);
  return false;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function runAssertions() {
  try {
    execSync("node scripts/e2e-assertions.mjs", {stdio: "inherit", cwd: path.resolve(".")});
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("=== Ours Privacy SDK — E2E Test Runner ===\n");

// 1. Clear old captures
await clearCaptures();
console.log("Cleared old captures");

// 2. Start capture server
const server = startCaptureServer();
await sleep(1000);

// 3. Wait for the app to send all expected events
console.log("\nLaunch the Demo app now (or it may already be running).");
console.log("The app must have E2E_AUTOFIRE=true in Demo/.env.\n");

const received = await waitForEvents(timeoutSecs * 1000);

// 4. Stop capture server
server.kill("SIGTERM");
await sleep(500);

if (!received) {
  console.error("\nE2E FAILED: Not all events were received within the timeout.");
  console.error("Make sure the Demo app is running with E2E_AUTOFIRE=true.");
  process.exit(1);
}

// 5. Run assertions
console.log("\n--- Running assertions ---\n");
const passed = runAssertions();

process.exit(passed ? 0 : 1);
