import {Platform} from "react-native";
import {OursPrivacyCore} from "./oursprivacy-core";
import {OursPrivacyType} from "./oursprivacy-constants";
import {OursPrivacyConfig} from "./oursprivacy-config";
import {OursPrivacyPersistent} from "./oursprivacy-persistent";
import {OursPrivacyLogger} from "./oursprivacy-logger";
import packageJson from "../package.json";
import uuid from "uuid";

export default class OursPrivacyMain {
  constructor(token, trackAutomaticEvents, storage) {
    this.token = token;
    this.config = OursPrivacyConfig.getInstance();
    this.core = OursPrivacyCore(storage);
    this.core.initialize(token);
    this.core.startProcessingQueue(token);
    this.oursprivacyPersistent = OursPrivacyPersistent.getInstance();
    this._defaultEventProperties = {};
    this._defaultUserCustomProperties = {};
    this._defaultUserConsentProperties = {};
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
    if (optOutTrackingDefault) {
      await this.optOutTracking(token);
      return;
    } else {
      await this._setOptedOutTrackingFlag(token, false);
    }

    this.setServerURL(token, serverURL);

    if (options && typeof options === "object") {
      if (options.default_event_properties) {
        this.updateDefaultEventProperties(token, options.default_event_properties);
      }
      if (options.default_user_custom_properties) {
        this.updateDefaultUserCustomProperties(token, options.default_user_custom_properties);
      }
      if (options.default_user_consent_properties) {
        this.updateDefaultUserConsentProperties(token, options.default_user_consent_properties);
      }
      if (options.user_id) {
        this.config.setIsManuallySetId(token, true);
      }
    }
  }

  getDefaultProperties() {
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
    return props;
  }

  async reset(token) {
    await this.oursprivacyPersistent.reset(token);
    this._defaultEventProperties[token] = {};
    this._defaultUserCustomProperties[token] = {};
    this._defaultUserConsentProperties[token] = {};
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

    const visitorId = this.oursprivacyPersistent.getDeviceId(token);
    const distinctId = uuid.v4();

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
      defaultProperties: this.getDefaultProperties(),
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

  flush(token) {
    this.core.flush(token);
  }

  async optOutTracking(token) {
    await this._setOptedOutTrackingFlag(token, true);
    OursPrivacyLogger.log(token, "User has opted out of tracking");
    await this.oursprivacyPersistent.reset(token);
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
    return this.oursprivacyPersistent.getOptOut(token);
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
    const distinctId = uuid.v4();

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
      defaultProperties: this.getDefaultProperties(),
    };

    await this.core.addToOursPrivacyQueue(token, OursPrivacyType.EVENTS, eventData);
  }

  getVisitorId(token) {
    return this.oursprivacyPersistent.getDeviceId(token);
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
}
