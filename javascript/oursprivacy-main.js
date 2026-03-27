import {Platform} from "react-native";
import {OursPrivacyCore} from "./oursprivacy-core";
import {OursPrivacyType} from "./oursprivacy-constants";
import {OursPrivacyConfig} from "./oursprivacy-config";
import {OursPrivacyPersistent} from "./oursprivacy-persistent";
import {OursPrivacyQueueManager} from "./oursprivacy-queue";
import {OursPrivacyLogger} from "./oursprivacy-logger";
import packageJson from "../package.json";
import {uuidv4} from "./oursprivacy-utils";
import {parseAttributionFromURL} from "./oursprivacy-attribution";

export default class OursPrivacyMain {
  constructor(token, trackAutomaticEvents, storage) {
    this.token = token;
    this.config = OursPrivacyConfig.getInstance();
    this.core = OursPrivacyCore(storage);
    Promise.resolve(this.core.initialize(token)).catch(() => {});
    this.core.startProcessingQueue(token);
    this.oursprivacyPersistent = OursPrivacyPersistent.getInstance();
    this._defaultEventProperties = {};
    this._defaultUserCustomProperties = {};
    this._defaultUserConsentProperties = {};
    this._attributionDefaultProperties = {};
  }

  async initialize(
    token,
    trackAutomaticEvents = false,
    optOutTrackingDefault = false,
    options = {},
    serverURL = "https://cdn.oursprivacy.com"
  ) {
    OursPrivacyLogger.log(token, `Initializing OursPrivacy`);

    await this.oursprivacyPersistent.initializationCompletePromise(token);

    this.setServerURL(token, serverURL);

    // Set opt-out flag BEFORE applying options so that initialURL processing
    // (which may fire $deep_link_opened) respects the opted-out state.
    await this._setOptedOutTrackingFlag(token, !!optOutTrackingDefault);

    await this._applyInitializationOptions(token, options);
  }

  /**
   * Build the defaultProperties object for an event.
   *
   * Contains device metadata plus any marketing attribution captured via
   * trackDeepLink(). All keys here must exist in the server's defaultPayload
   * Zod schema — unknown keys are silently stripped server-side.
   *
   * @see javascript/oursprivacy-schema.js (auto-generated field list)
   */
  getDefaultProperties(token) {
    const {OS, Version, constants} = Platform;
    const {Model, Manufacturer, Brand} = constants || {};

    const props = {
      device_type: "mobile",
      os_name: OS === "ios" ? "iOS" : OS === "android" ? "Android" : OS,
      os_version: String(Version),
      version: packageJson.version,
    };
    if (OS === "ios") {
      props.device_vendor = "Apple";
      if (Model) props.device_model = Model;
    } else if (OS === "android") {
      props.device_vendor = Manufacturer || Brand || undefined;
      if (Model) props.device_model = Model;
    }

    // Merge marketing attribution (UTMs, click IDs) captured from deep links.
    // These are typed fields in the server's defaultPayload schema.
    const attribution = this._attributionDefaultProperties[token];
    if (attribution && Object.keys(attribution).length > 0) {
      Object.assign(props, attribution);
    }

    return props;
  }

  async reset(token) {
    await this.oursprivacyPersistent.reset(token);
    this._defaultEventProperties[token] = {};
    this._defaultUserCustomProperties[token] = {};
    this._defaultUserConsentProperties[token] = {};
    this._attributionDefaultProperties[token] = {};
  }

  async track(token, eventName, properties) {
    if (this.oursprivacyPersistent.getOptedOut(token)) {
      OursPrivacyLogger.log(
        token,
        `User has opted out of tracking, skipping tracking.`
      );
      return;
    }

    OursPrivacyLogger.log(
      token,
      `Track '${eventName}' with properties`,
      properties
    );

    // visitor_id: stable UUID for this device/install (persisted in AsyncStorage).
    // distinct_id: a new UUID generated per-event — it is a unique ID for this
    //   specific event occurrence, NOT a user ID. Do not confuse with visitor_id.
    const visitorId = this.oursprivacyPersistent.getDeviceId(token);
    const distinctId = uuidv4();

    const rawEventProps = {
      ...(this._defaultEventProperties[token] || {}),
      ...properties,
    };

    const customProps = this._defaultUserCustomProperties[token] || {};
    const consentProps = this._defaultUserConsentProperties[token] || {};
    const userProps = {};
    if (Object.keys(customProps).length > 0) userProps.custom_properties = {...customProps};
    if (Object.keys(consentProps).length > 0) userProps.consent = {...consentProps};

    const eventData = {
      event: eventName,
      visitor_id: visitorId,
      distinct_id: distinctId,
      eventProperties: Object.keys(rawEventProps).length > 0 ? rawEventProps : null,
      userProperties: Object.keys(userProps).length > 0 ? userProps : null,
      defaultProperties: this.getDefaultProperties(token),
    };

    await this.core.addToOursPrivacyQueue(token, OursPrivacyType.EVENTS, eventData);
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
    OursPrivacyLogger.log(
      token,
      `setFlushOnBackground(${String(flushOnBackground)}) is ignored in JavaScript mode.`
    );
  }

  flush(token) {
    this.core.flush(token);
  }

