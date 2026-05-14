"use strict";

import OursPrivacyMain from "./javascript/oursprivacy-main"

const ERROR_MESSAGE = {
  INVALID_OBJECT: " is not a valid json object",
  INVALID_STRING: " is not a valid string",
};

const PARAMS = {
  TOKEN: "token",
  EVENT_NAME: "eventName",
  PROPERTIES: "properties",
  USER_PROPERTIES: "userProperties",
  OPTIONS: "options",
  URL: "url",
  VISITOR_ID: "visitorId",
};

const NOT_INITIALIZED_ERROR =
  "OursPrivacy.init(token, options) must be called before any other method.";

/**
 * The primary class for integrating OursPrivacy with your app.
 *
 * Usage:
 *   const ours = new OursPrivacy();
 *   await ours.init('YOUR_API_TOKEN', { ...options });
 *   ours.track('event_name');
 */
export class OursPrivacy {
  constructor() {
    this.token = null;
    this.oursprivacyImpl = null;
  }

  /**
   * Initialize OursPrivacy.
   *
   * @param {string} token Your OursPrivacy project token.
   * @param {OursPrivacyInitOptions} [options] Optional configuration:
   *   - trackAutomaticEvents: boolean — reserved for future automatic event tracking
   *   - optOutTrackingByDefault: boolean — start in an opted-out state (default false)
   *   - serverURL: string — override the ingest endpoint
   *   - visitorId: string — pre-set the visitor ID (sets is_manually_set_id: true)
   *   - initialURL: string — deep link URL to parse on init
   *   - defaultEventProperties: object — merged into every track() call
   *   - defaultUserCustomProperties: object — merged into userProperties.customProperties
   *   - defaultUserConsentProperties: object — merged into userProperties.consent
   *   - storage: AsyncStorage adapter — override the default storage backend
   */
  async init(token, options = {}) {
    if (!StringHelper.isValid(token)) {
      StringHelper.raiseError(PARAMS.TOKEN);
    }
    if (options !== undefined && !ObjectHelper.isValid(options)) {
      ObjectHelper.raiseError(PARAMS.OPTIONS);
    }
    const opts = options || {};
    this.token = token;
    this.oursprivacyImpl = new OursPrivacyMain(token, opts.storage);
    await this.oursprivacyImpl.initialize(token, opts);
  }

  /**
   * Set the base URL used for OursPrivacy API requests.
   * Defaults to https://cdn.oursprivacy.com.
   * To route data to OursPrivacy's EU servers, set to https://api-eu.oursprivacy.com.
   */
  setServerURL(serverURL) {
    this._requireInit();
    this.oursprivacyImpl.setServerURL(this.token, serverURL);
  }

  /**
   * Enable or disable debug logging at run time. Disabled by default.
   */
  setLoggingEnabled(loggingEnabled) {
    this._requireInit();
    this.oursprivacyImpl.setLoggingEnabled(this.token, loggingEnabled);
  }

  /**
   * Enable or disable flushing the event queue when the app moves to the
   * background. Enabled by default. Works on iOS and Android via AppState.
   */
  setFlushOnBackground(flushOnBackground) {
    this._requireInit();
    this.oursprivacyImpl.setFlushOnBackground(this.token, flushOnBackground);
  }

  /**
   * Set the maximum number of events sent in a single network request.
   * Values above 50 are clamped to 50.
   */
  setFlushBatchSize(flushBatchSize) {
    this._requireInit();
    this.oursprivacyImpl.setFlushBatchSize(this.token, flushBatchSize);
  }

  /**
   * Returns true if the visitor has opted out from tracking.
   */
  hasOptedOutTracking() {
    this._requireInit();
    return this.oursprivacyImpl.hasOptedOutTracking(this.token);
  }

  /**
   * Resume tracking after optOutTracking(). Also sends a $opt_in event.
   */
  optInTracking() {
    this._requireInit();
    this.oursprivacyImpl.optInTracking(this.token);
  }

  /**
   * Stop all tracking immediately. Queued events that have not been flushed
   * are discarded. Call flush() first to preserve them.
   */
  optOutTracking() {
    this._requireInit();
    this.oursprivacyImpl.optOutTracking(this.token);
  }

  /**
   * Link this anonymous visitor to a known user identity. Call this after login.
   * Sends a $identify event with the provided user properties.
   *
   * Callers pass identifying fields inside userProperties — most commonly
   * `externalId` (your system's user ID). The SDK merges in any default
   * customProperties / consent registered via updateDefault*().
   *
   * @param {OursPrivacyUserProperties} [userProperties] User properties to attach
   *   to this identity (e.g. { email, externalId, customProperties }).
   */
  identify(userProperties) {
    this._requireInit();
    if (!ObjectHelper.isValidOrUndefined(userProperties)) {
      ObjectHelper.raiseError(PARAMS.USER_PROPERTIES);
    }
    return this.oursprivacyImpl.identify(this.token, userProperties);
  }

