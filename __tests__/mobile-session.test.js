import { MobileSession } from '../javascript/oursprivacy-mobile-session';

const START = Date.parse('2026-10-05T12:00:00.000Z');

function setup({ startMs = START, ...options } = {}) {
  const values = new Map();
  const storage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    },
  };
  let wallMs = startMs;
  let monotonicMs = 0;
  let id = 0;
  const dependencies = {
    token: 'token-a',
    storage,
    wallNow: () => wallMs,
    monotonicNow: () => monotonicMs,
    uuid: () => `sid-${++id}`,
    ...options,
  };

  return {
    storage,
    dependencies,
    advance(ms) {
      wallMs += ms;
      monotonicMs += ms;
    },
    shiftWall(ms) {
      wallMs += ms;
    },
  };
}

describe('MobileSession', () => {
  it('emits one cold-open sequence with a shared session ID and UTC metadata', async () => {
    const { dependencies } = setup();
    const session = new MobileSession(dependencies);
    await session.load();

    const facts = await session.foreground(true);

    expect(facts.map((fact) => fact.event)).toEqual([
      '$mobile_first_open',
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
    for (const fact of facts) {
      expect(fact.defaultProperties).toEqual({
        sid: 'sid-1',
        mobile_session_started_at: '2026-10-05T12:00:00.000Z',
        mobile_occurred_at: '2026-10-05T12:00:00.000Z',
      });
    }
    expect(await session.foreground(true)).toEqual([]);
  });

  it('reuses a persisted session after restart without repeating first-open or session-start', async () => {
    const clock = setup();
    const first = new MobileSession(clock.dependencies);
    await first.load();
    await first.foreground(true);

    clock.advance(5_000);
    const restarted = new MobileSession(clock.dependencies);
    await restarted.load();
    const facts = await restarted.foreground(true);

    expect(facts.map((fact) => fact.event)).toEqual(['$mobile_app_open']);
    expect(facts[0].defaultProperties.sid).toBe('sid-1');
  });

  it('retains the session before 30 minutes of inactivity and rotates at equality', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    await session.foreground(true);
    await session.background();

    clock.advance(30 * 60 * 1000 - 1);
    const warmFacts = await session.foreground(true);
    expect(warmFacts.map((fact) => fact.event)).toEqual(['$mobile_app_open']);
    expect(warmFacts[0].defaultProperties.sid).toBe('sid-1');

    await session.background();
    clock.advance(30 * 60 * 1000);
    const rotatedFacts = await session.foreground(true);
    expect(rotatedFacts.map((fact) => fact.event)).toEqual([
      '$mobile_session_end',
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
    expect(rotatedFacts[0].defaultProperties.sid).toBe('sid-1');
    expect(rotatedFacts[1].defaultProperties.sid).toBe('sid-2');
    expect(rotatedFacts[2].defaultProperties.sid).toBe('sid-2');
  });

  it('emits nonoverlapping monotonic engagement at checkpoint, screen change, and background', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    await session.foreground(true);

    clock.advance(9_999);
    expect(await session.checkpoint()).toEqual([]);
    clock.advance(1);
    const firstDelta = await session.checkpoint();
    expect(firstDelta).toEqual([
      {
        event: '$mobile_session_engagement',
        eventProperties: { engagement_duration_ms: 10_000 },
        defaultProperties: {
          sid: 'sid-1',
          mobile_session_started_at: '2026-10-05T12:00:00.000Z',
          mobile_occurred_at: '2026-10-05T12:00:10.000Z',
        },
      },
    ]);

    clock.advance(3_000);
    const home = await session.screen('Home');
    expect(home.map((fact) => fact.event)).toEqual([
      '$mobile_session_engagement',
      '$mobile_screen_view',
    ]);
    expect(home[0].eventProperties).toEqual({ engagement_duration_ms: 3_000 });
    expect(home[1].eventProperties).toEqual({ screen_name: 'Home' });

    clock.advance(4_000);
    const settings = await session.screen('Settings');
    expect(settings[0].eventProperties).toEqual({
      engagement_duration_ms: 4_000,
      screen_name: 'Home',
    });

    clock.advance(2_000);
    const lastDelta = await session.background();
    expect(lastDelta).toHaveLength(1);
    expect(lastDelta[0].eventProperties).toEqual({
      engagement_duration_ms: 2_000,
      screen_name: 'Settings',
    });
    expect(await session.background()).toEqual([]);
    expect(await session.checkpoint()).toEqual([]);
  });

  it('checkpoints at ten accumulated foreground seconds after a screen delta', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    await session.foreground(true);

    clock.advance(9_000);
    const screenFacts = await session.screen('Home');
    expect(screenFacts[0].eventProperties).toEqual({
      engagement_duration_ms: 9_000,
    });

    clock.advance(1_000);
    const checkpointFacts = await session.checkpoint();
    expect(checkpointFacts).toEqual([
      {
        event: '$mobile_session_engagement',
        eventProperties: {
          engagement_duration_ms: 1_000,
          screen_name: 'Home',
        },
        defaultProperties: {
          sid: 'sid-1',
          mobile_session_started_at: '2026-10-05T12:00:00.000Z',
          mobile_occurred_at: '2026-10-05T12:00:10.000Z',
        },
      },
    ]);
    expect(
      screenFacts[0].eventProperties.engagement_duration_ms +
        checkpointFacts[0].eventProperties.engagement_duration_ms,
    ).toBe(10_000);
    expect(await session.checkpoint()).toEqual([]);
  });

  it('carries emitted foreground duration across a process restart', async () => {
    const clock = setup();
    const first = new MobileSession(clock.dependencies);
    await first.load();
    await first.foreground(true);
    clock.advance(9_000);
    expect((await first.background())[0].eventProperties).toEqual({
      engagement_duration_ms: 9_000,
    });

    const restarted = new MobileSession(clock.dependencies);
    await restarted.load();
    await restarted.foreground(true);
    clock.advance(1_000);
    expect((await restarted.checkpoint())[0].eventProperties).toEqual({
      engagement_duration_ms: 1_000,
    });
    expect(await restarted.checkpoint()).toEqual([]);
  });

  it('uses monotonic time when wall time changes during an active foreground', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    await session.foreground(true);

    clock.shiftWall(60 * 60 * 1000);
    clock.advance(10_000);

    const facts = await session.checkpoint();
    expect(facts[0].eventProperties.engagement_duration_ms).toBe(10_000);
  });

  it('supports manual snapshots and screens with automatic tracking off', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();

    expect(await session.foreground(false)).toEqual([]);
    clock.advance(2_000);
    expect(await session.snapshot()).toEqual({
      sid: 'sid-1',
      mobile_session_started_at: '2026-10-05T12:00:00.000Z',
      mobile_occurred_at: '2026-10-05T12:00:02.000Z',
    });
    const screenFacts = await session.screen('Appointments');
    expect(screenFacts).toEqual([
      {
        event: '$mobile_screen_view',
        eventProperties: { screen_name: 'Appointments' },
        defaultProperties: {
          sid: 'sid-1',
          mobile_session_started_at: '2026-10-05T12:00:00.000Z',
          mobile_occurred_at: '2026-10-05T12:00:02.000Z',
        },
      },
    ]);
    expect(await session.screen('Appointments')).toEqual([]);
    clock.advance(10_000);
    expect(await session.background()).toEqual([]);
  });

  it('leaves first-open eligible after opt-out before its first emission', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    expect(await session.foreground(false)).toEqual([]);
    expect(await session.disableTracking()).toEqual([]);
    expect(await session.foreground(true)).toEqual([]);
    expect(await session.screen('Private')).toEqual([]);
    expect(await session.snapshot()).toBeNull();

    const optedIn = new MobileSession(clock.dependencies);
    await optedIn.load();
    const facts = await optedIn.foreground(true);
    expect(facts.map((fact) => fact.event)).toEqual([
      '$mobile_first_open',
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
    expect(facts[0].defaultProperties.sid).toBe('sid-2');
  });

  it('rotates on reset without restoring first-open eligibility', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    await session.foreground(true);

    expect(await session.resetSession()).toEqual([]);
    const snapshot = await session.snapshot();
    expect(snapshot.sid).toBe('sid-2');
    const facts = await session.foreground(true);
    expect(facts.map((fact) => fact.event)).toEqual([
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
    expect(facts[0].defaultProperties.sid).toBe('sid-2');
  });

  it('emits one update on a later tracked open when app version or build changes', async () => {
    const clock = setup({ appVersion: '1.0', appBuild: '10' });
    const first = new MobileSession(clock.dependencies);
    await first.load();
    expect((await first.foreground(true)).map((fact) => fact.event)).toEqual([
      '$mobile_first_open',
      '$mobile_app_open',
      '$mobile_session_start',
    ]);

    const unchanged = new MobileSession(clock.dependencies);
    await unchanged.load();
    expect(
      (await unchanged.foreground(true)).map((fact) => fact.event),
    ).toEqual(['$mobile_app_open']);

    const upgraded = new MobileSession({
      ...clock.dependencies,
      appVersion: '2.0',
      appBuild: '11',
    });
    await upgraded.load();
    const facts = await upgraded.foreground(true);
    expect(facts.map((fact) => fact.event)).toEqual([
      '$mobile_app_open',
      '$mobile_app_update',
    ]);
    expect(facts[1].eventProperties).toEqual({
      previous_app_version: '1.0',
      previous_app_build: '10',
    });
    expect(facts[1].defaultProperties.sid).toBe('sid-1');

    await upgraded.background();
    clock.advance(1_000);
    expect((await upgraded.foreground(true)).map((fact) => fact.event)).toEqual(
      ['$mobile_app_open'],
    );
  });

  it('keeps the UTC session start date across midnight', async () => {
    const clock = setup({
      startMs: Date.parse('2026-10-05T23:59:59.000Z'),
    });
    const session = new MobileSession(clock.dependencies);
    await session.load();
    await session.foreground(false);
    clock.advance(2_000);

    expect(await session.snapshot()).toEqual({
      sid: 'sid-1',
      mobile_session_started_at: '2026-10-05T23:59:59.000Z',
      mobile_occurred_at: '2026-10-06T00:00:01.000Z',
    });
  });

  it('rotates manual snapshots at the inactivity boundary without lifecycle facts', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    await session.foreground(false);
    await session.background();

    clock.advance(30 * 60 * 1000 - 1);
    expect((await session.snapshot()).sid).toBe('sid-1');
    clock.advance(30 * 60 * 1000);
    expect((await session.snapshot()).sid).toBe('sid-2');
    expect(
      (await session.screen('Appointments'))[0].defaultProperties.sid,
    ).toBe('sid-2');
  });

  it('hands off an announced session end when a manual snapshot observes timeout', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    await session.foreground(true);
    await session.background();
    clock.advance(30 * 60 * 1000);

    const manualTrack = {
      event: 'appointment_booked',
      defaultProperties: await session.snapshot(),
    };
    expect(manualTrack.defaultProperties).toEqual({
      sid: 'sid-2',
      mobile_session_started_at: '2026-10-05T12:30:00.000Z',
      mobile_occurred_at: '2026-10-05T12:30:00.000Z',
    });
    expect(await session.drainPendingFacts()).toEqual([
      {
        event: '$mobile_session_end',
        defaultProperties: {
          sid: 'sid-1',
          mobile_session_started_at: '2026-10-05T12:00:00.000Z',
          mobile_occurred_at: '2026-10-05T12:30:00.000Z',
        },
      },
    ]);
    expect(await session.drainPendingFacts()).toEqual([]);
    expect((await session.snapshot()).sid).toBe('sid-2');
  });

  it('clears a pending automatic end on full tracking opt-out', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    await session.foreground(true);
    await session.background();
    clock.advance(30 * 60 * 1000);
    await session.snapshot();

    expect(await session.disableTracking()).toEqual([]);
    expect(await session.drainPendingFacts()).toEqual([]);
    expect(await session.snapshot()).toBeNull();
  });

  it('does not rotate an active foreground after 30 minutes without a checkpoint', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    await session.foreground(true);
    clock.advance(31 * 60 * 1000);

    expect((await session.snapshot()).sid).toBe('sid-1');
    const facts = await session.screen('Appointments');
    expect(facts.every((fact) => fact.defaultProperties.sid === 'sid-1')).toBe(
      true,
    );
  });

  it('starts a manual screen session before automatic tracking becomes enabled', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    expect(
      (await session.screen('Appointments'))[0].defaultProperties.sid,
    ).toBe('sid-1');

    const facts = await session.foreground(true);
    expect(facts.map((fact) => fact.event)).toEqual([
      '$mobile_first_open',
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
    expect(facts[2].defaultProperties.sid).toBe('sid-1');
  });

  it('serializes concurrent foreground calls without duplicate lifecycle facts', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    const [first, duplicate] = await Promise.all([
      session.foreground(true),
      session.foreground(true),
    ]);

    expect(first.map((fact) => fact.event)).toEqual([
      '$mobile_first_open',
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
    expect(duplicate).toEqual([]);
    const reloaded = new MobileSession(clock.dependencies);
    await reloaded.load();
    expect((await reloaded.foreground(true)).map((fact) => fact.event)).toEqual(
      ['$mobile_app_open'],
    );
  });

  it('keeps occurrence times and facts detached across queued calls', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    const foreground = session.foreground(true);
    clock.advance(1_000);
    const snapshot = session.snapshot();
    clock.advance(5_000);

    const facts = await foreground;
    expect(facts[0].defaultProperties.mobile_occurred_at).toBe(
      '2026-10-05T12:00:00.000Z',
    );
    expect((await snapshot).mobile_occurred_at).toBe(
      '2026-10-05T12:00:01.000Z',
    );
    facts[0].defaultProperties.sid = 'tampered';
    expect(facts[1].defaultProperties.sid).toBe('sid-1');
    expect((await session.snapshot()).sid).toBe('sid-1');
  });

  it('keeps sessions and first-open markers scoped to the source token', async () => {
    const clock = setup();
    const a = new MobileSession(clock.dependencies);
    const b = new MobileSession({ ...clock.dependencies, token: 'token-b' });
    await a.load();
    await b.load();

    expect((await a.foreground(true))[0].defaultProperties.sid).toBe('sid-1');
    expect((await b.foreground(true))[0].defaultProperties.sid).toBe('sid-2');
    const reloadedA = new MobileSession(clock.dependencies);
    await reloadedA.load();
    expect(
      (await reloadedA.foreground(true)).map((fact) => fact.event),
    ).toEqual(['$mobile_app_open']);
  });

  it('does not emit a session end for a session never announced by automatic tracking', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    await session.foreground(false);
    await session.background();
    clock.advance(30 * 60 * 1000);

    expect((await session.foreground(true)).map((fact) => fact.event)).toEqual([
      '$mobile_first_open',
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
  });

  it('does not send an occurrence time before session start if the wall clock moves backward', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    await session.foreground(true);
    clock.shiftWall(-1_000);

    expect((await session.snapshot()).mobile_occurred_at).toBe(
      '2026-10-05T12:00:00.000Z',
    );
  });

  it('starts a new session for the same screen after inactivity expires', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    await session.foreground(true);
    await session.screen('Appointments');
    await session.background();
    clock.advance(30 * 60 * 1000);

    const facts = await session.screen('Appointments');
    expect(facts.map((fact) => fact.event)).toEqual([
      '$mobile_session_end',
      '$mobile_screen_view',
    ]);
    expect(facts[0].defaultProperties.sid).toBe('sid-1');
    expect(facts[1].defaultProperties.sid).toBe('sid-2');
  });

  it('emits an explicit screen view again after a warm foreground entry', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    await session.foreground(true);
    expect((await session.screen('Home')).map((fact) => fact.event)).toEqual([
      '$mobile_screen_view',
    ]);
    expect(await session.screen('Home')).toEqual([]);

    await session.background();
    clock.advance(1_000);
    await session.foreground(true);
    const screenFacts = await session.screen('Home');
    expect(screenFacts.map((fact) => fact.event)).toEqual([
      '$mobile_screen_view',
    ]);
    expect(screenFacts[0].defaultProperties.sid).toBe('sid-1');
    expect(await session.screen('Home')).toEqual([]);
  });

  it('defaults automatic lifecycle and engagement tracking off', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    expect(await session.foreground()).toEqual([]);
    clock.advance(10_000);
    expect(await session.checkpoint()).toEqual([]);
    expect(await session.background()).toEqual([]);

    const restarted = new MobileSession(clock.dependencies);
    await restarted.load();
    expect(
      (await restarted.foreground(true)).map((fact) => fact.event),
    ).toEqual([
      '$mobile_first_open',
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
  });

  it('does not emit first-open again after opt-out and opt-in', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    await session.foreground(true);
    expect(await session.disableTracking()).toEqual([]);

    const optedIn = new MobileSession(clock.dependencies);
    await optedIn.load();
    const facts = await optedIn.foreground(true);
    expect(facts.map((fact) => fact.event)).toEqual([
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
    expect(facts[0].defaultProperties.sid).toBe('sid-2');
  });

  it('emits an app update for a build-only change with only known prior fields', async () => {
    const clock = setup({ appBuild: '10' });
    const first = new MobileSession(clock.dependencies);
    await first.load();
    await first.foreground(true);

    const changed = new MobileSession({
      ...clock.dependencies,
      appBuild: '11',
    });
    await changed.load();
    const facts = await changed.foreground(true);
    expect(facts[1]).toEqual({
      event: '$mobile_app_update',
      eventProperties: { previous_app_build: '10' },
      defaultProperties: {
        sid: 'sid-1',
        mobile_session_started_at: '2026-10-05T12:00:00.000Z',
        mobile_occurred_at: '2026-10-05T12:00:00.000Z',
      },
    });
  });

  it('ignores empty screen names without creating a session', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    for (const name of [null, '', '   ', 42]) {
      expect(await session.screen(name)).toEqual([]);
    }
    expect((await session.screen('Home'))[0].defaultProperties.sid).toBe(
      'sid-1',
    );
  });

  it.each(['{broken', 'null'])(
    'recovers from an unusable persisted session record (%s)',
    async (stored) => {
      const clock = setup();
      await clock.storage.setItem(
        'OURSPRIVACY_token-a_MOBILE_SESSION_V1',
        stored,
      );
      const session = new MobileSession(clock.dependencies);
      await session.load();

      expect(
        (await session.foreground(true)).map((fact) => fact.event),
      ).toEqual([
        '$mobile_first_open',
        '$mobile_app_open',
        '$mobile_session_start',
      ]);
    },
  );

  it('preserves first-open history while discarding invalid stored session dates', async () => {
    const clock = setup();
    await clock.storage.setItem(
      'OURSPRIVACY_token-a_MOBILE_SESSION_V1',
      JSON.stringify({
        sid: 'stale',
        startedAtMs: 'invalid',
        lastActiveAtMs: null,
        firstOpenSent: true,
        sessionStartSent: true,
      }),
    );
    const session = new MobileSession(clock.dependencies);
    await session.load();

    const facts = await session.foreground(true);
    expect(facts.map((fact) => fact.event)).toEqual([
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
    expect(facts[0].defaultProperties.sid).toBe('sid-1');
  });

  it('does not expire early after a backward wall-clock correction', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    await session.foreground(true);
    clock.shiftWall(-1_000);
    await session.snapshot();
    clock.shiftWall(30 * 60 * 1000);

    const restarted = new MobileSession(clock.dependencies);
    await restarted.load();
    const facts = await restarted.foreground(true);
    expect(facts.map((fact) => fact.event)).toEqual(['$mobile_app_open']);
    expect(facts[0].defaultProperties.sid).toBe('sid-1');
  });

  it('does not consume first-open when persistence rejects before facts are returned', async () => {
    const clock = setup();
    const originalSetItem = clock.storage.setItem;
    let rejectNextWrite = true;
    clock.storage.setItem = async (key, value) => {
      if (rejectNextWrite) {
        rejectNextWrite = false;
        throw new Error('write failed');
      }
      await originalSetItem(key, value);
    };
    const session = new MobileSession(clock.dependencies);
    await session.load();

    await expect(session.foreground(true)).rejects.toThrow('write failed');
    expect((await session.foreground(true)).map((fact) => fact.event)).toEqual([
      '$mobile_first_open',
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
  });
});
