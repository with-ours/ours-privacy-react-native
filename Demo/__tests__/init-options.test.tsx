function initOptionsFor(autoFire?: string) {
  let options: {initialURL: string} | undefined;
  jest.isolateModules(() => {
    jest.doMock('@env', () => ({
      OURSPRIVACY_TOKEN: 'test-token',
      OURSPRIVACY_SERVER_URL: undefined,
      E2E_AUTOFIRE: autoFire,
    }));
    jest.doMock('@oursprivacy/react-native', () => ({
      OursPrivacy: jest.fn().mockImplementation(() => ({
        init: (_token: string, actual: {initialURL: string}) => {
          options = actual;
          return new Promise<void>(() => {});
        },
      })),
    }));
    require('../App');
  });
  return options?.initialURL;
}

test('ordinary Demo launch preserves generated visitor identity', () => {
  const url = initOptionsFor(undefined);
  expect(url).toContain('utm_source=google');
  expect(url).not.toContain('ours_visitor_id=');
});

test('E2E Demo launch stitches the synthetic visitor before booking', () => {
  const url = initOptionsFor('true');
  expect(url).toContain('ours_visitor_id=e2e-cold-web-visitor-id');
});
