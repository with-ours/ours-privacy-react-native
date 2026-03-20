import {OursPrivacyLogger} from "./oursprivacy-logger";

export class AsyncStorageAdapter {
  constructor(storage) {
    if (!storage) {
      try {
        const mod = require("@react-native-async-storage/async-storage");
        this.storage = mod.default || mod;
      } catch {
        console.error(
          "[@RNC/AsyncStorage]: NativeModule: AsyncStorage is null. Please run 'npm install @react-native-async-storage/async-storage' or follow the OursPrivacy guide to set up your own Storage class."
        );
        console.error("[OursPrivacy] Falling back to in-memory storage");
        this.storage = new InMemoryStorage();
      }
    } else {
      this.storage = storage;
    }
  }

  async getItem(key) {
    try {
      return await this.storage.getItem(key);
    } catch {
      OursPrivacyLogger.error("error getting item from storage");
      return null;
    }
  }

  async setItem(key, value) {
    try {
      await this.storage.setItem(key, value);
    } catch {
      OursPrivacyLogger.error("error setting item in storage");
    }
  }

  async removeItem(key) {
    try {
      await this.storage.removeItem(key);
    } catch {
      OursPrivacyLogger.error("error removing item from storage");
    }
  }
}

class InMemoryStorage {
  constructor() {
    this.store = {};
  }

  async getItem(key) {
    return this.store.hasOwnProperty(key) ? this.store[key] : null;
  }

  async setItem(key, value) {
    this.store[key] = value;
  }

  async removeItem(key) {
    delete this.store[key];
  }
}
