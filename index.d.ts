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
  identify(distinctId: string): Promise<void>;
  alias(alias: string, distinctId: string): void;
  track(eventName: string, properties?: OursPrivacyProperties): void;
  getPeople(): People;
  trackWithGroups(
    eventName: string,
    properties?: OursPrivacyProperties,
    groups?: OursPrivacyProperties
  ): void;
  setGroup(groupKey: string, groupID: OursPrivacyType): void;
  getGroup(groupKey: string, groupID: OursPrivacyType): OursPrivacyGroup;
  addGroup(groupKey: string, groupID: OursPrivacyType): void;
  removeGroup(groupKey: string, groupID: OursPrivacyType): void;
  deleteGroup(groupKey: string, groupID: OursPrivacyType): void;
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

export class People {
  constructor(token: string, oursprivacyInstance: any);
  set(prop: string, to: OursPrivacyType): void;
  set(properties: OursPrivacyProperties): void;
  setOnce(prop: string, to: OursPrivacyType): void;
  setOnce(properties: OursPrivacyProperties): void;
  increment(prop: string, by: number): void;
  increment(properties: OursPrivacyProperties): void;
  append(name: string, value: OursPrivacyType): void;
  union(name: string, value: Array<OursPrivacyType>): void;
  remove(name: string, value: OursPrivacyType): void;
  unset(name: string): void;
  trackCharge(charge: number, properties: OursPrivacyProperties): void;
  clearCharges(): void;
  deleteUser(): void;
}

export class OursPrivacyGroup {
  constructor(
    token: string,
    groupKey: string,
    groupID: OursPrivacyType,
    oursprivacyInstance: any
  );
  set(prop: string, to: OursPrivacyType): void;
  setOnce(prop: string, to: OursPrivacyType): void;
  unset(prop: string): void;
  remove(name: string, value: OursPrivacyType): void;
  union(name: string, value: OursPrivacyType): void;
}
