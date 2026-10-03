#!/usr/bin/env node

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { demoEnv, parseE2EArgs } from './e2e-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demo = path.join(root, 'Demo');
const envPath = path.join(demo, '.env');
const requiredEvents = new Set([
  '$deep_link_opened',
  'button_pressed',
  '$identify',
  'defaults_updated',
  '$opt_in',
  'after_opt_in',
  'post_deep_link',
  'after_set_visitor_id',
  'after_reset',
]);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function tool(name) {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const candidate =
    sdk && path.join(sdk, name === 'adb' ? 'platform-tools' : 'emulator', name);
  return candidate && existsSync(candidate) ? candidate : name;
}

function commandOutput(command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function androidDevice() {
  const devices = commandOutput(tool('adb'), ['devices']);
  return devices
    .split('\n')
    .map((line) => /^([\w-]+)\s+device$/.exec(line)?.[1])
    .find((id) => id?.startsWith('emulator-'));
}

async function ensureAndroidEmulator(onLaunch) {
  let device = androidDevice();
  if (device) return { device };
  const avd = commandOutput(tool('emulator'), ['-list-avds'])
    .split('\n')
    .map((s) => s.trim())
    .find(Boolean);
  if (!avd)
    throw new Error(
      'No Android emulator is running and no AVD is installed. Create an AVD in Android Studio.',
    );
  console.log(`Starting Android AVD ${avd}`);
  const emulator = spawn(
    tool('emulator'),
    ['-avd', avd, '-no-audio', '-no-boot-anim'],
    {
      stdio: 'ignore',
      detached: true,
    },
  );
  onLaunch(emulator);
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await delay(2_000);
    if (emulator.exitCode !== null)
      throw new Error('Android emulator exited before booting');
    device = androidDevice();
    if (!device) continue;
    if (
      commandOutput(tool('adb'), [
        '-s',
        device,
        'shell',
        'getprop',
        'sys.boot_completed',
      ]).trim() === '1'
    ) {
      return { device, emulator };
    }
  }
  throw new Error(
    'Android emulator did not finish booting within three minutes',
  );
}

function start(command, args, cwd, detached = false) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', detached });
  child.on('error', (error) =>
    console.error(`${command} failed to start: ${error.message}`),
  );
  return child;
}

async function run(command, args, cwd, onLaunch) {
  const child = start(command, args, cwd, true);
  onLaunch(child);
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  if (code !== 0)
    throw new Error(`${command} ${args.join(' ')} exited ${code}`);
}

async function waitForHealth(url, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error(`Service exited before ${url} became ready`);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(2_000),
    }).catch(() => null);
    if (response?.ok) return;
    await delay(1_000);
  }
  throw new Error(`Service did not become ready at ${url}`);
}

async function capturedEventNames(captureDir) {
  const files = (await fs.readdir(captureDir)).filter((name) =>
    name.endsWith('.json'),
  );
  const names = new Set();
  for (const name of files) {
    const capture = JSON.parse(
      await fs.readFile(path.join(captureDir, name), 'utf8'),
    );
    for (const entry of capture.jsonBody?.data ?? []) {
      if (typeof entry?.event === 'string') names.add(entry.event);
    }
  }
  return names;
}

async function waitForCaptures(captureDir, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1_000;
  let missing = [...requiredEvents];
  while (Date.now() < deadline) {
    const seen = await capturedEventNames(captureDir);
    missing = [...requiredEvents].filter((name) => !seen.has(name));
    if (missing.length === 0) {
      await delay(2_000);
      return;
    }
    await delay(1_000);
  }
  throw new Error(`Timed out waiting for payloads: ${missing.join(', ')}`);
}

async function requireFreePort(port) {
  const probe = net.createServer();
  try {
    await new Promise((resolve, reject) => {
      probe.once('error', reject);
      probe.listen(port, '127.0.0.1', resolve);
    });
  } catch (error) {
    if (error.code === 'EADDRINUSE')
      throw new Error(`E2E port ${port} is already in use`, { cause: error });
    throw error;
  } finally {
    if (probe.listening) await new Promise((resolve) => probe.close(resolve));
  }
}

