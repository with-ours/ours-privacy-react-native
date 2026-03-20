jest.mock("../javascript/oursprivacy-storage", () => {
  return {
    AsyncStorageAdapter: jest.fn().mockImplementation(() => ({
      getItem: jest.fn().mockResolvedValue(null),
      setItem: jest.fn().mockResolvedValue(undefined),
      removeItem: jest.fn().mockResolvedValue(undefined),
    })),
  };
});
jest.mock("../javascript/oursprivacy-utils", () => ({
  ...jest.requireActual("../javascript/oursprivacy-utils"),
  uuidv4: jest.fn().mockReturnValue("mock-uuid-v4"),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: jest.fn((obj) => obj.ios) },
  NativeModules: {},
  AppState: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    currentState: "active",
  },
  Dimensions: {
    get: jest.fn().mockReturnValue({ width: 375, height: 812 }),
  },
}));
