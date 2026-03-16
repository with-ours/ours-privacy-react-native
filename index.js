"use strict";

import {Platform, NativeModules} from "react-native";
const {OursPrivacyReactNative} = NativeModules;
import OursPrivacyMain from "./javascript/oursprivacy-main"

const ERROR_MESSAGE = {
  INVALID_OBJECT: " is not a valid json object",
  INVALID_STRING: " is not a valid string",
};

const PARAMS = {
  TOKEN: "token",
  DISTINCT_ID: "distinctId",
  EVENT_NAME: "eventName",
  PROPERTIES: "properties",
};

const DEFAULT_OPT_OUT = false;

/**
 * The primary class for integrating OursPrivacy with your app.
 */
export class OursPrivacy {
  constructor(token, trackAutomaticEvents, useNative = true, storage) {
    if (!StringHelper.isValid(token)) {
      StringHelper.raiseError(PARAMS.TOKEN);
    }
    if (trackAutomaticEvents == null) {
      throw new Error(`trackAutomaticEvents is undefined`);
    }
    this.token = token;
    this.trackAutomaticEvents = trackAutomaticEvents;

    if (useNative && OursPrivacyReactNative) {
      this.oursprivacyImpl = OursPrivacyReactNative;
      return;
    } else if (useNative) {
      console.warn(
        "OursPrivacyReactNative is not available; using JavaScript mode. If you prefer not to use the JavaScript mode, please follow the guide in the GitHub repository: https://github.com/oursprivacy/oursprivacy-react-native."
      );
    }

    this.oursprivacyImpl = new OursPrivacyMain(token, trackAutomaticEvents, storage);
  }

  /**
   * Initializes OursPrivacy
   *
   * @param {boolean} optOutTrackingDefault Optional Whether or not OursPrivacy can start tracking by default. See optOutTracking()
   * @param {object} options Optional Options object. Supports:
   *   - serverURL: string
   *   - user_id: string
   *   - default_event_properties: object
   *   - default_user_custom_properties: object
   *   - default_user_consent_properties: object
   *
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
   * Useful if you need to proxy OursPrivacy requests. Defaults to https://cdn.oursprivacy.com.
   * To route data to OursPrivacy's EU servers, set to https://api-eu.oursprivacy.com
   *
   * @param {string} serverURL the base URL used for OursPrivacy API requests
   *
   */
  setServerURL(serverURL) {
    this.oursprivacyImpl.setServerURL(this.token, serverURL);
  }

  /**
   * This allows enabling or disabling of all OursPrivacy logs at run time.
   * All logging is disabled by default. Usually, this is only required if
   * you are running into issues with the SDK that you want to debug
   *
   * @param {boolean} loggingEnabled whether to enable logging
   *
   */
  setLoggingEnabled(loggingEnabled) {
    this.oursprivacyImpl.setLoggingEnabled(this.token, loggingEnabled);
  }

  /**
   * This allows enabling or disabling whether or not OursPrivacy flushes events
   * when the app enters the background on iOS. This is set to true by default.
   *
   * @param {boolean} flushOnBackground whether to enable logging
   *
   */
  setFlushOnBackground(flushOnBackground) {
    if (Platform.OS === "ios") {
      OursPrivacyReactNative.setFlushOnBackground(this.token, flushOnBackground);
    } else {
      console.warn(
        "OursPrivacy setFlushOnBackground was called and ignored because this method only works on iOS."
      );
    }
  }


  /**
   * Set the number of events sent in a single network request to the OursPrivacy server.
   * By configuring this value, you can optimize network usage and manage the frequency of communication between the client and the server. The maximum size is 50; any value over 50 will default to 50.
   *
   * @param {integer} flushBatchSize whether to automatically send the client IP Address.
   * Defaults to true.
   *
   */
  setFlushBatchSize(flushBatchSize) {
    this.oursprivacyImpl.setFlushBatchSize(this.token, flushBatchSize);
  }

  /**
   * Will return true if the user has opted out from tracking.
   *
   * @return {Promise<boolean>} true if user has opted out from tracking. Defaults to false.
   */
  hasOptedOutTracking() {
    return this.oursprivacyImpl.hasOptedOutTracking(this.token);
  }

  /**
   * Use this method to opt-in an already opted-out user from tracking. People updates and track
   * calls will be sent to OursPrivacy after using this method.
   * This method will internally track an opt-in event to your project.
   *
   */
  optInTracking() {
    this.oursprivacyImpl.optInTracking(this.token);
  }

