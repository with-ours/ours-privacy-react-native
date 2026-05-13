"use strict";

import {Platform} from "react-native";
import OursPrivacyMain from "./javascript/oursprivacy-main"

const ERROR_MESSAGE = {
  INVALID_OBJECT: " is not a valid json object",
  INVALID_STRING: " is not a valid string",
};

const PARAMS = {
  TOKEN: "token",
  ID: "id",
  EVENT_NAME: "eventName",
  PROPERTIES: "properties",
};

const DEFAULT_OPT_OUT = false;

/**
 * The primary class for integrating OursPrivacy with your app.
 */
export class OursPrivacy {
  constructor(token, trackAutomaticEvents, storage) {
    if (!StringHelper.isValid(token)) {
      StringHelper.raiseError(PARAMS.TOKEN);
    }
    if (trackAutomaticEvents == null) {
      throw new Error(`trackAutomaticEvents is undefined`);
    }
    this.token = token;
    this.trackAutomaticEvents = trackAutomaticEvents;
    this.oursprivacyImpl = new OursPrivacyMain(token, trackAutomaticEvents, storage);
  }

  /**
   * Initializes OursPrivacy.
   *
   * @param {boolean} optOutTrackingDefault Whether to start tracking opted-out. Defaults to false.
   * @param {object} options Optional configuration:
   *   - serverURL: string — override the ingest endpoint
   *   - visitor_id: string — pre-set the visitor ID (sets is_manually_set_id: true)
   *   - default_event_properties: object — merged into every track() call
   *   - default_user_custom_properties: object — merged into userProperties.custom_properties
   *   - default_user_consent_properties: object — merged into userProperties.consent
   */
  async init(
    optOutTrackingDefault = DEFAULT_OPT_OUT,
    options = {}
  ) {
    const serverURL = (options && options.serverURL) || "https://cdn.oursprivacy.com";
    await this.oursprivacyImpl.initialize(
      this.token,
      this.trackAutomaticEvents,
      optOutTrackingDefault,
      options,
      serverURL
    );
  }

  /**
   * Set the base URL used for OursPrivacy API requests.
   * Defaults to https://cdn.oursprivacy.com.
   * To route data to OursPrivacy's EU servers, set to https://api-eu.oursprivacy.com.
   *
   * @param {string} serverURL the base URL used for OursPrivacy API requests
   */
  setServerURL(serverURL) {
    this.oursprivacyImpl.setServerURL(this.token, serverURL);
  }

  /**
   * Enable or disable debug logging at run time. Disabled by default.
   *
   * @param {boolean} loggingEnabled whether to enable logging
   */
  setLoggingEnabled(loggingEnabled) {
    this.oursprivacyImpl.setLoggingEnabled(this.token, loggingEnabled);
  }

  /**
   * Compatibility API retained from the earlier native-backed SDK surface.
   * In the current JavaScript runtime this is a safe no-op.
   *
   * @param {boolean} flushOnBackground
   */
  setFlushOnBackground(flushOnBackground) {
    if (Platform.OS === "ios") {
      this.oursprivacyImpl.setFlushOnBackground(this.token, flushOnBackground);
    } else {
      console.warn(
        "OursPrivacy setFlushOnBackground was called and ignored because this method only works on iOS."
      );
    }
  }

  /**
   * Set the maximum number of events sent in a single network request.
   * Values above 50 are clamped to 50.
   *
   * @param {integer} flushBatchSize
   */
  setFlushBatchSize(flushBatchSize) {
    this.oursprivacyImpl.setFlushBatchSize(this.token, flushBatchSize);
  }

  /**
   * Returns true if the visitor has opted out from tracking.
   *
   * @return {Promise<boolean>}
   */
  hasOptedOutTracking() {
    return this.oursprivacyImpl.hasOptedOutTracking(this.token);
  }

  /**
   * Resume tracking after optOutTracking(). Also sends a $opt_in event.
   */
  optInTracking() {
    this.oursprivacyImpl.optInTracking(this.token);
  }

  /**
   * Stop all tracking immediately. Queued events that have not been flushed
   * are discarded. Call flush() first to preserve them.
   */
  optOutTracking() {
    this.oursprivacyImpl.optOutTracking(this.token);
  }

