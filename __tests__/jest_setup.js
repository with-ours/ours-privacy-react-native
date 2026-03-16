jest.mock("../javascript/oursprivacy-storage", () => {
  return {
    AsyncStorageAdapter: jest.fn().mockImplementation(() => ({
      getItem: jest.fn().mockResolvedValue(null),
      setItem: jest.fn().mockResolvedValue(undefined),
      removeItem: jest.fn().mockResolvedValue(undefined),
    })),
  };
});
jest.mock("uuid", () => ({
  v4: jest.fn().mockReturnValue("mock-uuid-v4"),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: jest.fn((obj) => obj.ios) },
  NativeModules: {
    OursPrivacyReactNative: {
      initialize: jest.fn(),
      setServerURL: jest.fn(),
      setLoggingEnabled: jest.fn(),
      setFlushOnBackground: jest.fn(),
      setFlushBatchSize: jest.fn(),
      hasOptedOutTracking: jest.fn(),
      optInTracking: jest.fn(),
      optOutTracking: jest.fn(),
      identify: jest.fn().mockResolvedValue(undefined),
      track: jest.fn(),
      reset: jest.fn(),
      getVisitorId: jest.fn().mockReturnValue("mock-visitor-id"),
      updateDefaultEventProperties: jest.fn(),
      updateDefaultUserCustomProperties: jest.fn(),
      updateDefaultUserConsentProperties: jest.fn(),
    },
  },
  AppState: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    currentState: "active",
  },
  Dimensions: {
    get: jest.fn().mockReturnValue({ width: 375, height: 812 }),
  },
}));
