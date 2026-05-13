import {Platform, Dimensions} from "react-native";
import {OursPrivacyCore} from "./oursprivacy-core";
import {OursPrivacyType} from "./oursprivacy-constants";
import {OursPrivacyConfig} from "./oursprivacy-config";
import {OursPrivacyPersistent} from "./oursprivacy-persistent";
import {OursPrivacyQueueManager} from "./oursprivacy-queue";
import {OursPrivacyLogger} from "./oursprivacy-logger";
import packageJson from "../package.json";
import {uuidv4} from "./oursprivacy-utils";
import {parseAttributionFromURL} from "./oursprivacy-attribution";

// Caller-facing user-property field names are camelCase. The wire format
// (and server schema in @ours/types) is snake_case. Translate at the wire
// boundary here so the rest of the SDK and the queue payload stay snake_case.
const USER_PROPS_WIRE_MAP = {
  externalId: "external_id",
  phoneNumber: "phone_number",
  firstName: "first_name",
  lastName: "last_name",
  dateOfBirth: "date_of_birth",
  companyName: "company_name",
  jobTitle: "job_title",
  customProperties: "custom_properties",
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
    Promise.resolve(this.core.initialize(token)).catch(() => {});
    this.core.startProcessingQueue(token);
    this.oursprivacyPersistent = OursPrivacyPersistent.getInstance();
    this._defaultEventProperties = {};
    this._defaultUserCustomProperties = {};
    this._defaultUserConsentProperties = {};
    this._attributionDefaultProperties = {};
  }

  /**
   * Initialize the SDK from a single options bag. All caller-facing keys
   * are camelCase; this is the entry point that converts/applies them.
   */
  async initialize(token, options = {}) {
    OursPrivacyLogger.log(token, `Initializing OursPrivacy`);

    await this.oursprivacyPersistent.initializationCompletePromise(token);

    const serverURL =
      (options && options.serverURL) || "https://cdn.oursprivacy.com";
    this.setServerURL(token, serverURL);

    // Set opt-out flag BEFORE applying options so that initialURL processing
    // (which may fire $deep_link_opened) respects the opted-out state.
    await this._setOptedOutTrackingFlag(token, !!options.optOutTrackingByDefault);

    await this._applyInitializationOptions(token, options);
  }

  /**
   * Build the defaultProperties object for an event.
   *
   * Contains device metadata plus any marketing attribution captured via
   * trackDeepLink(). All keys here must exist in the server's defaultPayload
   * Zod schema — unknown keys are silently stripped server-side.
   */
  getDefaultProperties(token) {
    const {OS, Version, constants} = Platform;
    const {Model, Manufacturer, Brand} = constants || {};
    const {width, height} = Dimensions.get("screen");

    const props = {
      device_type: "mobile",
      os_name: OS === "ios" ? "iOS" : OS === "android" ? "Android" : OS,
      os_version: String(Version),
      version: packageJson.version,
      screen_width: width,
      screen_height: height,
    };
    if (OS === "ios") {
      props.device_vendor = "Apple";
      if (Model) props.device_model = Model;
    } else if (OS === "android") {
      props.device_vendor = Manufacturer || Brand || undefined;
      if (Model) props.device_model = Model;
    }

    const attribution = this._attributionDefaultProperties[token];
    if (attribution && Object.keys(attribution).length > 0) {
      Object.assign(props, attribution);
    }

    return props;
  }

  async reset(token) {
    await this.oursprivacyPersistent.reset(token);
    this.config.setIsManuallySetId(token, false);
    this._defaultEventProperties[token] = {};
    this._defaultUserCustomProperties[token] = {};
    this._defaultUserConsentProperties[token] = {};
    this._attributionDefaultProperties[token] = {};
  }

  async track(token, eventName, properties, userProperties) {
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

    const visitorId = this.oursprivacyPersistent.getVisitorId(token);
    const distinctId = uuidv4();

    const rawEventProps = {
      ...(this._defaultEventProperties[token] || {}),
      ...properties,
    };

    const mergedUserProps = this._composeUserProperties(token, userProperties);

    const eventData = {
      event: eventName,
      visitor_id: visitorId,
      distinct_id: distinctId,
      eventProperties: Object.keys(rawEventProps).length > 0 ? rawEventProps : null,
      userProperties: mergedUserProps,
      defaultProperties: this.getDefaultProperties(token),
    };

    await this.core.addToOursPrivacyQueue(token, OursPrivacyType.EVENTS, eventData);
  }

  // Mirrors web-cdp formatUserProperties (martech/apps/web-cdp/src/lib/format-track.ts).
  // Accepts camelCase userProperties at the caller surface and produces wire-format
  // (snake_case) for the queue payload.
  //
  // Top-level keys (email, externalId → external_id, etc.) spread onto userProperties;
  // nested customProperties and consent merge on top of the store defaults. Consent is
  // intentionally omitted when nothing carries it (OUR-3669).
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

    const merged = {...(wirePerCall || {})};

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
    await this.oursprivacyPersistent.reset(token, {preserveVisitorId: true});
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

  // identify(userProperties) — caller supplies identifying fields inside the
  // userProperties bag (most commonly externalId). Merging with store-level
  // default custom/consent properties is identical to track() — see
  // _composeUserProperties for the OUR-3669 consent guard.
  async identify(token, userProperties) {
    OursPrivacyLogger.log(token, `Identify`, userProperties);

    const visitorId = this.oursprivacyPersistent.getVisitorId(token);
    const distinctId = uuidv4();

    const mergedUserProps = this._composeUserProperties(token, userProperties);

    const eventData = {
      event: "$identify",
      visitor_id: visitorId,
      distinct_id: distinctId,
      eventProperties: null,
      userProperties: mergedUserProps,
      defaultProperties: this.getDefaultProperties(token),
    };

    await this.core.addToOursPrivacyQueue(token, OursPrivacyType.EVENTS, eventData);
  }

  getVisitorId(token) {
    return this.oursprivacyPersistent.getVisitorId(token);
  }

  async setVisitorId(token, visitorId) {
    this.config.setIsManuallySetId(token, true);
    this.oursprivacyPersistent.updateVisitorId(token, visitorId);
    await this.oursprivacyPersistent.persistVisitorId(token);
  }

  async trackDeepLink(token, url) {
    if (!url || typeof url !== "string") {
      OursPrivacyLogger.log(token, "trackDeepLink called with invalid URL, skipping.");
      return;
    }

    if (this.oursprivacyPersistent.getOptedOut(token)) {
      OursPrivacyLogger.log(token, "trackDeepLink skipped: user is opted out.");
      return;
    }

    OursPrivacyLogger.log(token, `trackDeepLink: ${url}`);

    const attribution = parseAttributionFromURL(url);

    if (attribution.oursVisitorId) {
      await this.setVisitorId(token, attribution.oursVisitorId);
    }

    this._attributionDefaultProperties[token] = {
      ...(attribution.utmParams || {}),
      ...(attribution.clickIds || {}),
    };

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

    if (options.defaultEventProperties) {
      this.updateDefaultEventProperties(token, options.defaultEventProperties);
    }
    if (options.defaultUserCustomProperties) {
      this.updateDefaultUserCustomProperties(token, options.defaultUserCustomProperties);
    }
    if (options.defaultUserConsentProperties) {
      this.updateDefaultUserConsentProperties(token, options.defaultUserConsentProperties);
    }
    if (options.visitorId) {
      await this.setVisitorId(token, options.visitorId);
    }
    if (options.initialURL) {
      await this.trackDeepLink(token, options.initialURL);
    }
  }
}
