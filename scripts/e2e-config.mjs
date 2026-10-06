export function parseE2EArgs(args) {
  const platform = args[0];
  if (platform !== 'android' && platform !== 'ios') {
    throw new Error('E2E platform must be android or ios');
  }
  const timeoutIndex = args.indexOf('--timeout');
  const timeoutSeconds =
    timeoutIndex === -1 ? 180 : Number(args[timeoutIndex + 1]);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error('E2E timeout must be a positive number of seconds');
  }
  return { platform, timeoutSeconds };
}

export function demoEnv(platform, token = 'e2e-local-token') {
  if (platform !== 'android' && platform !== 'ios') {
    throw new Error('E2E platform must be android or ios');
  }
  const serverURL =
    platform === 'android' ? 'http://10.0.2.2:4010' : 'http://127.0.0.1:4010';
  return [
    `OURSPRIVACY_TOKEN=${token}`,
    `OURSPRIVACY_SERVER_URL=${serverURL}`,
    'OURSPRIVACY_SDK_SOURCE=npm',
    'E2E_AUTOFIRE=true',
    '',
  ].join('\n');
}
