import {Platform} from "react-native";
import {OursPrivacyCore} from "./oursprivacy-core";
import {OursPrivacyType} from "./oursprivacy-constants";
import {OursPrivacyConfig} from "./oursprivacy-config";
import {OursPrivacyPersistent} from "./oursprivacy-persistent";
import {OursPrivacyLogger} from "./oursprivacy-logger";
import packageJson from "../package.json";

export default class OursPrivacyMain {
  constructor(token, trackAutomaticEvents, storage) {
    this.token = token;
    this.config = OursPrivacyConfig.getInstance();
    this.core = OursPrivacyCore(storage);
    this.core.initialize(token);
    this.core.startProcessingQueue(token);
    this.oursprivacyPersistent = OursPrivacyPersistent.getInstance();
  }

  async initialize(
    token,
    trackAutomaticEvents = false,
    optOutTrackingDefault = false,
    superProperties = null,
    serverURL = "https://api.oursprivacy.com/api/v1"
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
    await this.registerSuperProperties(token, {
      ...superProperties,
    });
  }

  getMetaData() {
    const {OS, Version, constants} = Platform;
    const {Brand, Manufacturer, Model} = constants || {};

    let metadata = {
      $os: OS,
      $os_version: Version,
      ...JSON.parse(JSON.stringify(packageJson.metadata)),
      $lib_version: packageJson.version,
    };
    if (OS === "ios") {
      metadata = {
        ...metadata,
        $manufacturer: "Apple",
      };
    } else if (OS === "android") {
      metadata = {
        ...metadata,
        $android_brand: Brand,
        $android_manufacturer: Manufacturer,
        $android_model: Model,
      };
    }

    return metadata;
  }

  async reset(token) {
    await this.oursprivacyPersistent.reset(token);
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
    const superProperties = this.oursprivacyPersistent.getSuperProperties(token);
    const identityProps = {
      distinct_id: this.oursprivacyPersistent.getDistinctId(token),
      $device_id: this.oursprivacyPersistent.getDeviceId(token),
      $user_id: this.oursprivacyPersistent.getUserId(token),
    };
    const eventElapsedTime = await this.eventElapsedTime(token, eventName);
    const eventProperties = Object.freeze({
      token,
      time: Date.now(),
      ...this.getMetaData(),
      ...superProperties,
      ...properties,
      ...identityProps,
      ...(eventElapsedTime !== null && {
        $duration: eventElapsedTime,
      }),
    });

    const eventData = Object.freeze({
      event: eventName,
      properties: eventProperties,
    });

    if (eventElapsedTime !== null) {
      let timeEvents = this.oursprivacyPersistent.getTimeEvents(token);
      delete timeEvents[eventName];
      this.oursprivacyPersistent.updateTimeEvents(token, timeEvents);
      await this.oursprivacyPersistent.persistTimeEvents(token);
    }
    await this.core.addToOursPrivacyQueue(token, OursPrivacyType.EVENTS, eventData);
  }

  setLoggingEnabled(token, loggingEnabled) {
    this.config.setLoggingEnabled(token, loggingEnabled);
  }

  setServerURL(token, serverURL) {
    this.config.setServerURL(token, serverURL);
  }

