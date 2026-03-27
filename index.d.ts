type OursPrivacyType = any;
type OursPrivacyProperties = {[key: string]: OursPrivacyType};

export type OursPrivacyAsyncStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type OursPrivacyInitOptions = {
  serverURL?: string;
  visitor_id?: string;
  initialURL?: string;
  default_event_properties?: Record<string, any>;
  default_user_custom_properties?: Record<string, any>;
  default_user_consent_properties?: Record<string, any>;
};

export type OursPrivacyUserProperties = {
  email?: string;
  external_id?: string;
  phone_number?: string;
  first_name?: string;
  last_name?: string;
  custom_properties?: Record<string, any>;
  consent?: Record<string, any>;
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
  init(
    optOutTrackingDefault?: boolean,
    options?: OursPrivacyInitOptions
  ): Promise<void>;
  setServerURL(serverURL: string): void;
  setLoggingEnabled(loggingEnabled: boolean): void;
  setFlushOnBackground(flushOnBackground: boolean): void;
  setFlushBatchSize(flushBatchSize: number): void;
  hasOptedOutTracking(): Promise<boolean>;
  optInTracking(): void;
  optOutTracking(): void;
  identify(id: string, userProperties?: OursPrivacyUserProperties): Promise<void>;
  track(eventName: string, properties?: OursPrivacyProperties): void;
  reset(): void;
  getVisitorId(): string | null;
  updateDefaultEventProperties(properties: Record<string, any>): void;
  updateDefaultUserCustomProperties(properties: Record<string, any>): void;
  updateDefaultUserConsentProperties(properties: Record<string, any>): void;
  trackDeepLink(url: string): Promise<void>;
  setVisitorId(visitorId: string): Promise<void>;
  flush(): void;
}
