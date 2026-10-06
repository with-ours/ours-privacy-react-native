import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./capture-ingest.mjs', import.meta.url));

test('local recorder acknowledges a mobile batch with indexed results', async (t) => {
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ours-rn-capture-'));
  const child = spawn(
    process.execPath,
    [script, '--port', String(port), '--dir', dir],
    { stdio: 'ignore' },
  );
  t.after(async () => {
    child.kill('SIGTERM');
    if (child.exitCode === null) await once(child, 'close');
    await fs.rm(dir, { recursive: true, force: true });
  });

  const url = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    ready = await fetch(`${url}/health`)
      .then((response) => response.ok)
      .catch(() => false);
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true);

  const response = await fetch(`${url}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: 'e2e-local-token',
      data: [{ event: 'appointment_booked', visitor_id: 'synthetic-visitor' }],
    }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    visitor_id: 'synthetic-visitor',
    accepted: 1,
    rejected: [],
  });
  assert.equal((await fs.readdir(dir)).length, 1);
});
