import { Platform, Dimensions, AppState } from 'react-native';
import { OursPrivacyCore } from './oursprivacy-core';
import { OursPrivacyType } from './oursprivacy-constants';
import { OursPrivacyConfig } from './oursprivacy-config';
import { OursPrivacyPersistent } from './oursprivacy-persistent';
import { OursPrivacyQueueManager } from './oursprivacy-queue';
import { OursPrivacyLogger } from './oursprivacy-logger';
import packageJson from '../package.json';
import { uuidv4 } from './oursprivacy-utils';
import { parseAttributionFromURL } from './oursprivacy-attribution';
import { MobileSession } from './oursprivacy-mobile-session';
import { AsyncStorageAdapter } from './oursprivacy-storage';

const CHECKPOINT_INTERVAL_MS = 10_000;

// Caller-facing user-property field names are camelCase. The wire format
// (and server schema in @ours/types) is snake_case. Translate at the wire
// boundary here so the rest of the SDK and the queue payload stay snake_case.
const USER_PROPS_WIRE_MAP = {
  externalId: 'external_id',
  phoneNumber: 'phone_number',
  firstName: 'first_name',
  lastName: 'last_name',
  dateOfBirth: 'date_of_birth',
  companyName: 'company_name',
  jobTitle: 'job_title',
  customProperties: 'custom_properties',
};

function toWireUserProperties(userProps) {
  if (!userProps) return userProps;
  const wire = {};
  for (const key of Object.keys(userProps)) {
    const wireKey = USER_PROPS_WIRE_MAP[key] || key;
    wire[wireKey] = userProps[key];
  }
  return wire;
}

export default class OursPrivacyMain {
  constructor(token, storage) {
    this.token = token;
    this.config = OursPrivacyConfig.getInstance();
    this.core = OursPrivacyCore(storage);
    this._coreReady = Promise.resolve(this.core.initialize(token));
    this._coreReady.catch(() => {});
    this.core.startProcessingQueue(token);
    this.oursprivacyPersistent = OursPrivacyPersistent.getInstance();
    this._mobileStorage = new AsyncStorageAdapter(storage);
    this._mobileSession = this._createMobileSession(token);
    this._pendingOperation = Promise.resolve();
    this._trackAutomaticEvents = false;
    this._appForegrounded = AppState?.currentState === 'active';
    this._checkpointTimer = null;
    this._initialized = false;
    this._defaultEventProperties = {};
    this._defaultUserCustomProperties = {};
    this._defaultUserConsentProperties = {};
    this._attributionDefaultProperties = {};
    this._flushOnBackgroundEnabled = true;
    this._appStateSubscription = null;
  }

  /**
   * Initialize the SDK from a single options bag. All caller-facing keys
   * are camelCase; this is the entry point that converts/applies them.
   */
  async initialize(token, options = {}) {
    return this._serialize(async () => {
      OursPrivacyLogger.log(token, `Initializing OursPrivacy`);

      await this._coreReady;
      await this.oursprivacyPersistent.initializationCompletePromise(token);

      const serverURL =
        (options && options.serverURL) || 'https://cdn.oursprivacy.com';
      this.setServerURL(token, serverURL);
      this.config.setOnIngestRejected(token, options.onIngestRejected);

      // Set opt-out flag BEFORE applying options so that initialURL processing
      // (which may fire $deep_link_opened) respects the opted-out state.
      if (options.optOutTrackingByDefault) {
        await this._setOptedOutTrackingFlag(token, true);
      }

      this._trackAutomaticEvents = options.trackAutomaticEvents === true;
      this._appVersion = options.appVersion;
      this._appBuild = options.appBuild;
      this._mobileSession.appVersion = this._appVersion;
      this._mobileSession.appBuild = this._appBuild;
      await this._mobileSession.load();
      await this._applyInitializationOptions(token, options);

      if (this.oursprivacyPersistent.getOptedOut(token)) {
        await this._mobileSession.disableTracking(
          OursPrivacyQueueManager.hasAcceptedFirstOpen(
            token,
            OursPrivacyType.EVENTS,
          ),
        );
        await OursPrivacyQueueManager.clearQueue(token, OursPrivacyType.EVENTS);
      } else {
        await this._enqueuePendingFacts(token);
        if (this._appForegrounded && this._isMobilePlatform()) {
          await this._mobileSession.foreground(this._trackAutomaticEvents);
          await this._enqueuePendingFacts(token);
          this._startCheckpoint(token);
        }
      }
      this._initialized = true;
      this._subscribeToAppState(token);
    });
  }

