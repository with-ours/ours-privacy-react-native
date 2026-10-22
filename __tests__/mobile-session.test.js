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
  const dependencies = {
    token: 'token-a',
    storage,
    wallNow: () => wallMs,
    monotonicNow: () => monotonicMs,
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
  it('keeps rapid numeric session rotations distinct across restart and clock rollback', async () => {
    const clock = setup();
    let session = new MobileSession(clock.dependencies);
    await session.foreground(true);
    await session.rotateSession();
    let [start] = await session.announceRotatedSession();
    expect(start.defaultProperties.sid).toBe('1791201600001');
    session = new MobileSession(clock.dependencies);
    await session.foreground(true);
    await session.rotateSession();
    [start] = await session.announceRotatedSession();
    expect(start.defaultProperties.sid).toBe('1791201600002');
    clock.shiftWall(-60_000);
    await session.rotateSession();
    [start] = await session.announceRotatedSession();
    expect(start.defaultProperties.sid).toBe('1791201600003');
    clock.shiftWall(-300_001);
    await session.rotateSession();
    [start] = await session.announceRotatedSession();
    expect(start.defaultProperties.sid).toBe('1791201239999');
  });

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
        sid: String(START),
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
    expect(facts[0].defaultProperties.sid).toBe(String(START));
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
    expect(warmFacts[0].defaultProperties.sid).toBe(String(START));

    await session.background();
    clock.advance(30 * 60 * 1000);
    const rotatedFacts = await session.foreground(true);
    expect(rotatedFacts.map((fact) => fact.event)).toEqual([
      '$mobile_session_end',
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
    expect(rotatedFacts[0].defaultProperties.sid).toBe(String(START));
    expect(rotatedFacts[1].defaultProperties.sid).toBe(
      String(START + 3_599_999),
    );
    expect(rotatedFacts[2].defaultProperties.sid).toBe(
      String(START + 3_599_999),
    );
  });

  it('uses callback times after a processing delay and retains the visible screen on rotation', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    await session.foreground(true);
    await session.screen('Schedule');

    clock.advance(5_000);
    const backgroundAt = {
      wallMs: START + 5_000,
      monotonicMs: 5_000,
    };
    clock.advance(15_000);
    const background = await session.background(backgroundAt);
    expect(background[0].eventProperties).toEqual({
      engagement_duration_ms: 5_000,
      screen_name: 'Schedule',
    });
    expect(background[0].defaultProperties.mobile_occurred_at).toBe(
      '2026-10-05T12:00:05.000Z',
    );

    const activeAt = {
      wallMs: backgroundAt.wallMs + 30 * 60 * 1000 - 1,
      monotonicMs: backgroundAt.monotonicMs + 30 * 60 * 1000 - 1,
    };
    clock.advance(30 * 60 * 1000);
    const warm = await session.foreground(true, true, activeAt);
    expect(warm.map((fact) => fact.event)).toEqual(['$mobile_app_open']);
    expect(warm[0].defaultProperties.sid).toBe(String(START));

    await session.screen('Schedule');
    await session.rotateSession();
    clock.advance(10_000);
    const checkpoint = await session.checkpoint();
    expect(checkpoint[0].eventProperties.screen_name).toBe('Schedule');
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
          sid: String(START),
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
          sid: String(START),
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
      sid: String(START),
      mobile_occurred_at: '2026-10-05T12:00:02.000Z',
    });
    const screenFacts = await session.screen('Appointments');
    expect(screenFacts).toEqual([
      {
        event: '$mobile_screen_view',
        eventProperties: { screen_name: 'Appointments' },
        defaultProperties: {
          sid: String(START),
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
    expect(facts[0].defaultProperties.sid).toBe('1791201600001');
  });

  it('rotates on reset without restoring first-open eligibility', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    await session.foreground(true);

    clock.advance(1);
    expect((await session.resetSession()).map((fact) => fact.event)).toEqual([
      '$mobile_session_end',
    ]);
    const snapshot = await session.snapshot();
    expect(snapshot.sid).toBe(String(START + 1));
    const facts = await session.foreground(true);
    expect(facts.map((fact) => fact.event)).toEqual([
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
    expect(facts[0].defaultProperties.sid).toBe(String(START + 1));
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
    expect(facts[1].defaultProperties.sid).toBe(String(START));

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
      sid: '1791244799000',
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
    expect((await session.snapshot()).sid).toBe(String(START));
    clock.advance(30 * 60 * 1000);
    expect((await session.snapshot()).sid).toBe(String(START + 3_599_999));
    expect(
      (await session.screen('Appointments'))[0].defaultProperties.sid,
    ).toBe(String(START + 3_599_999));
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
      sid: String(START + 1_800_000),
      mobile_occurred_at: '2026-10-05T12:30:00.000Z',
    });
    expect(await session.drainPendingFacts()).toEqual([
      {
        event: '$mobile_session_end',
        defaultProperties: {
          sid: String(START),
          mobile_occurred_at: '2026-10-05T12:00:00.000Z',
        },
      },
    ]);
    expect(await session.drainPendingFacts()).toEqual([]);
    expect((await session.snapshot()).sid).toBe(String(START + 1_800_000));
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

    expect((await session.snapshot()).sid).toBe(String(START));
    const facts = await session.screen('Appointments');
    expect(
      facts.every((fact) => fact.defaultProperties.sid === String(START)),
    ).toBe(true);
  });

  it('starts a manual screen session before automatic tracking becomes enabled', async () => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.load();
    expect(
      (await session.screen('Appointments'))[0].defaultProperties.sid,
    ).toBe(String(START));

    const facts = await session.foreground(true);
    expect(facts.map((fact) => fact.event)).toEqual([
      '$mobile_first_open',
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
    expect(facts[2].defaultProperties.sid).toBe(String(START));
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
    expect(facts[1].defaultProperties.sid).toBe(String(START));
    expect((await session.snapshot()).sid).toBe(String(START));
  });

  it('keeps sessions and first-open markers scoped to the source token', async () => {
    const clock = setup();
    const a = new MobileSession(clock.dependencies);
    const b = new MobileSession({ ...clock.dependencies, token: 'token-b' });
    await a.load();
    await b.load();

    expect((await a.foreground(true))[0].defaultProperties.sid).toBe(
      String(START),
    );
    expect((await b.foreground(true))[0].defaultProperties.sid).toBe(
      String(START),
    );
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
    expect(facts[0].defaultProperties.sid).toBe(String(START));
    expect(facts[1].defaultProperties.sid).toBe(String(START + 1_800_000));
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
    expect(screenFacts[0].defaultProperties.sid).toBe(String(START));
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
    for (const record of await session.pendingQueueFacts()) {
      await session.acknowledgeFact(record.id);
    }
    expect(await session.disableTracking()).toEqual([]);

    const optedIn = new MobileSession(clock.dependencies);
    await optedIn.load();
    const facts = await optedIn.foreground(true);
    expect(facts.map((fact) => fact.event)).toEqual([
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
    expect(facts[0].defaultProperties.sid).toBe('1791201600001');
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
        sid: String(START),
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
      String(START),
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
    expect(facts[0].defaultProperties.sid).toBe(String(START));
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
    expect(facts[0].defaultProperties.sid).toBe(String(START));
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

it.each(['snapshot', 'screen', 'foreground', 'rotateSession', 'resetSession'])(
  'ends an announced session at its last activity when a cold %s replaces it',
  async (method) => {
    const clock = setup();
    const original = new MobileSession(clock.dependencies);
    await original.foreground(true);
    clock.advance(2000);
    await original.background();
    for (const record of await original.pendingQueueFacts())
      await original.acknowledgeFact(record.id);
    clock.advance(31 * 60 * 1000);
    const cold = new MobileSession(clock.dependencies);
    await cold.load();
    if (method === 'screen') await cold.screen('Home');
    else if (method === 'foreground') await cold.foreground(true);
    else await cold[method]();
    const ends = (await cold.pendingQueueFacts()).filter(
      (record) => record.fact.event === '$mobile_session_end',
    );
    expect(ends).toHaveLength(1);
    expect(ends[0].fact.defaultProperties).toEqual({
      sid: String(START),
      mobile_occurred_at: '2026-10-05T12:00:02.000Z',
    });
  },
);

it.each(['snapshot', 'screen', 'foreground', 'rotateSession', 'resetSession'])(
  'does not end an unannounced headless session during %s replacement',
  async (method) => {
    const clock = setup();
    const original = new MobileSession(clock.dependencies);
    await original.snapshot();
    clock.advance(31 * 60 * 1000);
    const cold = new MobileSession(clock.dependencies);
    if (method === 'screen') await cold.screen('Home');
    else if (method === 'foreground') await cold.foreground(true);
    else await cold[method]();
    expect(
      (await cold.pendingQueueFacts()).filter(
        (record) => record.fact.event === '$mobile_session_end',
      ),
    ).toEqual([]);
  },
);

it.each(['snapshot', 'screen', 'checkpoint'])(
  'rotates a foreground session after a large clock rollback observed by %s',
  async (method) => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.foreground(true);
    for (const record of await session.pendingQueueFacts())
      await session.acknowledgeFact(record.id);
    clock.shiftWall(-5 * 60 * 1000 - 1);
    if (method === 'screen') await session.screen('Home');
    else await session[method]();
    const facts = (await session.pendingQueueFacts()).map(
      (record) => record.fact,
    );
    expect(
      facts.filter((fact) => fact.event === '$mobile_session_end'),
    ).toEqual([
      {
        event: '$mobile_session_end',
        defaultProperties: {
          sid: String(START),
          mobile_occurred_at: '2026-10-05T12:00:00.000Z',
        },
      },
    ]);
    expect((await session.snapshot()).sid).toBe(String(START - 300001));
  },
);

it('rotates a paused session when resume observes a large clock rollback', async () => {
  const clock = setup();
  const session = new MobileSession(clock.dependencies);
  await session.foreground(true);
  await session.pause();
  for (const record of await session.pendingQueueFacts())
    await session.acknowledgeFact(record.id);
  clock.shiftWall(-300001);
  expect(await session.resume()).toBe(false);
  await session.foreground(true);
  const facts = (await session.pendingQueueFacts()).map(
    (record) => record.fact,
  );
  expect(facts.map((fact) => fact.event)).toEqual([
    '$mobile_session_end',
    '$mobile_app_open',
    '$mobile_session_start',
  ]);
  expect(facts[0].defaultProperties).toEqual({
    sid: String(START),
    mobile_occurred_at: '2026-10-05T12:00:00.000Z',
  });
});

it.each([
  ['foreground', 5000, '2026-10-05T12:00:05.000Z'],
  ['background', 7000, '2026-10-05T12:00:02.000Z'],
])(
  'ends a %s session at its last active instant during identity rotation',
  async (state, elapsed, expectedEnd) => {
    const clock = setup();
    const session = new MobileSession(clock.dependencies);
    await session.foreground(true);
    if (state === 'background') {
      clock.advance(2000);
      await session.background();
      clock.advance(elapsed - 2000);
    } else clock.advance(elapsed);
    const facts = await session.rotateSession();
    expect(
      facts.find((fact) => fact.event === '$mobile_session_end')
        .defaultProperties,
    ).toEqual({ sid: String(START), mobile_occurred_at: expectedEnd });
    if (state === 'foreground') {
      expect(
        facts.find((fact) => fact.event === '$mobile_session_engagement'),
      ).toMatchObject({
        eventProperties: { engagement_duration_ms: 5000 },
        defaultProperties: { mobile_occurred_at: expectedEnd },
      });
    } else
      expect(facts.map((fact) => fact.event)).toEqual(['$mobile_session_end']);
  },
);