  /**
   * Use this method to opt-out a user from tracking. Events and people updates that haven't been
   * flushed yet will be deleted. Use flush() before calling this method if you want
   * to send all the queues to OursPrivacy before.
   *
   * This method will also remove any user-related information from the device.
   */
  optOutTracking() {
    this.oursprivacyImpl.optOutTracking(this.token);
  }

  /**
   * Associate all future calls to track() with the user identified by
   * the given distinct id.
   *
   * @param {string} distinctId a string uniquely identifying this user.
   * @param {object} userProperties Optional user properties to set on identify.
   * @returns {Promise} A promise that resolves when the identify is successful.
   *
   */
  identify(distinctId, userProperties) {
    return new Promise((resolve, reject) => {
      if (!StringHelper.isValid(distinctId)) {
        StringHelper.raiseError(PARAMS.DISTINCT_ID);
        reject(new Error("Invalid distinctId"));
      }
      this.oursprivacyImpl
        .identify(this.token, distinctId, userProperties)
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
   * @param {string} eventName The name of the event to send
   * @param {object} properties A Map containing the key value pairs of the properties to include in this event.
   *                   Pass null if no extra properties exist.
   */
  track(eventName, properties) {
    if (!StringHelper.isValid(eventName)) {
      StringHelper.raiseError(PARAMS.EVENT_NAME);
    }
    if (!ObjectHelper.isValidOrUndefined(properties)) {
      ObjectHelper.raiseError(PARAMS.PROPERTIES);
    }
    this.oursprivacyImpl.track(this.token, eventName, properties);
  }

  /**
   * Generates a new random visitor id for this instance.
   * Useful for clearing data when a user logs out.
   */
  reset() {
    this.oursprivacyImpl.reset(this.token);
  }

  /**
   * Returns the visitor id (stable device UUID, no prefix).
   *
   * @return {string|null} The visitor id
   */
  getVisitorId() {
    return this.oursprivacyImpl.getVisitorId(this.token);
  }

  /**
   * Update properties that will be included in defaultProperties.eventProperties for every event.
   *
   * @param {object} properties Key/value pairs to merge into default event properties.
   */
  updateDefaultEventProperties(properties) {
    if (!ObjectHelper.isValidOrUndefined(properties)) {
      ObjectHelper.raiseError(PARAMS.PROPERTIES);
    }
    this.oursprivacyImpl.updateDefaultEventProperties(this.token, properties || {});
  }

  /**
   * Update user custom properties sent with every event in userProperties.custom_properties.
   *
   * @param {object} properties Key/value pairs to merge into default user custom properties.
   */
  updateDefaultUserCustomProperties(properties) {
    if (!ObjectHelper.isValidOrUndefined(properties)) {
      ObjectHelper.raiseError(PARAMS.PROPERTIES);
    }
    this.oursprivacyImpl.updateDefaultUserCustomProperties(this.token, properties || {});
  }

  /**
   * Update user consent properties sent with every event in userProperties.consent.
   *
   * @param {object} properties Key/value pairs to merge into default user consent properties.
   */
  updateDefaultUserConsentProperties(properties) {
    if (!ObjectHelper.isValidOrUndefined(properties)) {
      ObjectHelper.raiseError(PARAMS.PROPERTIES);
    }
    this.oursprivacyImpl.updateDefaultUserConsentProperties(this.token, properties || {});
  }

  /**
   * Push all queued OursPrivacy events to OursPrivacy servers.
   */
  flush() {
    this.oursprivacyImpl.flush(this.token);
  }
}

class StringHelper {
  /**
      Check whether the parameter is not a blank string.
     */
  static isValid(str) {
    return typeof str === "string" && !/^\s*$/.test(str);
  }

  /**
      Check whether the parameter is undefined or not a blank string.
     */
  static isValidOrUndefined(str) {
    return str === undefined || StringHelper.isValid(str);
  }

  /**
      Raise a string validation error.
     */
  static raiseError(paramName) {
    throw new Error(`${paramName}${ERROR_MESSAGE.INVALID_STRING}`);
  }
}

class ObjectHelper {
  /**
      Check whether the parameter is an object.
     */
  static isValid(obj) {
    return typeof obj === "object";
  }

  /**
      Check whether the parameter is undefined or an object.
     */
  static isValidOrUndefined(obj) {
    return obj === undefined || ObjectHelper.isValid(obj);
  }

  /**
      Raise an object validation error.
     */
  static raiseError(paramName) {
    throw new Error(`${paramName}${ERROR_MESSAGE.INVALID_OBJECT}`);
  }
}