  _serialize(action) {
    const result = this._pendingOperation.then(action);
    this._pendingOperation = result.catch(() => {});
    return result;
  }

  _isMobilePlatform() {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }

  _createMobileSession(token) {
    return new MobileSession({
      token,
      storage: {
        getItem: (key) => this._mobileStorage.getItemStrict(key),
        setItem: (key, value) => this._mobileStorage.setItemStrict(key, value),
      },
      wallNow: () => Date.now(),
      monotonicNow: () => globalThis.performance?.now?.() ?? Date.now(),
      uuid: uuidv4,
      getVisitorId: () => this.oursprivacyPersistent.getVisitorId(token),
    });
  }

  _startCheckpoint(token) {
    if (
      this._checkpointTimer ||
      !this._trackAutomaticEvents ||
      !this._appForegrounded ||
      this.oursprivacyPersistent.getOptedOut(token) ||
      !this._isMobilePlatform()
    ) {
      return;
    }
    this._checkpointTimer = setInterval(() => {
      this._serialize(async () => {
        if (!this._checkpointTimer || !this._appForegrounded) return;
        await this._mobileSession.checkpoint();
        await this._enqueuePendingFacts(token);
      }).catch((error) => OursPrivacyLogger.error(token, String(error)));
    }, CHECKPOINT_INTERVAL_MS);
  }

  _stopCheckpoint() {
    if (this._checkpointTimer) clearInterval(this._checkpointTimer);
    this._checkpointTimer = null;
  }

  async _enqueuePendingFacts(token) {
    if (this.oursprivacyPersistent.getOptedOut(token)) return;
    const pending = await this._mobileSession.pendingQueueFacts();
    for (const record of pending) {
      const queued = await this._enqueueEvent(
        token,
        record.fact.event,
        record.fact.eventProperties,
        null,
        record.fact.defaultProperties,
        record.id,
        record.visitorId,
        false,
        { appVersion: record.appVersion, appBuild: record.appBuild },
        true,
      );
      if (queued === false) {
        throw new Error('Mobile fact was not queued');
      }
      await this._mobileSession.markFactQueued(record.id);
      await this._mobileSession.acknowledgeFact(record.id);
    }
  }

  _subscribeToAppState(token) {
    if (
      this._appStateSubscription ||
      !AppState ||
      typeof AppState.addEventListener !== 'function'
    ) {
      return;
    }
    this._appStateSubscription = AppState.addEventListener(
      'change',
      (nextState) => {
        const at = {
          wallMs: this._mobileSession.wallNow(),
          monotonicMs: this._mobileSession.monotonicNow(),
        };
        return this._serialize(async () => {
          if (nextState === 'background') {
            this._appForegrounded = false;
            this._stopCheckpoint();
            if (
              !this.oursprivacyPersistent.getOptedOut(token) &&
              this._isMobilePlatform()
            ) {
              await this._mobileSession.background(at);
              await this._enqueuePendingFacts(token);
            }
            if (this._flushOnBackgroundEnabled) this.flush(token);
          } else if (nextState === 'active') {
            this._appForegrounded = true;
            if (
              !this.oursprivacyPersistent.getOptedOut(token) &&
              this._isMobilePlatform()
            ) {
              await this._mobileSession.foreground(
                this._trackAutomaticEvents,
                true,
                at,
              );
              await this._enqueuePendingFacts(token);
              this._startCheckpoint(token);
            }
          }
        });
      },
    );
  }

