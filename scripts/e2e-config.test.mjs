import assert from 'node:assert/strict';
import test from 'node:test';
import { demoEnv, parseE2EArgs } from './e2e-config.mjs';

test('android e2e points the demo at the host capture server', () => {
  assert.deepEqual(parseE2EArgs(['android', '--timeout', '120']), {
    platform: 'android',
    timeoutSeconds: 120,
  });
  assert.match(
    demoEnv('android'),
    /OURSPRIVACY_SERVER_URL=http:\/\/10\.0\.2\.2:4010/,
  );
  assert.match(demoEnv('android'), /E2E_AUTOFIRE=true/);
});

test('ios e2e uses the simulator loopback address', () => {
  assert.match(
    demoEnv('ios'),
    /OURSPRIVACY_SERVER_URL=http:\/\/127\.0\.0\.1:4010/,
  );
});

test('e2e rejects unsupported platforms and invalid timeouts', () => {
  assert.throws(() => parseE2EArgs(['web']), /android or ios/);
  assert.throws(() => parseE2EArgs(['android', '--timeout', '0']), /timeout/);
});
