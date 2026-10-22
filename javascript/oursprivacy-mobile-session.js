import { uuidv4 } from './oursprivacy-utils';
import { isSessionId } from './oursprivacy-mobile-payload';

const storageKey = (token) => `OURSPRIVACY_${token}_MOBILE_SESSION_V1`;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const CLOCK_ROLLBACK_MS = 5 * 60 * 1000;
const ENGAGED_MS = 10 * 1000;

export class MobileSession {
  constructor({
    token,
    storage,
    wallNow,
    monotonicNow,
    appVersion,
    appBuild,
    getVisitorId,
    getIsManuallySetId,
  }) {
    this.token = token;
    this.storage = storage;
    this.wallNow = wallNow;
    this.monotonicNow = monotonicNow;
    this.appVersion = appVersion;
    this.appBuild = appBuild;
    this.getVisitorId = getVisitorId;
    this.getIsManuallySetId = getIsManuallySetId;
    this.state = null;
    this.foregrounded = false;
    this.paused = false;
    this.automaticEnabled = false;
    this.engagementMarkMs = null;
    this.activeScreen = null;
    this.disabled = false;
    this.pendingFacts = [];
    this.acceptedFactIds = new Set();
    this.pending = Promise.resolve();
  }

  _serialize(action) {
    const result = this.pending.then(async () => {
      const previous = {
        state: this.state
          ? { ...this.state, pendingEvents: [...this.state.pendingEvents] }
          : null,
        foregrounded: this.foregrounded,
        paused: this.paused,
        automaticEnabled: this.automaticEnabled,
        engagementMarkMs: this.engagementMarkMs,
        activeScreen: this.activeScreen,
        disabled: this.disabled,
        pendingFacts: [...this.pendingFacts],
      };
      try {
        return await action();
      } catch (error) {
        Object.assign(this, previous);
        throw error;
      }
    });
    this.pending = result.catch(() => {});
    return result;
  }

  async _load() {
    if (this.state) return;
    const stored = await this.storage.getItem(storageKey(this.token));
    let parsed;
    try {
      parsed = stored ? JSON.parse(stored) : null;
    } catch {
      parsed = null;
    }
    const record =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    const validSession =
      isSessionId(record.sid) &&
      Number.isSafeInteger(record.startedAtMs) &&
      isSessionId(String(record.startedAtMs)) &&
      Number.isSafeInteger(record.lastActiveAtMs) &&
      record.lastActiveAtMs >= record.startedAtMs;
    this.state = {
      sid: validSession ? String(record.startedAtMs) : null,
      startedAtMs: validSession ? record.startedAtMs : null,
      lastActiveAtMs: validSession ? record.lastActiveAtMs : null,
      lastSessionEpochMs: Number.isSafeInteger(record.lastSessionEpochMs)
        ? record.lastSessionEpochMs
        : validSession
          ? record.startedAtMs
          : null,
      lastIssuedSessionMs: Number.isSafeInteger(record.lastIssuedSessionMs)
        ? record.lastIssuedSessionMs
        : validSession
          ? record.startedAtMs
          : null,
      firstOpenSent:
        record.firstOpenSent === true ||
        (!stored && this.existingInstall === true),
      observedAppVersion:
        record.observedAppVersion ??
        (!stored && this.existingInstall ? (this.appVersion ?? null) : null),
      observedAppBuild:
        record.observedAppBuild ??
        (!stored && this.existingInstall ? (this.appBuild ?? null) : null),
      sessionStartSent: validSession && record.sessionStartSent === true,
      foregroundDurationMs:
        validSession && Number.isSafeInteger(record.foregroundDurationMs)
          ? Math.max(0, record.foregroundDurationMs)
          : 0,
      pendingEvents: Array.isArray(record.pendingEvents)
        ? record.pendingEvents
        : [],
    };
  }

  load() {
    return this._serialize(() => this._load());
  }

  _persist() {
    return this.storage.setItem(
      storageKey(this.token),
      JSON.stringify(this.state),
    );
  }

  _recordFacts(facts) {
    if (facts.length === 0) return;
    this.state.pendingEvents.push(
      ...facts.map((fact) => ({
        id: uuidv4(),
        queueAccepted: fact.event === '$mobile_first_open' ? false : undefined,
        visitorId: this.getVisitorId?.() ?? null,
        isManuallySetId: this.getIsManuallySetId?.() ?? false,
        appVersion: this.appVersion,
        appBuild: this.appBuild,
        fact: {
          ...fact,
          eventProperties: fact.eventProperties
            ? { ...fact.eventProperties }
            : undefined,
          defaultProperties: { ...fact.defaultProperties },
        },
      })),
    );
  }