  /**
   * Build the defaultProperties object for an event.
   *
   * Contains device metadata plus any marketing attribution captured via
   * trackDeepLink(). All keys here must exist in the server's defaultPayload
   * Zod schema — unknown keys are silently stripped server-side.
   */
  getDefaultProperties(
    token,
    mobileSnapshot,
    appMetadata,
    includeAttribution = true,
  ) {
    const { OS, Version, constants } = Platform;
    const { Model, Manufacturer, Brand } = constants || {};
    const { width, height } = Dimensions.get('screen');

    const props = {
      device_type: 'mobile',
      os_name: OS === 'ios' ? 'iOS' : OS === 'android' ? 'Android' : OS,
      os_version: String(Version),
      version: `react-native@${packageJson.version}`,
      screen_width: width,
      screen_height: height,
    };
    if (OS === 'ios') {
      props.device_vendor = 'Apple';
      if (Model) props.device_model = Model;
    } else if (OS === 'android') {
      props.device_vendor = Manufacturer || Brand || undefined;
      if (Model) props.device_model = Model;
    }

    const attribution = this._attributionDefaultProperties[token];
    if (
      includeAttribution &&
      attribution &&
      Object.keys(attribution).length > 0
    ) {
      Object.assign(props, attribution);
    }

    if (mobileSnapshot && this._isMobilePlatform()) {
      const appVersion = appMetadata
        ? appMetadata.appVersion
        : this._mobileSession.appVersion;
      const appBuild = appMetadata
        ? appMetadata.appBuild
        : this._mobileSession.appBuild;
      if (appVersion != null) {
        props.app_version = appVersion;
      }
      if (appBuild != null) {
        props.app_build = appBuild;
      }
      Object.assign(props, mobileSnapshot, {
        mobile_platform: Platform.OS,
        mobile_contract_version: 1,
      });
    }

    return props;
  }

  async reset(token) {
    return this._serialize(async () => {
      const resumeForeground =
        this._appForegrounded &&
        this._initialized &&
        !this.oursprivacyPersistent.getOptedOut(token) &&
        this._isMobilePlatform();
      this._stopCheckpoint();
      if (resumeForeground) {
        await this._mobileSession.rotateSession();
        await this._enqueuePendingFacts(token);
      } else {
        await this._mobileSession.resetSession();
      }
      await this.oursprivacyPersistent.reset(token);
      this.config.setIsManuallySetId(token, false);
      this._defaultEventProperties[token] = {};
      this._defaultUserCustomProperties[token] = {};
      this._defaultUserConsentProperties[token] = {};
      this._attributionDefaultProperties[token] = {};
      if (resumeForeground) {
        await this._mobileSession.announceRotatedSession();
        await this._enqueuePendingFacts(token);
        this._startCheckpoint(token);
      }
    });
  }

  async track(token, eventName, properties, userProperties) {
    return this._serialize(() =>
      this._track(token, eventName, properties, userProperties),
    );
  }

  async trackScreen(token, screenName) {
    return this._serialize(async () => {
      if (
        this.oursprivacyPersistent.getOptedOut(token) ||
        !this._isMobilePlatform()
      ) {
        return;
      }
      await this._mobileSession.screen(screenName);
      await this._enqueuePendingFacts(token);
    });
  }

  async _track(
    token,
    eventName,
    properties,
    userProperties,
    includeEventDefaults = true,
  ) {
    if (this.oursprivacyPersistent.getOptedOut(token)) {
      OursPrivacyLogger.log(
        token,
        `User has opted out of tracking, skipping tracking.`,
      );
      return;
    }

    OursPrivacyLogger.log(
      token,
      `Track '${eventName}' with properties`,
      properties,
    );

    const snapshot = this._isMobilePlatform()
      ? await this._mobileSession.snapshot()
      : null;
    if (snapshot) {
      await this._mobileSession.drainPendingFacts();
      await this._enqueuePendingFacts(token);
    }
    await this._enqueueEvent(
      token,
      eventName,
      properties,
      userProperties,
      snapshot,
      undefined,
      undefined,
      includeEventDefaults,
    );
  }

  async _enqueueEvent(
    token,
    eventName,
    properties,
    userProperties,
    snapshot,
    distinctId = uuidv4(),
    visitorId = this.oursprivacyPersistent.getVisitorId(token),
    includeEventDefaults = true,
    appMetadata,
    isCanonicalFact = false,
  ) {
    const rawEventProps = {
      ...(includeEventDefaults
        ? this._defaultEventProperties[token] || {}
        : {}),
      ...properties,
    };
    const eventData = {
      event: eventName,
      visitor_id: visitorId,
      distinct_id: distinctId,
      eventProperties:
        Object.keys(rawEventProps).length > 0 ? rawEventProps : null,
      userProperties: isCanonicalFact
        ? null
        : this._composeUserProperties(token, userProperties),
      defaultProperties: this.getDefaultProperties(
        token,
        snapshot,
        appMetadata,
        !isCanonicalFact,
      ),
    };
    await this._coreReady;
    return this.core.addToOursPrivacyQueue(
      token,
      OursPrivacyType.EVENTS,
      eventData,
    );
  }

