import { uuidv4 } from './oursprivacy-utils';

const storageKey = (token) => `OURSPRIVACY_${token}_MOBILE_SESSION_V1`;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const ENGAGED_MS = 10 * 1000;

export class MobileSession {
  constructor({
    token,
    storage,
    wallNow,
    monotonicNow,
    uuid,
    appVersion,
    appBuild,
    getVisitorId,
  }) {
    this.token = token;
    this.storage = storage;
    this.wallNow = wallNow;
    this.monotonicNow = monotonicNow;
    this.uuid = uuid;
    this.appVersion = appVersion;
    this.appBuild = appBuild;
    this.getVisitorId = getVisitorId;
    this.state = null;
    this.foregrounded = false;
    this.automaticEnabled = false;
    this.engagementMarkMs = null;
    this.activeScreen = null;
    this.disabled = false;
    this.pendingFacts = [];
    this.pending = Promise.resolve();
  }

  _serialize(action) {
    const result = this.pending.then(async () => {
      const previous = {
        state: this.state
          ? { ...this.state, pendingEvents: [...this.state.pendingEvents] }
          : null,
        foregrounded: this.foregrounded,
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
      typeof record.sid === 'string' &&
      record.sid.length > 0 &&
      Number.isSafeInteger(record.startedAtMs) &&
      Number.isSafeInteger(record.lastActiveAtMs) &&
      record.lastActiveAtMs >= record.startedAtMs;
    this.state = {
      sid: validSession ? record.sid : null,
      startedAtMs: validSession ? record.startedAtMs : null,
      lastActiveAtMs: validSession ? record.lastActiveAtMs : null,
      firstOpenSent: record.firstOpenSent === true,
      observedAppVersion: record.observedAppVersion ?? null,
      observedAppBuild: record.observedAppBuild ?? null,
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
        visitorId: this.getVisitorId?.() ?? null,
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

  acknowledgeFact(id) {
    return this._serialize(async () => {
      await this._load();
      this.state.pendingEvents = this.state.pendingEvents.filter(
        (record) => record.id !== id,
      );
      await this._persist();
    });
  }

  _snapshot(atMs) {
    return {
      sid: this.state.sid,
      mobile_session_started_at: new Date(this.state.startedAtMs).toISOString(),
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

  _startSession(atMs) {
    this.state.sid = this.uuid();
    this.state.startedAtMs = atMs;
    this.state.lastActiveAtMs = atMs;
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

  _sessionExpired(atMs) {
    return (
      this.state.sid &&
      this.state.lastActiveAtMs != null &&
      atMs - this.state.lastActiveAtMs >= SESSION_TIMEOUT_MS
    );
  }

  foreground(automaticEnabled = false) {
    const atMs = this.wallNow();
    const monotonicMs = this.monotonicNow();
    return this._serialize(async () => {
      await this._load();
      if (this.disabled || this.foregrounded) return [];
      this.foregrounded = true;
      this.automaticEnabled = automaticEnabled;
      this.engagementMarkMs = monotonicMs;
      this.activeScreen = null;
      const expired = this._sessionExpired(atMs);
      const facts = [];
      if (expired && automaticEnabled && this.state.sessionStartSent) {
        facts.push({
          event: '$mobile_session_end',
          defaultProperties: { ...this._snapshot(atMs) },
        });
      }
      if (expired) {
        this.state.sid = null;
      }
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
        if (!this.state.firstOpenSent) {
          facts.push({
            event: '$mobile_first_open',
            defaultProperties: { ...snapshot },
          });
          this.state.firstOpenSent = true;
        }
        facts.push({
          event: '$mobile_app_open',
          defaultProperties: { ...snapshot },
        });
        if (!this.state.sessionStartSent) {
          facts.push({
            event: '$mobile_session_start',
            defaultProperties: { ...snapshot },
          });
          this.state.sessionStartSent = true;
        }
        if (updated) {
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
        if (this.appVersion != null) {
          this.state.observedAppVersion = this.appVersion;
        }
        if (this.appBuild != null) {
          this.state.observedAppBuild = this.appBuild;
        }
      }
      this._recordFacts(facts);
      await this._persist();
      return facts;
    });
  }

  background() {
    const atMs = this.wallNow();
    const monotonicMs = this.monotonicNow();
    return this._serialize(async () => {
      await this._load();
      if (!this.foregrounded) return [];
      const engagement = this._engagementFact(atMs, monotonicMs, 0);
      this.foregrounded = false;
      this._touch(atMs);
      if (engagement) this._recordFacts([engagement]);
      await this._persist();
      return engagement ? [engagement] : [];
    });
  }

  checkpoint() {
    const atMs = this.wallNow();
    const monotonicMs = this.monotonicNow();
    return this._serialize(async () => {
      await this._load();
      const engagement = this._engagementFact(atMs, monotonicMs, ENGAGED_MS);
      if (!engagement) return [];
      this._touch(atMs);
      this._recordFacts([engagement]);
      await this._persist();
      return [engagement];
    });
  }

  screen(name) {
    const atMs = this.wallNow();
    const monotonicMs = this.monotonicNow();
    return this._serialize(async () => {
      await this._load();
      if (this.disabled) return [];
      const screenName = typeof name === 'string' ? name.trim() : '';
      if (!screenName) return [];
      const expired = !this.foregrounded && this._sessionExpired(atMs);
      const facts = [];
      if (expired) {
        if (this.automaticEnabled && this.state.sessionStartSent) {
          facts.push({
            event: '$mobile_session_end',
            defaultProperties: this._snapshot(atMs),
          });
        }
        this._startSession(atMs);
        this.activeScreen = null;
      }
      if (screenName === this.activeScreen) return [];
      const engagement = this._engagementFact(atMs, monotonicMs, 0);
      if (!this.state.sid) this._startSession(atMs);
      this.activeScreen = screenName;
      this._touch(atMs);
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

  snapshot() {
    const atMs = this.wallNow();
    return this._serialize(async () => {
      await this._load();
      if (this.disabled) return null;
      if (!this.foregrounded && this._sessionExpired(atMs)) {
        if (this.automaticEnabled && this.state.sessionStartSent) {
          const end = {
            event: '$mobile_session_end',
            defaultProperties: this._snapshot(atMs),
          };
          this.pendingFacts.push(end);
          this._recordFacts([end]);
        }
        this._startSession(atMs);
      }
      if (!this.state.sid) this._startSession(atMs);
      this._touch(atMs);
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
      this._discardSession(false);
      await this._persist();
      return [];
    });
  }

  disableTracking() {
    return this._serialize(async () => {
      await this._load();
      if (
        this.state.pendingEvents.some(
          (record) => record.fact.event === '$mobile_first_open',
        )
      ) {
        this.state.firstOpenSent = false;
      }
      this.disabled = true;
      this._discardSession();
      await this._persist();
      return [];
    });
  }
}