  pendingQueueFacts() {
    return this._serialize(async () => {
      await this._load();
      return this.state.pendingEvents.map((record) => ({
        ...record,
        fact: {
          ...record.fact,
          defaultProperties: { ...record.fact.defaultProperties },
        },
      }));
    });
  }

  markFactQueued(id) {
    const record = this.state.pendingEvents.find((item) => item.id === id);
    if (record?.fact.event !== '$mobile_first_open') return;
    this.acceptedFactIds.add(id);
    return this._serialize(async () => {
      await this._load();
      this.state.pendingEvents = this.state.pendingEvents.map((record) =>
        record.id === id ? { ...record, queueAccepted: true } : record,
      );
      await this._persist();
    });
  }

  acknowledgeFact(id) {
    return this._serialize(async () => {
      await this._load();
      this.state.pendingEvents = this.state.pendingEvents.filter(
        (record) => record.id !== id,
      );
      await this._persist();
      this.acceptedFactIds.delete(id);
    });
  }

  _snapshot(atMs) {
    return {
      sid: this.state.sid,
      mobile_occurred_at: new Date(
        Math.max(atMs, this.state.startedAtMs),
      ).toISOString(),
    };
  }

  _engagementFact(atMs, monotonicMs, minimumMs) {
    if (!this.foregrounded || !this.automaticEnabled) return null;
    const durationMs = Math.trunc(monotonicMs - this.engagementMarkMs);
    if (durationMs <= 0) return null;
    if (
      minimumMs > 0 &&
      Math.floor((this.state.foregroundDurationMs + durationMs) / minimumMs) ===
        Math.floor(this.state.foregroundDurationMs / minimumMs)
    ) {
      return null;
    }
    this.engagementMarkMs = monotonicMs;
    this.state.foregroundDurationMs += durationMs;
    const eventProperties = { engagement_duration_ms: durationMs };
    if (this.activeScreen) eventProperties.screen_name = this.activeScreen;
    return {
      event: '$mobile_session_engagement',
      eventProperties,
      defaultProperties: this._snapshot(atMs),
    };
  }

  remainingCheckpointMs() {
    if (!this.foregrounded || !this.automaticEnabled || !this.state) {
      return null;
    }
    const elapsedMs = Math.max(
      0,
      Math.trunc(this.monotonicNow() - this.engagementMarkMs),
    );
    return Math.max(
      1,
      ENGAGED_MS - (this.state.foregroundDurationMs % ENGAGED_MS) - elapsedMs,
    );
  }

  _startSession(atMs) {
    const issuedAt =
      this.state.lastSessionEpochMs != null &&
      this.state.lastIssuedSessionMs != null &&
      this.state.lastSessionEpochMs - atMs <= CLOCK_ROLLBACK_MS
        ? Math.max(atMs, this.state.lastIssuedSessionMs + 1)
        : atMs;
    this.state.sid = String(issuedAt);
    this.state.startedAtMs = issuedAt;
    this.state.lastActiveAtMs = issuedAt;
    this.state.lastSessionEpochMs = atMs;
    this.state.lastIssuedSessionMs = issuedAt;
    this.state.sessionStartSent = false;
    this.state.foregroundDurationMs = 0;
  }

  _touch(atMs) {
    this.state.lastActiveAtMs = Math.max(
      atMs,
      this.state.startedAtMs,
      this.state.lastActiveAtMs,
    );
  }

  _discardSession(clearPending = true) {
    this.foregrounded = false;
    this.paused = false;
    this.automaticEnabled = false;
    this.engagementMarkMs = null;
    this.activeScreen = null;
    this.state.sid = null;
    this.state.startedAtMs = null;
    this.state.lastActiveAtMs = null;
    this.state.sessionStartSent = false;
    this.state.foregroundDurationMs = 0;
    if (clearPending) this.state.pendingEvents = [];
    this.pendingFacts = [];
  }

  _sessionEnd() {
    if (!this.state.sid || !this.state.sessionStartSent) return null;
    return {
      event: '$mobile_session_end',
      defaultProperties: this._snapshot(this.state.lastActiveAtMs),
    };
  }

  _replaceExpiredSession(
    atMs,
    allowTimeout = !this.foregrounded && !this.paused,
  ) {
    const rollback =
      this.state.sid && this.state.lastActiveAtMs - atMs > CLOCK_ROLLBACK_MS;
    if (!rollback && !(allowTimeout && this._sessionExpired(atMs))) return [];
    const end = this._sessionEnd();
    this._startSession(atMs);
    this.activeScreen = null;
    const facts = end ? [end] : [];
    if (this.foregrounded && this.automaticEnabled) {
      this.engagementMarkMs = this.monotonicNow();
      facts.push({
        event: '$mobile_session_start',
        defaultProperties: this._snapshot(atMs),
      });
      this.state.sessionStartSent = true;
    }
    return facts;
  }