  // Accepts camelCase userProperties at the caller surface and produces wire-format
  // (snake_case) for the queue payload.
  //
  // Top-level keys (email, externalId → external_id, etc.) spread onto userProperties;
  // nested customProperties and consent merge on top of the store defaults. Consent is
  // intentionally omitted when nothing carries it.
  _composeUserProperties(token, perCallUserProps) {
    const wirePerCall = toWireUserProperties(perCallUserProps);

    const defaultCustom = this._defaultUserCustomProperties[token] || {};
    const defaultConsent = this._defaultUserConsentProperties[token] || {};
    const hasDefaultCustom = Object.keys(defaultCustom).length > 0;
    const hasDefaultConsent = Object.keys(defaultConsent).length > 0;
    const hasPerCall = wirePerCall && Object.keys(wirePerCall).length > 0;

    if (!hasDefaultCustom && !hasDefaultConsent && !hasPerCall) {
      return null;
    }

    const merged = { ...(wirePerCall || {}) };

    if (hasDefaultCustom || wirePerCall?.custom_properties) {
      merged.custom_properties = {
        ...defaultCustom,
        ...(wirePerCall?.custom_properties || {}),
      };
    }

    if (hasDefaultConsent || wirePerCall?.consent) {
      merged.consent = {
        ...defaultConsent,
        ...(wirePerCall?.consent || {}),
      };
    }

    return merged;
  }

  setLoggingEnabled(token, loggingEnabled) {
    this.config.setLoggingEnabled(token, loggingEnabled);
  }

  setServerURL(token, serverURL) {
    this.config.setServerURL(token, serverURL);
  }

  setFlushBatchSize(token, flushBatchSize) {
    this.config.setFlushBatchSize(token, flushBatchSize);
  }

  setFlushOnBackground(token, flushOnBackground) {
    this._flushOnBackgroundEnabled = !!flushOnBackground;
    OursPrivacyLogger.log(
      token,
      `Set flushOnBackground: ${this._flushOnBackgroundEnabled}`,
    );
  }

  flush(token) {
    return this._serialize(() => this.core.flush(token));
  }

  async optOutTracking(token) {
    const persistOptOut = this._setOptedOutTrackingFlag(token, true);
    return this._serialize(async () => {
      await persistOptOut;
      this._stopCheckpoint();
      await this._mobileSession.disableTracking(
        OursPrivacyQueueManager.hasAcceptedFirstOpen(
          token,
          OursPrivacyType.EVENTS,
        ),
      );
      await OursPrivacyQueueManager.clearQueue(token, OursPrivacyType.EVENTS);
      OursPrivacyLogger.log(token, 'User has opted out of tracking');
      await this.oursprivacyPersistent.reset(token, {
        preserveVisitorId: true,
      });
      this._defaultEventProperties[token] = {};
      this._defaultUserCustomProperties[token] = {};
      this._defaultUserConsentProperties[token] = {};
      this._attributionDefaultProperties[token] = {};
    });
  }

  async optInTracking(token) {
    return this._serialize(async () => {
      await this._setOptedOutTrackingFlag(token, false);
      this._mobileSession = this._createMobileSession(token);
      this._mobileSession.appVersion = this._appVersion;
      this._mobileSession.appBuild = this._appBuild;
      await this._mobileSession.load();
      if (this._appForegrounded && this._isMobilePlatform()) {
        await this._mobileSession.foreground(this._trackAutomaticEvents);
        await this._enqueuePendingFacts(token);
        this._startCheckpoint(token);
      }
      OursPrivacyLogger.log(token, 'User has opted in to tracking');
      await this._track(token, '$opt_in');
    });
  }

