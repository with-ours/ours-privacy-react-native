export type OursPrivacyPropertyValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | OursPrivacyPropertyValue[]
  | { [key: string]: OursPrivacyPropertyValue };
export type OursPrivacyProperties = Record<string, OursPrivacyPropertyValue>;

type SerializableProperty<T> = T extends
  string | number | boolean | null | undefined
  ? T
  : T extends (...args: never[]) => unknown
    ? never
    : T extends readonly (infer Item)[]
      ? SerializableProperty<Item>[]
      : T extends object
        ? { [K in keyof T]: SerializableProperty<T[K]> }
        : never;

export type OursPrivacyAsyncStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type OursPrivacyInitOptions = {
  trackAutomaticEvents?: boolean;
  appVersion?: string;
  appBuild?: string;
  optOutTrackingByDefault?: boolean;
  serverURL?: string;
  visitorId?: string;
  initialURL?: string;
  defaultEventProperties?: OursPrivacyProperties;
  defaultUserCustomProperties?: OursPrivacyProperties;
  defaultUserConsentProperties?: OursPrivacyProperties;
  storage?: OursPrivacyAsyncStorage;
};

export type OursPrivacyUserProperties = {
  email?: string;
  externalId?: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  companyName?: string;
  jobTitle?: string;
  ip?: string;
  customProperties?: OursPrivacyProperties;
  consent?: OursPrivacyProperties;
};

export class OursPrivacy {
  constructor();
  init(token: string, options?: OursPrivacyInitOptions): Promise<void>;
  setServerURL(serverURL: string): void;
  setLoggingEnabled(loggingEnabled: boolean): void;
  setFlushOnBackground(flushOnBackground: boolean): void;
  setFlushBatchSize(flushBatchSize: number): void;
  hasOptedOutTracking(): Promise<boolean>;
  optInTracking(): Promise<void>;
  optOutTracking(): Promise<void>;
  identify(userProperties?: OursPrivacyUserProperties): Promise<void>;
  track<T extends object>(
    eventName: string,
    eventProperties?: T & SerializableProperty<T>,
    userProperties?: OursPrivacyUserProperties,
  ): void;
  trackScreen(screenName: string): void;
  reset(): void;
  getVisitorId(): string | null;
  updateDefaultEventProperties<T extends object>(
    properties: T & SerializableProperty<T>,
  ): void;
  updateDefaultUserCustomProperties(properties: OursPrivacyProperties): void;
  updateDefaultUserConsentProperties(properties: OursPrivacyProperties): void;
  trackDeepLink(url: string): Promise<void>;
  setVisitorId(visitorId: string): Promise<void>;
  flush(): void;
}
