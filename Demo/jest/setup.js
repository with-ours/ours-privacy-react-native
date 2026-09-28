jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The SDK runs a flush interval; fake timers keep it from holding Jest open.
jest.useFakeTimers();
