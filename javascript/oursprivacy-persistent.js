import {
  getVisitorIdKey,
  getSuperPropertiesKey,
  getTimeEventsKey,
  getOptedOutKey as getOutedOutKey,
  getQueueKey,
  getQueueMetadataKey,
  getOptOutDecisionKey,
  getOptOutDefaultKey,
  getMobileInstallKey,
  getAppHasOpenedBeforeKey,
} from './oursprivacy-constants';

import { AsyncStorageAdapter } from './oursprivacy-storage';
import { uuidv4 } from './oursprivacy-utils';
import { OursPrivacyLogger } from './oursprivacy-logger';

export class OursPrivacyPersistent {
  static instance;

  static getInstance(storage) {
    if (!OursPrivacyPersistent.instance) {
      OursPrivacyPersistent.instance = new OursPrivacyPersistent(
        new AsyncStorageAdapter(storage),
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
    this._existingInstall = {};
    this._optedOut = {};
    this._optOutLoaded = {};
    this._storedOptOutDecision = {};
    this._storedOptOutDefault = {};
    this._optOutRevision = {};
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
    const visitorId = await this.storageAdapter.getItemStrict(
      getVisitorIdKey(token),
    );
    let installation = await this.storageAdapter.getItemStrict(
      getMobileInstallKey(token),
    );
    if (installation != null && !['fresh', 'legacy'].includes(installation)) {
      throw new Error('Invalid stored mobile installation');
    }
    if (installation == null) {
      installation = visitorId ? 'legacy' : 'fresh';
      await this.storageAdapter.setItemStrict(
        getMobileInstallKey(token),
        installation,
      );
    }
    this._existingInstall[token] = installation === 'legacy';
    this._identity[token] = { visitorId };
    if (!this._identity[token].visitorId) {
      this._identity[token].visitorId = uuidv4();
      await this.storageAdapter.setItemStrict(
        getVisitorIdKey(token),
        this._identity[token].visitorId,
      );
    }
    OursPrivacyLogger.log(token, 'visitorId:', this._identity[token].visitorId);
  }

  async loadIdentity(token) {
    await this.loadVisitorId(token);
  }

  async persistIdentity(token) {
    await this.persistVisitorId(token);
  }

  hasExistingInstall(token) {
    return (
      this._existingInstall[token] === true || this.getAppHasOpenedBefore(token)
    );
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
      this._identity[token].visitorId,
    );
  }

  async loadSuperProperties(token) {
    const superPropertiesString = await this.storageAdapter.getItem(
      getSuperPropertiesKey(token),
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
      [token]: { ...superProperties },
    };
  }

  async persistSuperProperties(token) {
    if (this._superProperties[token] === null) {
      return;
    }
    await this.storageAdapter.setItem(
      getSuperPropertiesKey(token),
      JSON.stringify(this._superProperties[token]),
    );
  }

  async loadTimeEvents(token) {
    const timeEventsString = await this.storageAdapter.getItem(
      getTimeEventsKey(token),
    );
    this._timeEvents[token] = timeEventsString
      ? JSON.parse(timeEventsString)
      : {};
  }

  getTimeEvents(token) {
    return this._timeEvents[token];
  }

  updateTimeEvents(token, timeEvents) {
    this._timeEvents = { ...this._timeEvents, [token]: { ...timeEvents } };
  }

  async persistTimeEvents(token) {
    if (this._timeEvents[token] === null) {
      return;
    }
    await this.storageAdapter.setItem(
      getTimeEventsKey(token),
      JSON.stringify(this._timeEvents[token]),
    );
  }

  async loadOptOut(token) {
    const revision = this._optOutRevision[token] || 0;
    if (revision > 0) return;
    this._optOutLoaded[token] = false;
    this._optedOut[token] = true;
    const optOutString = await this.storageAdapter.getItemStrict(
      getOutedOutKey(token),
    );
    if (revision !== (this._optOutRevision[token] || 0)) return;
    if (
      optOutString !== null &&
      optOutString !== undefined &&
      optOutString !== 'true' &&
      optOutString !== 'false'
    ) {
      throw new Error('Invalid stored tracking decision');
    }
    const explicitDecision = await this.storageAdapter.getItemStrict(
      getOptOutDecisionKey(token),
    );
    if (revision !== (this._optOutRevision[token] || 0)) return;
    if (
      explicitDecision != null &&
      explicitDecision !== 'true' &&
      explicitDecision !== 'false'
    ) {
      throw new Error('Invalid stored tracking decision');
    }
    const defaultDecision = await this.storageAdapter.getItemStrict(
      getOptOutDefaultKey(token),
    );
    if (revision !== (this._optOutRevision[token] || 0)) return;
    if (
      defaultDecision != null &&
      defaultDecision !== 'true' &&
      defaultDecision !== 'false'
    ) {
      throw new Error('Invalid stored tracking default');
    }
    this._storedOptOutDecision[token] =
      explicitDecision === 'true' || explicitDecision === 'false';
    this._storedOptOutDefault[token] =
      defaultDecision != null && defaultDecision === optOutString;
    this._optedOut[token] =
      optOutString === 'true' ||
      explicitDecision === 'true' ||
      (!this._storedOptOutDecision[token] && defaultDecision === 'true');
    this._optOutLoaded[token] = true;
  }

  getOptedOut(token) {
    return this._optOutLoaded[token] !== true || this._optedOut[token] === true;
  }

  hasStoredOptOutDecision(token) {
    return this._storedOptOutDecision[token] === true;
  }

  hasStoredOptOutDefault(token) {
    return this._storedOptOutDefault[token] === true;
  }

  updateOptedOut(token, optOut, expectedRevision) {
    const currentRevision = this._optOutRevision[token] || 0;
    if (expectedRevision !== undefined && expectedRevision !== currentRevision)
      return currentRevision;
    const revision = currentRevision + 1;
    this._optOutRevision[token] = revision;
    this._optedOut = { ...this._optedOut, [token]: optOut };
    return revision;
  }

  async persistOptedOut(token, explicitDecision = true) {
    if (this._optedOut[token] === null) {
      return;
    }
    if (explicitDecision) {
      this._storedOptOutDecision[token] = true;
      this._storedOptOutDefault[token] = false;
    }
    await this.storageAdapter.setItemStrict(
      getOutedOutKey(token),
      this._optedOut[token].toString(),
    );
    if (explicitDecision) {
      await this.storageAdapter.setItemStrict(
        getOptOutDecisionKey(token),
        this._optedOut[token].toString(),
      );
      this._storedOptOutDecision[token] = true;
      this._storedOptOutDefault[token] = false;
    } else {
      await this.storageAdapter.setItemStrict(
        getOptOutDefaultKey(token),
        this._optedOut[token].toString(),
      );
      this._storedOptOutDefault[token] = true;
    }
    this._optOutLoaded[token] = true;
  }

  async loadQueue(token, type) {
    let queue;
    try {
      const queueString = await this.storageAdapter.getItemStrict(
        getQueueKey(token, type),
      );
      queue = queueString ? JSON.parse(queueString) : [];
    } catch {
      OursPrivacyLogger.error(
        token,
        'Saved event queue could not be read; starting an empty queue.',
      );
      return [];
    }
    if (!Array.isArray(queue)) return queue;
    try {
      const metadataString = await this.storageAdapter.getItemStrict(
        getQueueMetadataKey(token, type),
      );
      return {
        ...(metadataString ? JSON.parse(metadataString) : {}),
        items: queue,
      };
    } catch {
      OursPrivacyLogger.error(
        token,
        'Saved queue metadata could not be read; preserving queued events.',
      );
      return queue;
    }
  }

  async saveQueue(token, type, queue) {
    await this.storageAdapter.setItemStrict(
      getQueueKey(token, type),
      JSON.stringify(queue.items ?? queue),
    );
  }

  async saveQueueMetadata(token, type, metadata) {
    await this.storageAdapter.setItemStrict(
      getQueueMetadataKey(token, type),
      JSON.stringify(metadata),
    );
  }

  async loadAppHasOpenedBefore(token) {
    const appHasOpenedBeforeString = await this.storageAdapter.getItem(
      getAppHasOpenedBeforeKey(token),
    );
    this._appHasOpenedBefore[token] = appHasOpenedBeforeString === 'true';
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
      this._appHasOpenedBefore[token].toString(),
    );
  }

  async reset(token, { preserveVisitorId = false } = {}) {
    if (!preserveVisitorId) {
      await this.storageAdapter.removeItem(getVisitorIdKey(token));
    }
    await this.storageAdapter.removeItem(getSuperPropertiesKey(token));
    await this.storageAdapter.removeItem(getTimeEventsKey(token));
    if (!preserveVisitorId) {
      await this.loadIdentity(token);
    }
    await this.loadSuperProperties(token);
    await this.loadTimeEvents(token);
  }
}
