import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scripts = path.dirname(fileURLToPath(import.meta.url));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function portIsFree(port) {
  const server = net.createServer();
  try {
    server.listen(port, '127.0.0.1');
    await once(server, 'listening');
    return true;
  } catch {
    return false;
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  }
}

async function waitForFile(file, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return await fs.readFile(file, 'utf8');
    } catch {
      await pause(100);
    }
  }
  throw new Error(`Timed out waiting for ${file}`);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  test(
    `${signal} restores the demo environment and stops E2E services`,
    { timeout: 25000 },
    async (t) => {
      if (!(await portIsFree(4010)) || !(await portIsFree(8081))) {
        t.skip('E2E ports are in use');
        return;
      }

      const fixture = await fs.mkdtemp(
        path.join(os.tmpdir(), 'ours-rn-e2e-signal-'),
      );
      const fixtureScripts = path.join(fixture, 'scripts');
      const fixtureDemo = path.join(fixture, 'Demo');
      const fixtureBin = path.join(fixture, 'bin');
      const originalEnv = 'ORIGINAL_VALUE=keep-me\n';
      const childPids = [];
      let runner;
      try {
        await Promise.all([
          fs.mkdir(fixtureScripts),
          fs.mkdir(fixtureDemo),
          fs.mkdir(fixtureBin),
        ]);
        await Promise.all([
          fs.copyFile(
            path.join(scripts, 'run-e2e.mjs'),
            path.join(fixtureScripts, 'run-e2e.mjs'),
          ),
          fs.copyFile(
            path.join(scripts, 'e2e-config.mjs'),
            path.join(fixtureScripts, 'e2e-config.mjs'),
          ),
          fs.writeFile(path.join(fixtureDemo, '.env'), originalEnv),
          fs.writeFile(
            path.join(fixtureScripts, 'capture-ingest.mjs'),
            `
        import http from 'node:http';
        import fs from 'node:fs/promises';
        await fs.writeFile(process.env.FIXTURE_DIR + '/recorder.pid', String(process.pid));
        const server = http.createServer((_, response) => {
          response.writeHead(200, {'Content-Type': 'application/json'});
          response.end(JSON.stringify({ok: true}));
        });
        server.listen(4010, '127.0.0.1');
      `,
          ),
          fs.writeFile(
            path.join(fixture, 'metro.mjs'),
            `
        import http from 'node:http';
        import fs from 'node:fs/promises';
        await fs.writeFile(process.env.FIXTURE_DIR + '/metro.pid', String(process.pid));
        const server = http.createServer((_, response) => {
          response.writeHead(200);
          response.end('packager-status:running');
        });
        server.listen(8081, '127.0.0.1');
      `,
          ),
          fs.writeFile(
            path.join(fixture, 'app.mjs'),
            `
        import fs from 'node:fs/promises';
        await fs.writeFile(process.env.FIXTURE_DIR + '/app.pid', String(process.pid));
        setInterval(() => {}, 1000);
      `,
          ),
          fs.writeFile(
            path.join(fixtureBin, 'npm'),
            `#!/bin/sh
        case "$2" in
          start) exec node "$FIXTURE_DIR/metro.mjs" ;;
          ios) exec node "$FIXTURE_DIR/app.mjs" ;;
        esac
        exit 2
      `,
          ),
        ]);
        await fs.chmod(path.join(fixtureBin, 'npm'), 0o755);

        runner = spawn(
          process.execPath,
          [path.join(fixtureScripts, 'run-e2e.mjs'), 'ios'],
          {
            cwd: fixture,
            env: {
              ...process.env,
              FIXTURE_DIR: fixture,
              PATH: `${fixtureBin}${path.delimiter}${process.env.PATH}`,
            },
            stdio: 'ignore',
          },
        );
        const closed = once(runner, 'close');
        const appPid = Number(await waitForFile(path.join(fixture, 'app.pid')));
        childPids.push(appPid);
        runner.kill(signal);
        const [exitCode] = await closed;

        assert.equal(exitCode, signal === 'SIGINT' ? 130 : 143);
        assert.equal(
          await fs.readFile(path.join(fixtureDemo, '.env'), 'utf8'),
          originalEnv,
        );
        assert.equal(await portIsFree(4010), true);
        assert.equal(await portIsFree(8081), true);
      } finally {
        runner?.kill('SIGKILL');
        for (const name of ['recorder.pid', 'metro.pid', 'app.pid']) {
          try {
            childPids.push(
              Number(await fs.readFile(path.join(fixture, name), 'utf8')),
            );
          } catch (error) {
            if (error.code !== 'ENOENT') console.error(error);
          }
        }
        for (const pid of new Set(childPids)) {
          try {
            process.kill(pid, 'SIGKILL');
          } catch (error) {
            if (error.code !== 'ESRCH') console.error(error);
          }
        }
        await fs.rm(fixture, { recursive: true, force: true });
      }
    },
  );
}

for (const port of [4010, 8081]) {
  test(`runner refuses an occupied E2E port ${port}`, async () => {
    const fixture = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ours-rn-e2e-port-'),
    );
    const server = net.createServer();
    try {
      await Promise.all([
        fs.mkdir(path.join(fixture, 'scripts')),
        fs.mkdir(path.join(fixture, 'Demo')),
      ]);
      await Promise.all([
        fs.copyFile(
          path.join(scripts, 'run-e2e.mjs'),
          path.join(fixture, 'scripts', 'run-e2e.mjs'),
        ),
        fs.copyFile(
          path.join(scripts, 'e2e-config.mjs'),
          path.join(fixture, 'scripts', 'e2e-config.mjs'),
        ),
        fs.writeFile(
          path.join(fixture, 'Demo', '.env'),
          'ORIGINAL_VALUE=keep-me\n',
        ),
      ]);
      server.listen(port, '127.0.0.1');
      await once(server, 'listening');

      const runner = spawn(
        process.execPath,
        [path.join(fixture, 'scripts', 'run-e2e.mjs'), 'ios'],
        {
          cwd: fixture,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let stderr = '';
      runner.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      const [code] = await once(runner, 'close');
      assert.equal(code, 1);
      assert.match(stderr, new RegExp(`E2E port ${port} is already in use`));
      assert.equal(
        await fs.readFile(path.join(fixture, 'Demo', '.env'), 'utf8'),
        'ORIGINAL_VALUE=keep-me\n',
      );
    } finally {
      server.close();
      await fs.rm(fixture, { recursive: true, force: true });
    }
  });
}