async function stop(child, processGroup = false) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null)
    return;
  const closed = new Promise((resolve) => child.once('close', resolve));
  try {
    process.kill(processGroup ? -child.pid : child.pid, 'SIGTERM');
  } catch (error) {
    if (error.code !== 'ESRCH') console.error(error);
  }
  await Promise.race([closed, delay(4000)]);
  if (child.exitCode === null && child.signalCode === null) {
    try {
      process.kill(processGroup ? -child.pid : child.pid, 'SIGKILL');
    } catch (error) {
      if (error.code !== 'ESRCH') console.error(error);
    }
  }
}

async function main() {
  const { platform, timeoutSeconds } = parseE2EArgs(process.argv.slice(2));
  const captureDir = path.join(root, 'tmp', 'captures');
  const previousEnv = existsSync(envPath)
    ? await fs.readFile(envPath, 'utf8')
    : null;
  let recorder;
  let metro;
  let emulator;
  let activeRun;
  let cleanupTask;
  const cleanup = () => {
    cleanupTask ??= (async () => {
      await stop(activeRun, true);
      await stop(metro, true);
      await stop(recorder);
      await stop(emulator, true);
      if (previousEnv === null) await fs.rm(envPath, { force: true });
      else await fs.writeFile(envPath, previousEnv);
    })();
    return cleanupTask;
  };
  const onSignal = (signal) => {
    void cleanup().then(
      () => process.exit(signal === 'SIGINT' ? 130 : 143),
      (error) => {
        console.error(`E2E cleanup failed: ${error.message}`);
        process.exit(1);
      },
    );
  };
  const onInterrupt = () => onSignal('SIGINT');
  const onTerminate = () => onSignal('SIGTERM');
  process.once('SIGINT', onInterrupt);
  process.once('SIGTERM', onTerminate);
  try {
    await requireFreePort(4010);
    await requireFreePort(8081);
    await fs.mkdir(captureDir, { recursive: true });
    for (const file of await fs.readdir(captureDir)) {
      if (file.endsWith('.json')) await fs.unlink(path.join(captureDir, file));
    }
    await fs.writeFile(envPath, demoEnv(platform), { mode: 0o600 });
    recorder = start(
      'node',
      [path.join(root, 'scripts', 'capture-ingest.mjs'), '--dir', captureDir],
      root,
    );
    await waitForHealth('http://127.0.0.1:4010/health', recorder, 15_000);
    if (platform === 'android') {
      const android = await ensureAndroidEmulator((child) => {
        emulator = child;
      });
      spawnSync(
        tool('adb'),
        ['-s', android.device, 'shell', 'am', 'force-stop', 'com.example'],
        { stdio: 'ignore' },
      );
      spawnSync(
        tool('adb'),
        ['-s', android.device, 'shell', 'pm', 'clear', 'com.example'],
        { stdio: 'ignore' },
      );
    }
    metro = start('npm', ['run', 'start', '--', '--reset-cache'], demo, true);
    await waitForHealth('http://127.0.0.1:8081/status', metro, 90_000);
    await run(
      'npm',
      ['run', platform, '--', '--no-packager'],
      demo,
      (child) => {
        activeRun = child;
      },
    );
    activeRun = undefined;
    await waitForCaptures(captureDir, timeoutSeconds);
    await run(
      'node',
      [path.join(root, 'scripts', 'e2e-assertions.mjs'), '--dir', captureDir],
      root,
      (child) => {
        activeRun = child;
      },
    );
    activeRun = undefined;
    console.log(`${platform} E2E passed`);
  } finally {
    await cleanup();
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onTerminate);
  }
}

try {
  await main();
} catch (error) {
  console.error(`E2E failed: ${error.message}`);
  process.exitCode = 1;
}