  async _setOptedOutTrackingFlag(token, optedOut) {
    const previous = this.oursprivacyPersistent.getOptedOut(token);
    this.oursprivacyPersistent.updateOptedOut(token, optedOut);
    try {
      await this.oursprivacyPersistent.persistOptedOut(token);
    } catch (error) {
      if (!optedOut) {
        this.oursprivacyPersistent.updateOptedOut(token, previous);
      }
      throw error;
    }
  }

  hasOptedOutTracking(token) {
    return this.oursprivacyPersistent.getOptedOut(token);
  }

  // identify(userProperties) — caller supplies identifying fields inside the
  // userProperties bag (most commonly externalId). Merging with store-level
  // default custom/consent properties is identical to track() — see
  // _composeUserProperties for the consent guard.
  async identify(token, userProperties) {
    return this._serialize(() =>
      this._track(token, '$identify', null, userProperties, false),
    );
  }

  getVisitorId(token) {
    return this.oursprivacyPersistent.getVisitorId(token);
  }

  async setVisitorId(token, visitorId) {
    return this._serialize(() => this._setVisitorId(token, visitorId));
  }

  async _setVisitorId(token, visitorId) {
    const previous = this.oursprivacyPersistent.getVisitorId(token);
    const resumeForeground =
      previous !== visitorId &&
      this._initialized &&
      this._appForegrounded &&
      !this.oursprivacyPersistent.getOptedOut(token) &&
      this._isMobilePlatform();
    if (previous !== visitorId) {
      this._stopCheckpoint();
      if (resumeForeground) {
        await this._mobileSession.rotateSession();
        await this._enqueuePendingFacts(token);
      } else {
        await this._mobileSession.resetSession();
      }
    }
    this.config.setIsManuallySetId(token, true);
    this.oursprivacyPersistent.updateVisitorId(token, visitorId);
    await this.oursprivacyPersistent.persistVisitorId(token);
    if (resumeForeground) {
      await this._mobileSession.announceRotatedSession();
      await this._enqueuePendingFacts(token);
      this._startCheckpoint(token);
    }
  }

  async trackDeepLink(token, url) {
    return this._serialize(() => this._trackDeepLink(token, url));
  }

  async _trackDeepLink(token, url) {
    if (!url || typeof url !== 'string') {
      OursPrivacyLogger.log(
        token,
        'trackDeepLink called with invalid URL, skipping.',
      );
      return;
    }

    if (this.oursprivacyPersistent.getOptedOut(token)) {
      OursPrivacyLogger.log(token, 'trackDeepLink skipped: user is opted out.');
      return;
    }

    OursPrivacyLogger.log(token, 'trackDeepLink processed');

    const attribution = parseAttributionFromURL(url);

    this._attributionDefaultProperties[token] = {
      ...(attribution.utmParams || {}),
      ...(attribution.clickIds || {}),
    };

    if (attribution.oursVisitorId) {
      await this._setVisitorId(token, attribution.oursVisitorId);
    }

    await this._track(token, '$deep_link_opened', undefined, undefined, false);
  }

  updateDefaultEventProperties(token, properties) {
    this._defaultEventProperties[token] = {
      ...(this._defaultEventProperties[token] || {}),
      ...properties,
    };
  }

  updateDefaultUserCustomProperties(token, properties) {
    this._defaultUserCustomProperties[token] = {
      ...(this._defaultUserCustomProperties[token] || {}),
      ...properties,
    };
  }

  updateDefaultUserConsentProperties(token, properties) {
    this._defaultUserConsentProperties[token] = {
      ...(this._defaultUserConsentProperties[token] || {}),
      ...properties,
    };
  }

  async _applyInitializationOptions(token, options) {
    if (!options || typeof options !== 'object') {
      return;
    }

    if (options.defaultEventProperties) {
      this.updateDefaultEventProperties(token, options.defaultEventProperties);
    }
    if (options.defaultUserCustomProperties) {
      this.updateDefaultUserCustomProperties(
        token,
        options.defaultUserCustomProperties,
      );
    }
    if (options.defaultUserConsentProperties) {
      this.updateDefaultUserConsentProperties(
        token,
        options.defaultUserConsentProperties,
      );
    }
    if (options.visitorId) {
      await this._setVisitorId(token, options.visitorId);
    }
    if (options.initialURL) {
      await this._trackDeepLink(token, options.initialURL);
    }
  }
}