  setUseIpAddressForGeolocation(token, useIpAddressForGeolocation) {
    this.config.setUseIpAddressForGeolocation(
      token,
      useIpAddressForGeolocation
    );
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

  async identify(token, newDistinctId) {
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
    const deviceId = this.oursprivacyPersistent.getDeviceId(token);
    await this.oursprivacyPersistent.persistIdentity(token);
    await this.track(token, "$identify", {
      distinctId: newDistinctId,
      $user_id: newDistinctId,
      $anon_distinct_id: oldDistinctId,
      $device_id: deviceId,
    });
  }

  async alias(token, alias, distinctId) {
    OursPrivacyLogger.log(token, `Alias '${alias}' to '${distinctId}'`);
    await this.track(token, "$create_alias", {
      alias,
      distinct_id: distinctId,
    });
    await this.identify(token, distinctId);
  }

  async getDeviceId(token) {
    if (!this.oursprivacyPersistent.getDeviceId(token)) {
      await this.oursprivacyPersistent.loadIdentity(token);
    }
    return this.identity[token].deviceId;
  }

  async getDistinctId(token) {
    if (!this.oursprivacyPersistent.getDistinctId(token)) {
      await this.oursprivacyPersistent.loadIdentity(token);
    }
    return this.oursprivacyPersistent.getDistinctId(token);
  }

  async _updateSuperProperties(token, properties) {
    this.oursprivacyPersistent.updateSuperProperties(token, properties);
    await this.oursprivacyPersistent.persistSuperProperties(token);
  }

  async registerSuperProperties(token, properties) {
    OursPrivacyLogger.log(token, `Register super properties:`, properties);
    const currentSuperProperties = this.oursprivacyPersistent.getSuperProperties(
      token
    );
    OursPrivacyLogger.log(
      token,
      `Current Super Properties:`,
      currentSuperProperties
    );
    const updatedSuperProperties = {
      ...currentSuperProperties,
      ...properties,
    };

    this._updateSuperProperties(token, updatedSuperProperties);
    OursPrivacyLogger.log(
      token,
      `Updated Super Properties:`,
      updatedSuperProperties
    );
  }

  async registerSuperPropertiesOnce(token, properties) {
    OursPrivacyLogger.log(token, `Register super properties once`, properties);
    const currentSuperProperties = this.oursprivacyPersistent.getSuperProperties(
      token
    );

    const updatedSuperProperties = {
      ...properties,
      ...currentSuperProperties,
    };

    this._updateSuperProperties(token, updatedSuperProperties);
    OursPrivacyLogger.log(
      token,
      `Updated Super Properties:`,
      updatedSuperProperties
    );
  }

  async unregisterSuperProperty(token, propertyName) {
    OursPrivacyLogger.log(token, `Unregister super property '${propertyName}'`);
    let superProperties = this.oursprivacyPersistent.getSuperProperties(token);
    delete superProperties[propertyName];
    this._updateSuperProperties(token, superProperties);
    OursPrivacyLogger.log(token, `Updated Super Properties:`, superProperties);
  }

  async getSuperProperties(token) {
    if (!this.oursprivacyPersistent.getSuperProperties(token)) {
      await this.oursprivacyPersistent.loadSuperProperties(token);
    }
    return this.oursprivacyPersistent.getSuperProperties(token);
  }

  async clearSuperProperties(token) {
    OursPrivacyLogger.log(token, `Clear super properties`);
    this._updateSuperProperties(token, {});
    OursPrivacyLogger.log(token, `Updated Super Properties:`, {});
  }

  async timeEvent(token, eventName) {
    const currentTime = Math.round(Date.now() / 1000);
    OursPrivacyLogger.log(
      token,
      `Add time event '${eventName}' at`,
      new Date(currentTime * 1000).toLocaleString()
    );
    this.oursprivacyPersistent.updateTimeEvents(token, {
      ...this.oursprivacyPersistent.getTimeEvents(token),
      [eventName]: currentTime,
    });
    await this.oursprivacyPersistent.persistTimeEvents(token);
  }

  async eventElapsedTime(token, eventName) {
    if (!this.oursprivacyPersistent.getTimeEvents(token)) {
      await this.oursprivacyPersistent.loadTimeEvents(token);
    }
    const timeEvents = this.oursprivacyPersistent.getTimeEvents(token);
    const startTime = timeEvents ? timeEvents[eventName] : undefined;

    if (startTime) {
      const duration = Math.round(Date.now() / 1000) - startTime;
      return duration;
    }
    return null;
  }

  async sendProfileDataToOursPrivacy(token, action) {
    const profileData = {
      $token: token,
      $time: Date.now(),
      ...action,
      $distinct_id: this.oursprivacyPersistent.getDistinctId(token),
      $device_id: this.oursprivacyPersistent.getDeviceId(token),
      $user_id: this.oursprivacyPersistent.getUserId(token),
    };
    await this.core.addToOursPrivacyQueue(token, OursPrivacyType.USER, profileData);
  }

  async sendGroupDataToOursPrivacy({token, groupKey, groupID, action}) {
    const profileData = {
      $token: token,
      $time: Date.now(),
      $group_key: groupKey,
      $group_id: groupID,
      ...action,
    };
    await this.core.addToOursPrivacyQueue(token, OursPrivacyType.GROUPS, profileData);
  }

  async set(token, properties) {
    OursPrivacyLogger.log(token, `Set properties: `, properties);
    await this.sendProfileDataToOursPrivacy(token, {$set: properties});
  }

  async setOnce(token, properties) {
    OursPrivacyLogger.log(token, `Set once properties: `, properties);
    await this.sendProfileDataToOursPrivacy(token, {$set_once: properties});
  }

  async increment(token, properties) {
    OursPrivacyLogger.log(token, `Increment properties: `, properties);
    await this.sendProfileDataToOursPrivacy(token, {$add: properties});
  }

  async append(token, nameOrProperties, value) {
    if (typeof nameOrProperties === "string" && value !== undefined) {
      OursPrivacyLogger.log(token, `Append properties: `, {
        [nameOrProperties]: value,
      });
      await this.sendProfileDataToOursPrivacy(token, {
        $append: {[nameOrProperties]: value},
      });
    } else if (typeof nameOrProperties === "object") {
      OursPrivacyLogger.log(token, `Append properties: `, nameOrProperties);
      await this.sendProfileDataToOursPrivacy(token, {
        $append: nameOrProperties,
      });
    }
  }

  async union(token, nameOrProperties, value) {
    if (typeof nameOrProperties === "string" && value !== undefined) {
      OursPrivacyLogger.log(token, `Union properties: `, {
        [nameOrProperties]: value,
      });
      await this.sendProfileDataToOursPrivacy(token, {
        $union: {[nameOrProperties]: value},
      });
    } else if (typeof nameOrProperties === "object") {
      OursPrivacyLogger.log(token, `Union properties: `, nameOrProperties);
      await this.sendProfileDataToOursPrivacy(token, {$union: nameOrProperties});
    }
  }

  async remove(token, nameOrProperties, value) {
    if (typeof nameOrProperties === "string" && value !== undefined) {
      OursPrivacyLogger.log(token, `Remove properties: `, {
        [nameOrProperties]: value,
      });
      await this.sendProfileDataToOursPrivacy(token, {
        $remove: {[nameOrProperties]: value},
      });
    } else if (typeof nameOrProperties === "object") {
      OursPrivacyLogger.log(token, `Remove properties: `, nameOrProperties);
      await this.sendProfileDataToOursPrivacy(token, {
        $remove: nameOrProperties,
      });
    }
  }

  async trackCharge(token, charge, properties) {
    OursPrivacyLogger.log(token, `Track charge: `, charge, properties);
    await this.append(token, {
      $transactions: {$amount: charge, $time: Date.now(), ...properties},
    });
  }

  async clearCharges(token) {
    OursPrivacyLogger.log(token, `Clear charges`);
    await this.set(token, {
      $transactions: [],
    });
  }

  async unset(token, property) {
    OursPrivacyLogger.log(token, `Unset property: `, property);
    await this.sendProfileDataToOursPrivacy(token, {$unset: [property]});
  }

  async deleteUser(token) {
    OursPrivacyLogger.log(token, `Delete user`);
    await this.sendProfileDataToOursPrivacy(token, {$delete: "null"});
  }

  async groupSetProperties(token, groupKey, groupID, properties) {
    OursPrivacyLogger.log(
      token,
      `Group set properties: `,
      groupKey,
      groupID,
      properties
    );
    await this.sendGroupDataToOursPrivacy({
      token,
      groupKey,
      groupID,
      action: {
        $set: properties,
      },
    });
  }

  async groupSetPropertyOnce(token, groupKey, groupID, properties) {
    OursPrivacyLogger.log(
      token,
      `Group set once properties: `,
      groupKey,
      groupID,
      properties
    );
    await this.sendGroupDataToOursPrivacy({
      token,
      groupKey,
      groupID,
      action: {
        $set_once: properties,
      },
    });
  }

  async groupUnsetProperty(token, groupKey, groupID, prop) {
    OursPrivacyLogger.log(
      token,
      `Group unset property: `,
      groupKey,
      groupID,
      prop
    );
    await this.sendGroupDataToOursPrivacy({
      token,
      groupKey,
      groupID,
      action: {
        $unset: [prop],
      },
    });
  }

  async groupRemovePropertyValue(token, groupKey, groupID, name, value) {
    OursPrivacyLogger.log(
      token,
      `Group remove property value: `,
      groupKey,
      groupID,
      name,
      value
    );
    await this.sendGroupDataToOursPrivacy({
      token,
      groupKey,
      groupID,
      action: {
        $remove: {[name]: value},
      },
    });
  }

  async groupUnionProperty(token, groupKey, groupID, name, value) {
    OursPrivacyLogger.log(
      token,
      `Group union property: `,
      groupKey,
      groupID,
      name,
      value
    );
    await this.sendGroupDataToOursPrivacy({
      token,
      groupKey,
      groupID,
      action: {
        $union: {[name]: value},
      },
    });
  }

  async trackWithGroups(token, eventName, properties, groups) {
    OursPrivacyLogger.log(
      token,
      `Track with groups: `,
      eventName,
      properties,
      groups
    );
    await this.track(token, eventName, {...properties, ...groups});
  }

  async setGroup(token, groupKey, groupID) {
    OursPrivacyLogger.log(token, `Set group: `, groupKey, groupID);
    const properties = {[groupKey]: [groupID]};
    await this.registerSuperProperties(token, properties);
    await this.set(token, properties);
  }

  async addGroup(token, groupKey, groupID) {
    OursPrivacyLogger.log(token, `Add group: `, groupKey, groupID);
    const superProperties = this.oursprivacyPersistent.getSuperProperties(token);
    const groupArray = superProperties[groupKey] || [];
    if (!groupArray.includes(groupID)) {
      this.registerSuperProperties(token, {
        [groupKey]: [...groupArray, groupID],
      });
    }
    await this.union(token, {[groupKey]: [groupID]});
  }

  async removeGroup(token, groupKey, groupID) {
    OursPrivacyLogger.log(token, `Remove group: `, groupKey, groupID);
    const superProperties = this.oursprivacyPersistent.getSuperProperties(token);
    if (superProperties && superProperties[groupKey]) {
      const filteredGroup = superProperties[groupKey].filter(
        (id) => id !== groupID
      );
      this.registerSuperProperties(token, {[groupKey]: filteredGroup});
      if (filteredGroup.length === 0) {
        this.unregisterSuperProperty(token, groupKey);
      }
    }
    await this.remove(token, {[groupKey]: groupID});
  }

  async deleteGroup(token, groupKey, groupID) {
    OursPrivacyLogger.log(token, `Delete group: `, groupKey, groupID);
    await this.sendGroupDataToOursPrivacy({
      token,
      groupKey,
      groupID,
      action: {
        $delete: "null",
      },
    });
  }
}