  _sessionExpired(atMs) {
    return (
      this.state.sid &&
      this.state.lastActiveAtMs != null &&
      atMs - this.state.lastActiveAtMs >= SESSION_TIMEOUT_MS
    );
  }

  foreground(
    automaticEnabled = false,
    emitOpenFacts = true,
    at,
    emitAppOpen = true,
  ) {
    const atMs = at?.wallMs ?? this.wallNow();
    const monotonicMs = at?.monotonicMs ?? this.monotonicNow();
    return this._serialize(async () => {
      await this._load();
      if (this.disabled || this.foregrounded) return [];
      const facts = this._replaceExpiredSession(atMs, true);
      this.foregrounded = true;
      this.paused = false;
      this.automaticEnabled = automaticEnabled;
      this.engagementMarkMs = monotonicMs;
      this.activeScreen = null;
      if (!this.state.sid) {
        this._startSession(atMs);
      }
      this._touch(atMs);
      if (automaticEnabled) {
        const snapshot = this._snapshot(atMs);
        const previousVersion = this.state.observedAppVersion;
        const previousBuild = this.state.observedAppBuild;
        const updated =
          this.state.firstOpenSent &&
          ((this.appVersion != null &&
            previousVersion != null &&
            this.appVersion !== previousVersion) ||
            (this.appBuild != null &&
              previousBuild != null &&
              this.appBuild !== previousBuild));
        if (emitOpenFacts && !this.state.firstOpenSent) {
          facts.push({
            event: '$mobile_first_open',
            defaultProperties: { ...snapshot },
          });
          this.state.firstOpenSent = true;
        }
        if (emitOpenFacts && emitAppOpen) {
          facts.push({
            event: '$mobile_app_open',
            defaultProperties: { ...snapshot },
          });
        }
        if (!this.state.sessionStartSent) {
          facts.push({
            event: '$mobile_session_start',
            defaultProperties: { ...snapshot },
          });
          this.state.sessionStartSent = true;
        }
        if (emitOpenFacts && updated) {
          const eventProperties = {};
          if (previousVersion != null) {
            eventProperties.previous_app_version = previousVersion;
          }
          if (previousBuild != null) {
            eventProperties.previous_app_build = previousBuild;
          }
          facts.push({
            event: '$mobile_app_update',
            eventProperties,
            defaultProperties: { ...snapshot },
          });
        }
        if (emitOpenFacts) {
          if (this.appVersion != null) {
            this.state.observedAppVersion = this.appVersion;
          }
          if (this.appBuild != null) {
            this.state.observedAppBuild = this.appBuild;
          }
        }
      }
      this._recordFacts(facts);
      await this._persist();
      return facts;
    });
  }

  background(at) {
    const atMs = at?.wallMs ?? this.wallNow();
    const monotonicMs = at?.monotonicMs ?? this.monotonicNow();
    return this._serialize(async () => {
      await this._load();
      if (this.paused) {
        this.paused = false;
        this.activeScreen = null;
        return [];
      }
      if (!this.foregrounded) return [];
      const engagement = this._engagementFact(atMs, monotonicMs, 0);
      this.foregrounded = false;
      this.activeScreen = null;
      this._touch(atMs);
      if (engagement) this._recordFacts([engagement]);
      await this._persist();
      return engagement ? [engagement] : [];
    });
  }

  pause(at) {
    const atMs = at?.wallMs ?? this.wallNow();
    const monotonicMs = at?.monotonicMs ?? this.monotonicNow();
    return this._serialize(async () => {
      await this._load();
      if (!this.foregrounded || this.disabled) return [];
      const engagement = this._engagementFact(atMs, monotonicMs, 0);
      this.foregrounded = false;
      this.paused = true;
      this.engagementMarkMs = null;
      this._touch(atMs);
      if (engagement) this._recordFacts([engagement]);
      await this._persist();
      return engagement ? [engagement] : [];
    });
  }

  resume(at) {
    const atMs = at?.wallMs ?? this.wallNow();
    const monotonicMs = at?.monotonicMs ?? this.monotonicNow();
    return this._serialize(async () => {
      await this._load();
      if (!this.paused || this.disabled) return false;
      const previousSid = this.state.sid;
      const facts = this._replaceExpiredSession(atMs, true);
      if (this.state.sid !== previousSid) {
        this.paused = false;
        this._recordFacts(facts);
        await this._persist();
        return false;
      }
      this.paused = false;
      this.foregrounded = true;
      this.engagementMarkMs = monotonicMs;
      this._touch(atMs);
      await this._persist();
      return true;
    });
  }

