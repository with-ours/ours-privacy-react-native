type OursPrivacyType = any;
type OursPrivacyProperties = {[key: string]: OursPrivacyType};

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
  defaultEventProperties?: Record<string, any>;
  defaultUserCustomProperties?: Record<string, any>;
  defaultUserConsentProperties?: Record<string, any>;
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
  customProperties?: Record<string, any>;
  consent?: Record<string, any>;
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
  updateDefaultEventProperties(properties: Record<string, any>): void;
  updateDefaultUserCustomProperties(properties: Record<string, any>): void;
  updateDefaultUserConsentProperties(properties: Record<string, any>): void;
  trackDeepLink(url: string): Promise<void>;
  setVisitorId(visitorId: string): Promise<void>;
  flush(): void;
}