  /**
   * Track an event.
   */
  track(eventName, eventProperties, userProperties) {
    this._requireInit();
    if (!StringHelper.isValid(eventName)) {
      StringHelper.raiseError(PARAMS.EVENT_NAME);
    }
    if (!ObjectHelper.isValidOrUndefined(eventProperties)) {
      ObjectHelper.raiseError(PARAMS.PROPERTIES);
    }
    if (!ObjectHelper.isValidOrUndefined(userProperties)) {
      ObjectHelper.raiseError(PARAMS.USER_PROPERTIES);
    }
    this.oursprivacyImpl.track(this.token, eventName, eventProperties, userProperties);
  }

  /**
   * Clear stored identity and all default properties. Generates a new visitor ID.
   * Call this when a visitor logs out.
   */
  reset() {
    this._requireInit();
    this.oursprivacyImpl.reset(this.token);
  }

  /**
   * Returns the stable visitor UUID for this install. Synchronous.
   */
  getVisitorId() {
    this._requireInit();
    return this.oursprivacyImpl.getVisitorId(this.token);
  }

  /**
   * Merge properties into eventProperties on every subsequent track() call.
   */
  updateDefaultEventProperties(properties) {
    this._requireInit();
    if (!ObjectHelper.isValidOrUndefined(properties)) {
      ObjectHelper.raiseError(PARAMS.PROPERTIES);
    }
    this.oursprivacyImpl.updateDefaultEventProperties(this.token, properties || {});
  }

  /**
   * Merge properties into userProperties.customProperties on every event.
   */
  updateDefaultUserCustomProperties(properties) {
    this._requireInit();
    if (!ObjectHelper.isValidOrUndefined(properties)) {
      ObjectHelper.raiseError(PARAMS.PROPERTIES);
    }
    this.oursprivacyImpl.updateDefaultUserCustomProperties(this.token, properties || {});
  }

  /**
   * Merge consent flags into userProperties.consent on every event.
   */
  updateDefaultUserConsentProperties(properties) {
    this._requireInit();
    if (!ObjectHelper.isValidOrUndefined(properties)) {
      ObjectHelper.raiseError(PARAMS.PROPERTIES);
    }
    this.oursprivacyImpl.updateDefaultUserConsentProperties(this.token, properties || {});
  }

  /**
   * Parse a deep link URL for marketing attribution data and fire a
   * $deep_link_opened event. Extracts UTM parameters, ad network click IDs
   * (gclid, fbclid, ttclid, aleid, etc.), and ours_visitor_id for
   * cross-platform identity stitching.
   */
  async trackDeepLink(url) {
    this._requireInit();
    if (!StringHelper.isValid(url)) {
      StringHelper.raiseError(PARAMS.URL);
    }
    await this.oursprivacyImpl.trackDeepLink(this.token, url);
  }

  /**
   * Update the visitor ID after initialization. Use this for web-to-app
   * identity stitching when the visitor ID arrives outside of a deep link.
   * Sets is_manually_set_id: true on all subsequent events.
   */
  async setVisitorId(visitorId) {
    this._requireInit();
    if (!StringHelper.isValid(visitorId)) {
      StringHelper.raiseError(PARAMS.VISITOR_ID);
    }
    await this.oursprivacyImpl.setVisitorId(this.token, visitorId);
  }

  /**
   * Flush queued events to the Ours Privacy ingest endpoint immediately.
   */
  flush() {
    this._requireInit();
    this.oursprivacyImpl.flush(this.token);
  }

  _requireInit() {
    if (!this.oursprivacyImpl) {
      throw new Error(NOT_INITIALIZED_ERROR);
    }
  }
}

class StringHelper {
  static isValid(str) {
    return typeof str === "string" && !/^\s*$/.test(str);
  }

  static isValidOrUndefined(str) {
    return str === undefined || StringHelper.isValid(str);
  }

  static raiseError(paramName) {
    throw new Error(`${paramName}${ERROR_MESSAGE.INVALID_STRING}`);
  }
}

class ObjectHelper {
  static isValid(obj) {
    return typeof obj === "object";
  }

  static isValidOrUndefined(obj) {
    return obj === undefined || ObjectHelper.isValid(obj);
  }

  static raiseError(paramName) {
    throw new Error(`${paramName}${ERROR_MESSAGE.INVALID_OBJECT}`);
  }
}
