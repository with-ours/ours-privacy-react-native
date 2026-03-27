import {
  getVisitorIdKey,
  getSuperPropertiesKey,
  getTimeEventsKey,
  getOptedOutKey as getOutedOutKey,
  getQueueKey,
  getAppHasOpenedBeforeKey,
} from "./oursprivacy-constants";

import {AsyncStorageAdapter} from "./oursprivacy-storage";
import {uuidv4} from "./oursprivacy-utils";
import {OursPrivacyLogger} from "./oursprivacy-logger";

export class OursPrivacyPersistent {
  static instance;

  static getInstance(storage) {
    if (!OursPrivacyPersistent.instance) {
      OursPrivacyPersistent.instance = new OursPrivacyPersistent(
        new AsyncStorageAdapter(storage)
      );
    }
    return OursPrivacyPersistent.instance;
  }

  constructor(storageAdapter) {
    if (OursPrivacyPersistent.instance) {
      throw new Error(`Use OursPrivacyPersistent.getInstance()`);
    }

    this.storageAdapter = storageAdapter;
    this._superProperties = {};
    this._timeEvents = {};
    this._identity = {};
    this._optedOut = {};
    this._appHasOpenedBefore = {};
  }

  async initializationCompletePromise(token) {
    await Promise.all([
      this.loadIdentity(token),
      this.loadSuperProperties(token),
      this.loadTimeEvents(token),
      this.loadOptOut(token),
      this.loadAppHasOpenedBefore(token),
    ]);
  }

  async loadVisitorId(token) {
    await this.storageAdapter
      .getItem(getVisitorIdKey(token))
      .then((visitorId) => {
        if (!this._identity[token]) {
          this._identity[token] = {};
        }
        this._identity[token].visitorId = visitorId;
      });
    if (!this._identity[token].visitorId) {
      this._identity[token].visitorId = uuidv4();
      await this.storageAdapter.setItem(
        getVisitorIdKey(token),
        this._identity[token].visitorId
      );
    }
    OursPrivacyLogger.log(token, "visitorId:", this._identity[token].visitorId);
  }

  async loadIdentity(token) {
    await this.loadVisitorId(token);
  }

  async persistIdentity(token) {
    await this.persistVisitorId(token);
  }

  getVisitorId(token) {
    if (!this._identity[token]) {
      return null;
    }
    return this._identity[token].visitorId;
  }

  updateVisitorId(token, visitorId) {
    this._identity[token].visitorId = visitorId;
  }

  async persistVisitorId(token) {
    if (!this._identity[token] || this._identity[token].visitorId === null) {
      return;
    }
    await this.storageAdapter.setItem(
      getVisitorIdKey(token),
      this._identity[token].visitorId
    );
  }

  async loadSuperProperties(token) {
    const superPropertiesString = await this.storageAdapter.getItem(
      getSuperPropertiesKey(token)
    );
    this._superProperties[token] = superPropertiesString
      ? JSON.parse(superPropertiesString)
      : {};
  }

  getSuperProperties(token) {
    return this._superProperties[token];
  }

  updateSuperProperties(token, superProperties) {
    this._superProperties = {
      ...this._superProperties,
      [token]: {...superProperties},
    };
  }

  async persistSuperProperties(token) {
    if (this._superProperties[token] === null) {
      return;
    }
    await this.storageAdapter.setItem(
      getSuperPropertiesKey(token),
      JSON.stringify(this._superProperties[token])
    );
  }

  async loadTimeEvents(token) {
    const timeEventsString = await this.storageAdapter.getItem(
      getTimeEventsKey(token)
    );
    this._timeEvents[token] = timeEventsString
      ? JSON.parse(timeEventsString)
      : {};
  }

  getTimeEvents(token) {
    return this._timeEvents[token];
  }

  updateTimeEvents(token, timeEvents) {
    this._timeEvents = {...this._timeEvents, [token]: {...timeEvents}};
  }

  async persistTimeEvents(token) {
    if (this._timeEvents[token] === null) {
      return;
    }
    await this.storageAdapter.setItem(
      getTimeEventsKey(token),
      JSON.stringify(this._timeEvents[token])
    );
  }

  async loadOptOut(token) {
    const optOutString = await this.storageAdapter.getItem(
      getOutedOutKey(token)
    );
    this._optedOut[token] = optOutString === "true";
  }

  getOptedOut(token) {
    return this._optedOut[token] === true;
  }

  updateOptedOut(token, optOut) {
    this._optedOut = {...this._optedOut, [token]: optOut};
  }

  async persistOptedOut(token) {
    if (this._optedOut[token] === null) {
      return;
    }
    await this.storageAdapter.setItem(
      getOutedOutKey(token),
      this._optedOut[token].toString()
    );
  }

  async loadQueue(token, type) {
    const queueString = await this.storageAdapter.getItem(
      getQueueKey(token, type)
    );
    return queueString ? JSON.parse(queueString) : [];
  }

  async saveQueue(token, type, queue) {
    await this.storageAdapter.setItem(
      getQueueKey(token, type),
      JSON.stringify(queue)
    );
  }

  async loadAppHasOpenedBefore(token) {
    const appHasOpenedBeforeString = await this.storageAdapter.getItem(
      getAppHasOpenedBeforeKey(token)
    );
    this._appHasOpenedBefore[token] = appHasOpenedBeforeString === "true";
  }

  getAppHasOpenedBefore(token) {
    return this._appHasOpenedBefore[token] === true;
  }

  updateAppHasOpenedBefore(token, appHasOpenedBefore) {
    this._appHasOpenedBefore = {
      ...this._appHasOpenedBefore,
      [token]: appHasOpenedBefore,
    };
  }

  async persistAppHasOpenedBefore(token) {
    if (this._appHasOpenedBefore[token] === null) {
      return;
    }
    await this.storageAdapter.setItem(
      getAppHasOpenedBeforeKey(token),
      this._appHasOpenedBefore[token].toString()
    );
  }

  async reset(token) {
    await this.storageAdapter.removeItem(getVisitorIdKey(token));
    await this.storageAdapter.removeItem(getSuperPropertiesKey(token));
    await this.storageAdapter.removeItem(getTimeEventsKey(token));
    await this.loadIdentity(token);
    await this.loadSuperProperties(token);
    await this.loadTimeEvents(token);
  }
}
