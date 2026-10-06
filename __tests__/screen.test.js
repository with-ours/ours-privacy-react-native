import { OursPrivacy } from '@oursprivacy/react-native';
import { OursPrivacyQueueManager } from '../javascript/oursprivacy-queue';
import { OursPrivacyType } from '../javascript/oursprivacy-constants';

let tokenIndex = 0;
let token;

const queued = () =>
  OursPrivacyQueueManager.getQueue(token, OursPrivacyType.EVENTS);

const screenEvents = () =>
  queued().filter((event) => event.event === '$mobile_screen_view');

const settle = async (op) => {
  await op.oursprivacyImpl._pendingOperation;
};

beforeEach(() => {
  token = `screen-token-${++tokenIndex}`;
  jest.useFakeTimers({ now: Date.parse('2026-10-05T12:00:00.000Z') });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('a public screen call queues the exact canonical payload and configured host version', async () => {
  const op = new OursPrivacy();
  await op.init(token, {
    appVersion: '2.0.0',
    appBuild: '42',
    defaultEventProperties: { campaign: 'excluded' },
    defaultUserCustomProperties: { tier: 'excluded' },
  });

  op.trackScreen('Schedule');
  await settle(op);

  const [view] = screenEvents();
  expect(queued()).toHaveLength(1);
  expect(view).toEqual({
    event: '$mobile_screen_view',
    visitor_id: expect.any(String),
    distinct_id: expect.any(String),
    eventProperties: { screen_name: 'Schedule' },
    userProperties: null,
    defaultProperties: {
      device_type: 'mobile',
      os_name: 'iOS',
      os_version: 'undefined',
      version: 'react-native@4.1.0',
      screen_width: 375,
      screen_height: 812,
      device_vendor: 'Apple',
      app_version: '2.0.0',
      app_build: '42',
      sid: expect.any(String),
      mobile_session_started_at: '2026-10-05T12:00:00.000Z',
      mobile_occurred_at: '2026-10-05T12:00:00.000Z',
      mobile_platform: 'ios',
      mobile_contract_version: 1,
    },
  });
});

test('duplicate calls for the same visible screen queue one view', async () => {
  const op = new OursPrivacy();
  await op.init(token);

  op.trackScreen('Schedule');
  op.trackScreen('Schedule');
  await settle(op);

  expect(screenEvents()).toHaveLength(1);
});

test('a screen change attributes elapsed engagement to the previous screen', async () => {
  const op = new OursPrivacy();
  await op.init(token, { trackAutomaticEvents: true });

  op.trackScreen('Home');
  await settle(op);
  await jest.advanceTimersByTimeAsync(4_000);
  op.trackScreen('Schedule');
  await settle(op);

  const events = queued();
  expect(events.slice(-3).map((event) => event.event)).toEqual([
    '$mobile_screen_view',
    '$mobile_session_engagement',
    '$mobile_screen_view',
  ]);
  expect(events.at(-2).eventProperties).toEqual({
    engagement_duration_ms: 4_000,
    screen_name: 'Home',
  });
  expect(events.at(-2).defaultProperties.sid).toBe(
    events.at(-1).defaultProperties.sid,
  );
  expect(events.at(-1).eventProperties).toEqual({
    screen_name: 'Schedule',
  });
});

test('manual screens work with automatic events off without lifecycle or engagement facts', async () => {
  const op = new OursPrivacy();
  await op.init(token);

  op.trackScreen('Home');
  await settle(op);
  await jest.advanceTimersByTimeAsync(4_000);
  op.trackScreen('Schedule');
  await settle(op);

  expect(queued().map((event) => event.event)).toEqual([
    '$mobile_screen_view',
    '$mobile_screen_view',
  ]);
});

test('full tracking opt-out suppresses explicit screens', async () => {
  const op = new OursPrivacy();
  await op.init(token, {
    trackAutomaticEvents: true,
    optOutTrackingByDefault: true,
  });

  op.trackScreen('Schedule');
  await settle(op);

  expect(queued()).toEqual([]);
});

test('React Native web does not emit a mobile screen event', async () => {
  const platform = require('react-native').Platform;
  platform.OS = 'web';
  try {
    const op = new OursPrivacy();
    await op.init(token);

    op.trackScreen('Home');
    await settle(op);

    expect(queued()).toEqual([]);
  } finally {
    platform.OS = 'ios';
  }
});