  /**
   * Link this anonymous visitor to a known user identity.
   * Call this after login. Sends a $identify event with the provided ID and
   * user properties.
   *
   * @param {string} id The user's known identifier (e.g. email or external ID).
   * @param {object} userProperties Optional properties to attach to this identity.
   * @returns {Promise}
   */
  identify(id, userProperties) {
    return new Promise((resolve, reject) => {
      if (!StringHelper.isValid(id)) {
        StringHelper.raiseError(PARAMS.ID);
        reject(new Error("Invalid id"));
      }
      this.oursprivacyImpl
        .identify(this.token, id, userProperties)
        .then(() => {
          resolve();
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  /**
   * Track an event.
   *
   * @param {string} eventName The name of the event.
   * @param {object} [eventProperties] Optional key/value pairs to include with this event.
   * @param {object} [userProperties] Optional per-call user properties. Top-level keys
   *   (e.g. email, external_id) are spread onto userProperties on the wire; nested
   *   custom_properties and consent are merged on top of the defaults set via
   *   updateDefaultUserCustomProperties / updateDefaultUserConsentProperties.
   */
  track(eventName, eventProperties, userProperties) {
    if (!StringHelper.isValid(eventName)) {
      StringHelper.raiseError(PARAMS.EVENT_NAME);
    }
    if (!ObjectHelper.isValidOrUndefined(eventProperties)) {
      ObjectHelper.raiseError(PARAMS.PROPERTIES);
    }
    if (!ObjectHelper.isValidOrUndefined(userProperties)) {
      ObjectHelper.raiseError(PARAMS.PROPERTIES);
    }
    this.oursprivacyImpl.track(this.token, eventName, eventProperties, userProperties);
  }

  /**
   * Clear stored identity and all default properties. Generates a new visitor ID.
   * Call this when a visitor logs out.
   */
  reset() {
    this.oursprivacyImpl.reset(this.token);
  }

  /**
   * Returns the stable visitor UUID for this install. Synchronous.
   * This is the value sent as visitor_id on every event.
   *
   * @return {string|null}
   */
  getVisitorId() {
    return this.oursprivacyImpl.getVisitorId(this.token);
  }

  /**
   * Merge properties into eventProperties on every subsequent track() call.
   *
   * @param {object} properties Key/value pairs to merge.
   */
  updateDefaultEventProperties(properties) {
    if (!ObjectHelper.isValidOrUndefined(properties)) {
      ObjectHelper.raiseError(PARAMS.PROPERTIES);
    }
    this.oursprivacyImpl.updateDefaultEventProperties(this.token, properties || {});
  }

  /**
   * Merge properties into userProperties.custom_properties on every event.
   *
   * @param {object} properties Key/value pairs to merge.
   */
  updateDefaultUserCustomProperties(properties) {
    if (!ObjectHelper.isValidOrUndefined(properties)) {
      ObjectHelper.raiseError(PARAMS.PROPERTIES);
    }
    this.oursprivacyImpl.updateDefaultUserCustomProperties(this.token, properties || {});
  }

  /**
   * Merge consent flags into userProperties.consent on every event.
   *
   * @param {object} properties Key/value pairs to merge.
   */
  updateDefaultUserConsentProperties(properties) {
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
   *
   * Parsed attribution params are merged into default event properties so
   * they appear on all subsequent track() calls.
   *
   * @param {string} url The deep link or initial URL to parse.
   */
  /**
   * Parse a deep link URL for marketing attribution data and fire a
   * $deep_link_opened event. Extracts UTM parameters, ad network click IDs
   * (gclid, fbclid, ttclid, aleid, etc.), and ours_visitor_id for
   * cross-platform identity stitching.
   *
   * Parsed attribution params are merged into defaultProperties so
   * they appear on all subsequent track() calls.
   *
   * Await the returned promise before calling track() to ensure attribution
   * and visitor identity are fully applied.
   *
   * @param {string} url The deep link or initial URL to parse.
   * @returns {Promise<void>}
   */
  async trackDeepLink(url) {
    if (!StringHelper.isValid(url)) {
      StringHelper.raiseError("url");
    }
    await this.oursprivacyImpl.trackDeepLink(this.token, url);
  }

  /**
   * Update the visitor ID after initialization. Use this for web-to-app
   * identity stitching when the visitor ID arrives outside of a deep link
   * (e.g. via a native bridge or async lookup).
   *
   * Sets is_manually_set_id: true on all subsequent events.
   *
   * @param {string} visitorId The Ours Privacy visitor ID to adopt.
   */
  async setVisitorId(visitorId) {
    if (!StringHelper.isValid(visitorId)) {
      StringHelper.raiseError("visitorId");
    }
    await this.oursprivacyImpl.setVisitorId(this.token, visitorId);
  }

  /**
   * Flush queued events to the Ours Privacy ingest endpoint immediately.
   */
  flush() {
    this.oursprivacyImpl.flush(this.token);
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
