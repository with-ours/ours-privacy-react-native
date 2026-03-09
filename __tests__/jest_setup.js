import * as ReactNative from "react-native";

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
  v4: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.doMock("react-native", () => {
  // Extend ReactNative
  return Object.setPrototypeOf(
    {
      // Redefine an export, like a component
      Button: "MockedButton",

      // Mock out properties of an already mocked export
      LayoutAnimation: {
        ...ReactNative.LayoutAnimation,
        configureNext: jest.fn(),
      },

      // Mock a native module
      NativeModules: {
        ...ReactNative.NativeModules,
        OursPrivacyReactNative: {
          initialize: jest.fn(),
          setServerURL: jest.fn(),
          setLoggingEnabled: jest.fn(),
          setFlushOnBackground: jest.fn(),
          setUseIpAddressForGeolocation: jest.fn(),
          setFlushBatchSize: jest.fn(),
          hasOptedOutTracking: jest.fn(),
          optInTracking: jest.fn(),
          optOutTracking: jest.fn(),
          identify: jest.fn().mockResolvedValue(undefined),
          alias: jest.fn(),
          track: jest.fn(),
          registerSuperProperties: jest.fn(),
          registerSuperPropertiesOnce: jest.fn(),
          unregisterSuperProperty: jest.fn(),
          getSuperProperties: jest.fn(),
          clearSuperProperties: jest.fn(),
          timeEvent: jest.fn(),
          eventElapsedTime: jest.fn(),
          reset: jest.fn(),
          getDistinctId: jest.fn(),
        },
      },
    },
    ReactNative
  );
});
