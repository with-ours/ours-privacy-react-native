import {
  defaultBatchSize,
  defaultFlushInterval,
  defaultServerURL,
} from "./oursprivacy-constants";

import {OursPrivacyLogger} from "./oursprivacy-logger";

export class OursPrivacyConfig {
  static instance;

  static getInstance() {
    if (!OursPrivacyConfig.instance) {
      OursPrivacyConfig.instance = new OursPrivacyConfig();
    }
    return OursPrivacyConfig.instance;
  }

  constructor() {
    if (OursPrivacyConfig.instance) {
      throw new Error(`Use OursPrivacyConfig.getInstance()`);
    }
    this._config = {};
  }

  setLoggingEnabled(token, loggingEnabled) {
    this._config[token] = {
      ...this._config[token],
      loggingEnabled,
    };
    if (loggingEnabled) {
      console.info(`OursPrivacy Logging Enabled`);
    } else {
      console.info(`OursPrivacy Logging Disabled`);
    }
  }

  getLoggingEnabled(token) {
    return (this._config[token] && this._config[token].loggingEnabled) || false;
  }

  setServerURL(token, serverURL) {
    this._config[token] = {
      ...this._config[token],
      serverURL,
    };
    OursPrivacyLogger.log(token, `Set serverURL: ${serverURL}`);
  }

  getServerURL(token) {
    return (
      (this._config[token] && this._config[token].serverURL) || defaultServerURL
    );
  }

  setUseIpAddressForGeolocation(token, useIpAddressForGeolocation) {
    this._config[token] = {
      ...this._config[token],
      useIpAddressForGeolocation,
    };
    OursPrivacyLogger.log(
      token,
      `Set useIpAddressForGeolocation: ${useIpAddressForGeolocation}`
    );
  }

  getUseIpAddressForGeolocation(token) {
    return (
      (this._config[token] && this._config[token].useIpAddressForGeolocation) ||
      true
    );
  }

  setFlushBatchSize(token, batchSize) {
    this._config[token] = {
      ...this._config[token],
      batchSize,
    };
    OursPrivacyLogger.log(token, `Set flush batch size: ${batchSize}`);
  }

  getFlushBatchSize(token) {
    return (
      (this._config[token] && this._config[token].batchSize) || defaultBatchSize
    );
  }

  setFlushInterval(token, flushInterval) {
    this._config[token] = {
      ...this._config[token],
      flushInterval,
    };
    OursPrivacyLogger.log(token, `Set flush interval: ${flushInterval}`);
  }

  getFlushInterval(token) {
    return (
      (this._config[token] && this._config[token].flushInterval) ||
      defaultFlushInterval
    );
  }
}