  async optOutTracking(token) {
    await this._setOptedOutTrackingFlag(token, true);
    await OursPrivacyQueueManager.clearQueue(token, OursPrivacyType.EVENTS);
    OursPrivacyLogger.log(token, "User has opted out of tracking");
    await this.oursprivacyPersistent.reset(token);
    this._defaultEventProperties[token] = {};
    this._defaultUserCustomProperties[token] = {};
    this._defaultUserConsentProperties[token] = {};
    this._attributionDefaultProperties[token] = {};
  }

  async optInTracking(token) {
    await this._setOptedOutTrackingFlag(token, false);
    OursPrivacyLogger.log(token, "User has opted in to tracking");
    await this.track(token, "$opt_in");
  }

  async _setOptedOutTrackingFlag(token, optedOut) {
    this.oursprivacyPersistent.updateOptedOut(token, optedOut);
    await this.oursprivacyPersistent.persistOptedOut(token);
  }

  hasOptedOutTracking(token) {
    return this.oursprivacyPersistent.getOptedOut(token);
  }

  async identify(token, newDistinctId, userProperties) {
    OursPrivacyLogger.log(token, `Identify '${newDistinctId}'`);
    const oldDistinctId = this.oursprivacyPersistent.getDistinctId(token);
    if (oldDistinctId === newDistinctId) {
      OursPrivacyLogger.log(
        token,
        `Distinct Id is already set to ${newDistinctId}, skipping identify.`
      );
      return;
    }
    this.oursprivacyPersistent.updateDistinctId(token, newDistinctId);
    this.oursprivacyPersistent.updateUserId(token, newDistinctId);
    await this.oursprivacyPersistent.persistIdentity(token);

    const visitorId = this.oursprivacyPersistent.getDeviceId(token);
    const distinctId = uuidv4();

    const customProps = this._defaultUserCustomProperties[token] || {};
    const consentProps = this._defaultUserConsentProperties[token] || {};

    const identifyUserProps = {
      external_id: newDistinctId,
      ...(userProperties || {}),
    };

    if (Object.keys(customProps).length > 0) {
      identifyUserProps.custom_properties = {
        ...customProps,
        ...(userProperties && userProperties.custom_properties ? userProperties.custom_properties : {}),
      };
    }
    if (Object.keys(consentProps).length > 0) {
      identifyUserProps.consent = {
        ...consentProps,
        ...(userProperties && userProperties.consent ? userProperties.consent : {}),
      };
    }

    const eventData = {
      event: "$identify",
      visitor_id: visitorId,
      distinct_id: distinctId,
      eventProperties: null,
      userProperties: identifyUserProps,
      defaultProperties: this.getDefaultProperties(token),
    };

    await this.core.addToOursPrivacyQueue(token, OursPrivacyType.EVENTS, eventData);
  }

  getVisitorId(token) {
    return this.oursprivacyPersistent.getDeviceId(token);
  }

  async setVisitorId(token, visitorId) {
    this.config.setIsManuallySetId(token, true);
    this.oursprivacyPersistent.updateDeviceId(token, visitorId);
    this.oursprivacyPersistent.updateDistinctId(token, visitorId);
    await this.oursprivacyPersistent.persistDeviceId(token);
    await this.oursprivacyPersistent.persistDistinctId(token);
  }

  async trackDeepLink(token, url) {
    if (!url || typeof url !== "string") {
      OursPrivacyLogger.log(token, "trackDeepLink called with invalid URL, skipping.");
      return;
    }

    // No state mutation while opted out — no attribution, no identity
    // stitching, no event. The deep link is silently dropped.
    if (this.oursprivacyPersistent.getOptedOut(token)) {
      OursPrivacyLogger.log(token, "trackDeepLink skipped: user is opted out.");
      return;
    }

    OursPrivacyLogger.log(token, `trackDeepLink: ${url}`);

    const attribution = parseAttributionFromURL(url);

    // If ours_visitor_id is in the URL, stitch web → app identity
    if (attribution.oursVisitorId) {
      await this.setVisitorId(token, attribution.oursVisitorId);
    }

    // Replace (not merge) attribution default properties with this link's
    // parsed fields. A new deep link is a new attribution context — stale
    // keys from a previous link must not carry over.
    this._attributionDefaultProperties[token] = {
      ...(attribution.utmParams || {}),
      ...(attribution.clickIds || {}),
    };

    // Fire a $deep_link_opened event. Attribution data lives in
    // defaultProperties (via getDefaultProperties); only the raw URL
    // goes into eventProperties to avoid duplicating typed schema fields.
    await this.track(token, "$deep_link_opened", {
      url: attribution.rawURL,
    });
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
    if (!options || typeof options !== "object") {
      return;
    }

    if (options.default_event_properties) {
      this.updateDefaultEventProperties(token, options.default_event_properties);
    }
    if (options.default_user_custom_properties) {
      this.updateDefaultUserCustomProperties(token, options.default_user_custom_properties);
    }
    if (options.default_user_consent_properties) {
      this.updateDefaultUserConsentProperties(token, options.default_user_consent_properties);
    }
    if (options.visitor_id) {
      await this.setVisitorId(token, options.visitor_id);
    }
    if (options.initialURL) {
      await this.trackDeepLink(token, options.initialURL);
    }
  }
}
