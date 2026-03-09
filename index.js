"use strict";

import {Platform, NativeModules} from "react-native";
import packageJson from "./package.json";
const {OursPrivacyReactNative} = NativeModules;
import OursPrivacyMain from "./javascript/oursprivacy-main"

const DevicePlatform = {
  Unknown: "Unknown",
  Android: "android",
  iOS: "ios",
};

const ERROR_MESSAGE = {
  INVALID_OBJECT: " is not a valid json object",
  INVALID_STRING: " is not a valid string",
  REQUIRED_DOUBLE: " is not a valid number",
};

const PARAMS = {
  TOKEN: "token",
  DISTINCT_ID: "distinctId",
  ALIAS: "alias",
  EVENT_NAME: "eventName",
  GROUP_KEY: "groupKey",
  PROPERTIES: "properties",
  PROPERTY_NAME: "propertyName",
  PROP: "prop",
  NAME: "name",
  CHARGE: "charge",
  PROPERTY_VALUE: "property value",
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
   * @param {object} superProperties  Optional A Map containing the key value pairs of the super properties to register
   * @param {string} serverURL Optional Set the base URL used for OursPrivacy API requests. See setServerURL()
   *
   */
  async init(
    optOutTrackingDefault = DEFAULT_OPT_OUT,
    superProperties = {},
    serverURL = "https://api.oursprivacy.com/api/v1"
  ) {
    await this.oursprivacyImpl.initialize(
      this.token,
      this.trackAutomaticEvents,
      optOutTrackingDefault,
      {...Helper.getMetaData(), ...superProperties},
      serverURL
    );
  }

  /**
   * @deprecated since version 1.3.0. To initialize OursPrivacy, please use the instance method `init` instead. See the example below:
   *
   * <pre><code>
   * const trackAutomaticEvents = true;
   * const oursprivacy = new OursPrivacy('your project token', trackAutomaticEvents);
   * oursprivacy.init();
   * </code></pre>
   *
   * Initializes OursPrivacy and return an instance of OursPrivacy the given project token.
   *
   * @param {string} token your project token.
   * @param {boolean} trackAutomaticEvents Whether or not to automatically track common mobile events
   * @param {boolean} Optional Whether or not OursPrivacy can start tracking by default. See optOutTracking()
   *
   */
  static async init(
    token,
    trackAutomaticEvents,
    optOutTrackingDefault = DEFAULT_OPT_OUT
  ) {
    await OursPrivacyReactNative.initialize(
      token,
      trackAutomaticEvents,
      optOutTrackingDefault,
      Helper.getMetaData(),
      "https://api.oursprivacy.com/api/v1"
    );
    return new OursPrivacy(token, trackAutomaticEvents);
  }

  /**
   * Set the base URL used for OursPrivacy API requests.
   * Useful if you need to proxy OursPrivacy requests. Defaults to https://api.oursprivacy.com.
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
   * This controls whether to automatically send the client IP Address as part of event tracking.
   * With an IP address, geo-location is possible down to neighborhoods within a city,
   * although the OursPrivacy Dashboard will just show you city level location specificity.
   *
   * @param {boolean} useIpAddressForGeolocation whether to automatically send the client IP Address.
   * Defaults to true.
   *
   */
  setUseIpAddressForGeolocation(useIpAddressForGeolocation) {
    this.oursprivacyImpl.setUseIpAddressForGeolocation(
      this.token,
      useIpAddressForGeolocation
    );
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
   * <p>Calls to track() made before corresponding calls to identify
   * will use an anonymous locally generated distinct id, which means it is best to call identify
   * early to ensure that your OursPrivacy funnels and retention analytics can continue to track the
   * user throughout their lifetime. We recommend calling identify when the user authenticates.
   *
   * <p>Once identify is called, the local distinct id persists across restarts of
   * your application.
   *
   * @param {string} distinctId a string uniquely identifying this user. Events sent to
   *     OursPrivacy using the same disinct_id will be considered associated with the
   *     same visitor/customer for retention and funnel reporting, so be sure that the given
   *     value is globally unique for each individual user you intend to track.
   * @returns {Promise} A promise that resolves when the identify is successful.
   *     It does not return any value.
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
   * @deprecated The alias method creates an alias which OursPrivacy will use to remap one id to another.
   * Multiple aliases can point to the same identifier.
   *
   *  `mixpane.alias("New ID", mixpane.distinctId)`
   *  `mixpane.alias("Newer ID", mixpane.distinctId)`
   *
   * <p>This call does not identify the user after. You must still call identify()
   *  if you wish the new alias to be used for Events and People.
   *
   * @param {string} alias A unique identifier that you want to use as an identifier for this user.
   * @param {string} distinctId the current distinct_id that alias will be mapped to.
   */
  alias(alias, distinctId) {
    if (!StringHelper.isValid(alias)) {
      StringHelper.raiseError(PARAMS.ALIAS);
    }
    if (!StringHelper.isValid(distinctId)) {
      StringHelper.raiseError(PARAMS.DISTINCT_ID);
    }
    this.oursprivacyImpl.alias(this.token, alias, distinctId);
  }

  /**
   * Track an event.
   *
   * <p>Every call to track eventually results in a data point sent to OursPrivacy. These data points
   * are what are measured, counted, and broken down to create your OursPrivacy reports. Events
   * have a string name, and an optional set of name/value pairs that describe the properties of
   * that event.
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
    this.oursprivacyImpl.track(this.token, eventName, {
      ...Helper.getMetaData(),
      ...properties,
    });
  }

  /**
   * Register properties that will be sent with every subsequent call to track().
   *
   * <p>SuperProperties are a collection of properties that will be sent with every event to OursPrivacy,
   * and persist beyond the lifetime of your application.
   *
   * <p>Setting a superProperty with registerSuperProperties will store a new superProperty,
   * possibly overwriting any existing superProperty with the same name (to set a
   * superProperty only if it is currently unset, use registerSuperPropertiesOnce())
   *
   * <p>SuperProperties will persist even if your application is taken completely out of memory.
   * to remove a superProperty, call unregisterSuperProperty() or clearSuperProperties()
   *
   * @param {object} properties A Map containing super properties to register
   */
  registerSuperProperties(properties) {
    if (!ObjectHelper.isValidOrUndefined(properties)) {
      ObjectHelper.raiseError(PARAMS.PROPERTIES);
    }
    this.oursprivacyImpl.registerSuperProperties(this.token, properties || {});
  }

  /**
   * Register super properties for events, only if no other super property with the
   * same names has already been registered.
   *
   * <p>Calling registerSuperPropertiesOnce will never overwrite existing properties.
   *
   * @param {object} properties A Map containing the super properties to register.
   */
  registerSuperPropertiesOnce(properties) {
    if (!ObjectHelper.isValidOrUndefined(properties)) {
      ObjectHelper.raiseError(PARAMS.PROPERTIES);
    }
    this.oursprivacyImpl.registerSuperPropertiesOnce(this.token, properties || {});
  }

  /**
   * Remove a single superProperty, so that it will not be sent with future calls to track().
   *
   * <p>If there is a superProperty registered with the given name, it will be permanently
   * removed from the existing superProperties.
   * To clear all superProperties, use clearSuperProperties()
   *
   * @param {string} propertyName name of the property to unregister
   */
  unregisterSuperProperty(propertyName) {
    if (!StringHelper.isValid(propertyName)) {
      StringHelper.raiseError(PARAMS.PROPERTY_NAME);
    }
    this.oursprivacyImpl.unregisterSuperProperty(this.token, propertyName);
  }

  /**
   * Returns a json object of the user's current super properties
   *
   *<p>SuperProperties are a collection of properties that will be sent with every event to OursPrivacy,
   * and persist beyond the lifetime of your application.
   *
   * @return {Promise<object>} Super properties for this OursPrivacy instance.
   */
  getSuperProperties() {
    return this.oursprivacyImpl.getSuperProperties(this.token);
  }

  /**
   * Erase all currently registered superProperties.
   *
   * <p>Future tracking calls to OursPrivacy will not contain the specific
   * superProperties registered before the clearSuperProperties method was called.
   *
   * <p>To remove a single superProperty, use unregisterSuperProperty()
   */
  clearSuperProperties() {
    this.oursprivacyImpl.clearSuperProperties(this.token);
  }

  /**
   * Begin timing of an event. Calling timeEvent("Thing") will not send an event, but
   * when you eventually call track("Thing"), your tracked event will be sent with a "$duration"
   * property, representing the number of seconds between your calls.
   *
   * @param {string} eventName the name of the event to track with timing.
   */
  timeEvent(eventName) {
    if (!StringHelper.isValid(eventName)) {
      StringHelper.raiseError(PARAMS.EVENT_NAME);
    }
    this.oursprivacyImpl.timeEvent(this.token, eventName);
  }

  /**
   * Retrieves the time elapsed for the named event since timeEvent() was called.
   *
   * @param {string} eventName the name of the event to be tracked that was previously called with timeEvent()
   *
   * @return {Promise<number>} Time elapsed since timeEvent(String) was called for the given eventName.
   */
  eventElapsedTime(eventName) {
    if (!StringHelper.isValid(eventName)) {
      StringHelper.raiseError(PARAMS.EVENT_NAME);
    }
    return this.oursprivacyImpl.eventElapsedTime(this.token, eventName);
  }

  /**
      Clear super properties and generates a new random distinctId for this instance.
      Useful for clearing data when a user logs out.
     */
  reset() {
    this.oursprivacyImpl.reset(this.token);
  }

  /**
   * Returns the current distinct id of the user.
   * This is either the id automatically generated by the library or the id that has been passed by a call to identify().
   *
   * example of usage:
   * <pre>
   * <code>
   * const distinctId = await oursprivacy.getDistinctId();
   * </code>
   * </pre>
   *
   * @return {Promise<string>} A Promise to the distinct id associated with OursPrivacy event and People Analytics
   *
   */
  getDistinctId() {
    return this.oursprivacyImpl.getDistinctId(this.token);
  }

  /**
   * Returns the current device id of the device.
   * This id automatically generated by the library and regenerated when logout or reset is called.
   *
   * example of usage:
   * <pre>
   * <code>
   * const deviceId = await oursprivacy.getDeviceId();
   * </code>
   * </pre>
   *
   * @return {Promise<string>} A Promise to the device id
   *
   */
  getDeviceId() {
    return this.oursprivacyImpl.getDeviceId(this.token);
  }

  /**
   * Push all queued OursPrivacy events and People Analytics changes to OursPrivacy servers.
   *
   * <p>Events and People messages are pushed gradually throughout
   * the lifetime of your application. This means that to ensure that all messages
   * are sent to OursPrivacy when your application is shut down, you will
   * need to call flush() to let the OursPrivacy library know it should
   * send all remaining messages to the server.
   */
  flush() {
    this.oursprivacyImpl.flush(this.token);
  }
}

class Helper {
  /**
      Get the library data from package.json file.
     */
  static getMetaData() {
    let metadata = JSON.parse(JSON.stringify(packageJson.metadata));
    metadata["$lib_version"] = packageJson.version;
    return metadata;
  }

  /**
      Get current device platform.
     */
  static getDevicePlatform() {
    switch (Platform.OS) {
      case "android":
        return DevicePlatform.Android;
      case "ios":
        return DevicePlatform.iOS;
      default:
        return DevicePlatform.Unknown;
    }
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
