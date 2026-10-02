export type OursPrivacyPropertyValue =
  | string
  | number
  | boolean
  | null
  | OursPrivacyPropertyValue[]
  | {[key: string]: OursPrivacyPropertyValue};
export type OursPrivacyProperties = Record<string, OursPrivacyPropertyValue>;

export type OursPrivacyAsyncStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type OursPrivacyInitOptions = {
  trackAutomaticEvents?: boolean;
  optOutTrackingByDefault?: boolean;
  serverURL?: string;
  visitorId?: string;
  initialURL?: string;
  defaultEventProperties?: OursPrivacyProperties;
  defaultUserCustomProperties?: OursPrivacyProperties;
  defaultUserConsentProperties?: Record<string, boolean>;
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
  consent?: Record<string, boolean>;
};

export class OursPrivacy {
  constructor();
  init(token: string, options?: OursPrivacyInitOptions): Promise<void>;
  setServerURL(serverURL: string): void;
  setLoggingEnabled(loggingEnabled: boolean): void;
  setFlushOnBackground(flushOnBackground: boolean): void;
  setFlushBatchSize(flushBatchSize: number): void;
  hasOptedOutTracking(): Promise<boolean>;
  optInTracking(): void;
  optOutTracking(): void;
  identify(userProperties?: OursPrivacyUserProperties): Promise<void>;
  track(
    eventName: string,
    eventProperties?: OursPrivacyProperties,
    userProperties?: OursPrivacyUserProperties
  ): void;
  reset(): void;
  getVisitorId(): string | null;
  updateDefaultEventProperties(properties: OursPrivacyProperties): void;
  updateDefaultUserCustomProperties(properties: OursPrivacyProperties): void;
  updateDefaultUserConsentProperties(properties: Record<string, boolean>): void;
  trackDeepLink(url: string): Promise<void>;
  setVisitorId(visitorId: string): Promise<void>;
  flush(): void;
}