  checkpoint() {
    const atMs = this.wallNow();
    const monotonicMs = this.monotonicNow();
    return this._serialize(async () => {
      await this._load();
      const facts = this._replaceExpiredSession(atMs);
      const engagement = this._engagementFact(atMs, monotonicMs, ENGAGED_MS);
      if (engagement) facts.push(engagement);
      if (facts.length === 0) return [];
      this._touch(atMs);
      this._recordFacts(facts);
      await this._persist();
      return facts;
    });
  }

  screen(name, at) {
    const atMs = at?.wallMs ?? this.wallNow();
    const monotonicMs = at?.monotonicMs ?? this.monotonicNow();
    return this._serialize(async () => {
      await this._load();
      if (this.disabled) return [];
      const screenName = typeof name === 'string' ? name.trim() : '';
      if (!screenName) return [];
      const facts = this._replaceExpiredSession(atMs);
      if (screenName === this.activeScreen) return [];
      const engagement = this._engagementFact(atMs, monotonicMs, 0);
      if (!this.state.sid) this._startSession(atMs);
      this.activeScreen = screenName;
      if (!this.paused) this._touch(atMs);
      const view = {
        event: '$mobile_screen_view',
        eventProperties: { screen_name: screenName },
        defaultProperties: this._snapshot(atMs),
      };
      if (engagement) facts.push(engagement);
      facts.push(view);
      this._recordFacts(facts);
      await this._persist();
      return facts;
    });
  }

  snapshot(atMs = this.wallNow()) {
    return this._serialize(async () => {
      await this._load();
      if (this.disabled) return null;
      const facts = this._replaceExpiredSession(atMs);
      this.pendingFacts.push(
        ...facts.filter((fact) => fact.event === '$mobile_session_end'),
      );
      this._recordFacts(facts);
      if (!this.state.sid) this._startSession(atMs);
      if (!this.paused) this._touch(atMs);
      const snapshot = this._snapshot(atMs);
      await this._persist();
      return snapshot;
    });
  }

  drainPendingFacts() {
    return this._serialize(() => {
      const facts = this.pendingFacts;
      this.pendingFacts = [];
      return facts;
    });
  }

  resetSession() {
    return this._serialize(async () => {
      await this._load();
      const end = this._sessionEnd();
      if (end) this._recordFacts([end]);
      this._discardSession(false);
      await this._persist();
      return end ? [end] : [];
    });
  }

  rotateSession() {
    const atMs = this.wallNow();
    const monotonicMs = this.monotonicNow();
    return this._serialize(async () => {
      await this._load();
      const wasForegrounded = this.foregrounded;
      const automaticEnabled = this.automaticEnabled;
      const activeScreen = this.activeScreen;
      const engagement = this._engagementFact(atMs, monotonicMs, 0);
      if (wasForegrounded) this._touch(atMs);
      const end = this._sessionEnd();
      const facts = [engagement, end].filter(Boolean);
      this._recordFacts(facts);
      this._discardSession(false);
      if (wasForegrounded) {
        this._startSession(atMs);
        this.foregrounded = true;
        this.automaticEnabled = automaticEnabled;
        this.engagementMarkMs = monotonicMs;
        this.activeScreen = activeScreen;
      }
      await this._persist();
      return facts;
    });
  }

  announceRotatedSession() {
    return this._serialize(async () => {
      await this._load();
      if (
        this.disabled ||
        !this.foregrounded ||
        !this.automaticEnabled ||
        this.state.sessionStartSent
      ) {
        return [];
      }
      const fact = {
        event: '$mobile_session_start',
        defaultProperties: this._snapshot(this.state.startedAtMs),
      };
      this.state.sessionStartSent = true;
      this._recordFacts([fact]);
      await this._persist();
      return [fact];
    });
  }

  disableTracking(firstOpenAccepted = false) {
    return this._serialize(async () => {
      await this._load();
      if (firstOpenAccepted) {
        this.state.firstOpenSent = true;
      } else if (
        this.state.pendingEvents.some(
          (record) =>
            record.fact.event === '$mobile_first_open' &&
            record.queueAccepted !== true &&
            !this.acceptedFactIds.has(record.id),
        )
      ) {
        this.state.firstOpenSent = false;
      }
      this.disabled = true;
      this._discardSession();
      await this._persist();
      this.acceptedFactIds.clear();
      return [];
    });
  }
}
