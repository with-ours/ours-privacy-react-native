type OursPrivacyType = any;
type OursPrivacyProperties = {[key: string]: OursPrivacyType};

export type OursPrivacyAsyncStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export class OursPrivacy {
  constructor(token: string, trackAutoMaticEvents: boolean);
  constructor(token: string, trackAutoMaticEvents: boolean, useNative: true);
  constructor(
    token: string,
    trackAutomaticEvents: boolean,
    useNative: false,
    storage?: OursPrivacyAsyncStorage
  );
  static init(
    token: string,
    trackAutomaticEvents: boolean,
    optOutTrackingDefault?: boolean
  ): Promise<OursPrivacy>;
  init(
    optOutTrackingDefault?: boolean,
    superProperties?: OursPrivacyProperties,
    serverURL?: String
  ): Promise<void>;
  setServerURL(serverURL: string): void;
  setLoggingEnabled(loggingEnabled: boolean): void;
  setFlushOnBackground(flushOnBackground: boolean): void;
  setUseIpAddressForGeolocation(useIpAddressForGeolocation: boolean): void;
  setFlushBatchSize(flushBatchSize: number): void;
  hasOptedOutTracking(): Promise<boolean>;
  optInTracking(): void;
  optOutTracking(): void;
  identify(distinctId: string, userProperties?: any): Promise<void>;
  alias(alias: string, distinctId: string): void;
  track(eventName: string, properties?: OursPrivacyProperties): void;
  registerSuperProperties(properties: OursPrivacyProperties): void;
  registerSuperPropertiesOnce(properties: OursPrivacyProperties): void;
  unregisterSuperProperty(propertyName: string): void;
  getSuperProperties(): Promise<OursPrivacyProperties>;
  clearSuperProperties(): void;
  timeEvent(eventName: string): void;
  eventElapsedTime(eventName: string): Promise<number>;
  reset(): void;
  getDistinctId(): Promise<string>;
  getDeviceId(): Promise<string>;
  flush(): void;
}
